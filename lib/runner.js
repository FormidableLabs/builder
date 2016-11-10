"use strict";
/*eslint max-params: [2, 4], max-statements: [2, 20] */

var _ = require("lodash");
var async = require("async");
var chalk = require("chalk");
var spawn = require("./spawn");
var log = require("./log");
var Tracker = require("./utils/tracker");
var Config = require("./config");
var Environment = require("./environment");
var Task = require("./task");
var clone = require("./utils/clone");
var expandFlag = require("./utils/archetype").expandFlag;
var runner;

// Helper for command strings for logging.
var cmdStr = function (cmd, opts) {
  return "Command: " + chalk.gray(cmd) +
    (opts.taskEnv ? ", Environment: " + chalk.magenta(JSON.stringify(opts.taskEnv)) : "");
};

/**
 * Merge custom commands (`--`) into chosen script command + add to environment.
 *
 * Always reads and updates `_BUILDER_ARGS_CUSTOM_FLAGS` env var.
 * _May_ also append `-- <extra args>` to command.
 *
 * @param {String} cmd  Command
 * @param {Object} opts Options object
 * @param {Object} env  Environment object
 * @returns {String}    Updated command
 */
var cmdWithCustom = function (cmd, opts, env) {
  opts = opts || {};
  env = env || {};

  // Start with command line flags.
  var customFlags = (opts || {})._customFlags || [];
  try {
    // Extract custom flags from environment
    customFlags = customFlags.concat(JSON.parse(env._BUILDER_ARGS_CUSTOM_FLAGS) || []);
  } catch (err) {
    // Ignore parsing errors.
  }

  // Base case: No custom arguments to add.
  if (customFlags.length === 0) {
    return cmd;
  }

  // If we have custom flag commands from here, then add them to env.
  env._BUILDER_ARGS_CUSTOM_FLAGS = JSON.stringify(customFlags);

  // Only add the custom flags to non-builder tasks.
  return cmd + (opts._isBuilderTask === true ? "" : " " + customFlags.join(" "));
};

/**
 * Replace all instances of a token.
 *
 * _Note_: Only replaces in the following cases:
 *
 * - `^<token>`: Token is very first string.
 * - `[\s\t]<token>`: Whitespace before token.
 * - `['"]<token>`: Quotes before token.
 *
 * @param {String} str    String to parse
 * @param {String} tokens Tokens to replace (multiple for windows)
 * @param {String} sub    Replacement
 * @returns {String}      Mutated string
 */
var replaceToken = function (str, tokens, sub) {
  var tokenRes = tokens.map(function (token) {
    return {
      token: token,
      re: new RegExp("(^|\\s|\\'|\\\")(" + _.escapeRegExp(token) + ")", "g")
    };
  });

  return tokenRes.reduce(function (memo, obj) {
    return memo.replace(obj.re, function (match, prelimMatch, tokenMatch/* offset, origStr*/) {
      // Sanity check.
      if (tokenMatch !== obj.token) {
        throw new Error("Bad match " + match + " for token " + obj.token);
      }

      return prelimMatch + sub;
    });
  }, str);
};

/**
 * Expand file paths for archetype within chosen script command.
 *
 * @param {String} cmd  Command
 * @param {Object} opts Options object
 * @param {Object} env  Environment object
 * @returns {String}    Updated command
 */
var expandArchetype = function (cmd, opts, env) {
  opts = opts || {};
  env = env || {};

  // Short-circuit if no expansion.
  var expand = opts.expandArchetype || expandFlag({ env: env });
  if (expand !== true) {
    return cmd;
  }

  // Mark environment.
  env._BUILDER_ARGS_EXPAND_ARCHETYPE = "true";

  // Create regex around archetype controlling this command.
  var archetypeName = opts._archetypeName;
  if (!archetypeName) {
    // This would be a programming error in builder itself.
    // Should have been validated out to never happen.
    throw new Error("Have --expand-archetype but no archetype name");
  } else if (archetypeName === "ROOT") {
    // Skip expanding the "ROOT" archetype.
    //
    // The root project should have a predictable install level for an archetype
    // so we do this for safety.
    //
    // We _could_ reconsider this and pass in _all_ archetypes and expand them
    // all everywhere.
    return cmd;
  }

  // Infer full path to archetype.
  var archetypePath = opts._archetypePath;
  if (!archetypePath) {
    // Sanity check for programming error.
    throw new Error("Have --expand-archetype but no archetype path");
  }

  // Create final token for replacing.
  var archetypeTokens = [["node_modules", archetypeName].join("/")]; // unix
  if (process.platform.indexOf("win") === 0) {
    // Add windows delimiter too.
    archetypeTokens.push(["node_modules", archetypeName].join("\\"));
  }

  return replaceToken(cmd, archetypeTokens, archetypePath);
};

/**
 * Run a single task.
 *
 * @param {String}    cmd       Shell command
 * @param {Object}    shOpts    Shell options
 * @param {Object}    opts      Runner options
 * @param {Function}  callback  Callback `(err)`
 * @returns {Object}            Child process object
 */
var run = function (cmd, shOpts, opts, callback) {
  // Buffer output (for concurrent usage).
  var buffer = !!opts.buffer;
  var bufs = []; // { type: `stdio|stderr`, data: `data` }

  // Copied from npm's lib/utils/lifecycle.js
  var sh = "sh";
  var shFlag = "-c";

  // Update shell options and ensure basic structure.
  shOpts = _.extend({
    env: {},
    stdio: buffer ? "pipe" : "inherit"
  }, clone(shOpts)); // Clone deep to coerce env to plain object.

  // Copied from npm's lib/utils/lifecycle.js
  if (process.platform === "win32") {
    sh = shOpts.env.comspec || "cmd";
    shFlag = "/d /s /c";
    shOpts.windowsVerbatimArguments = true;
  }

  var env = shOpts.env;

  // Mutation steps for command. Separated for easier ordering / testing.
  //
  // Mutate env and return new command w/ `--` custom flags.
  cmd = cmdWithCustom(cmd, opts, env);
  // Mutate env and return new command w/ file paths from the archetype itself.
  cmd = expandArchetype(cmd, opts, env);

  log.info("proc:start", cmdStr(cmd, opts));
  var proc = spawn(sh, [shFlag, cmd], shOpts, function (err) {
    var code = err ? err.code || 1 : 0;
    var level = code === 0 ? "info" : "warn";

    // Output buffered output.
    if (buffer) {
      bufs.forEach(function (buf) {
        process[buf.type].write(buf.data.toString());
      });
    }

    log[level]("proc:end:" + code, cmdStr(cmd, opts));
    callback(err);
  });

  // Gather buffered output in memory.
  if (buffer) {
    proc.stdout.on("data", function (data) {
      bufs.push({ type: "stdout", data: data });
    });
    proc.stderr.on("data", function (data) {
      bufs.push({ type: "stderr", data: data });
    });
  }

  return proc;
};

/**
 * Run with retries.
 *
 * @param {String}    cmd       Shell command
 * @param {Object}    shOpts    Shell options
 * @param {Object}    opts      Runner options
 * @param {Function}  callback  Callback `(err)`
 * @returns {void}
 */
var retry = function (cmd, shOpts, opts, callback) {
  // Expand options.
  var tracker = opts.tracker;

  // State.
  var tries = opts.tries;
  var success = false;
  var error;

  // Iterate and retry!
  async.whilst(
    function () {
      return !success && tries > 0;
    },
    function (cb) {
      var proc = run(cmd, shOpts, opts, function (err) {
        // Manage, update state.
        tries--;
        error = err;
        success = !error;

        // Check tries.
        if (error && tries > 0) {
          log.warn("proc:retry", chalk.red(tries) + " tries left, " + cmdStr(cmd, opts));
        }

        // Execute without error.
        cb();
      });

      if (tracker) {
        tracker.add(proc);
      }
    },
    function (err) {
      error = error || err;
      if (error) {
        var code = error.code || 1;
        log.error("proc:error", "Code: " + code + ", " + cmdStr(cmd, opts));
      }

      callback(error);
    }
  );
};

/**
 * Add and invoke a setup task if present in options.
 *
 * @param {String}    setup     Setup task
 * @param {Object}    shOpts    Shell options
 * @returns {Object}            Process object or `null` if no setup.
 */
var addSetup = function (setup, shOpts) {
  if (!setup) { return null; }

  var done = _.once(function (code) {
    code = code || 0;
    var level = code === 0 ? "info" : "error";
    log[level]("setup:end", "Setup command ended with code: " + code);
  });

  // Create a `Task` object specifically for setup.
  //
  // **Note**: Could refactor this out to a higher-level `create` method or
  // something that could be reused by `builder-core.js`
  var config = new Config({
    env: shOpts.env
  });
  var env = new Environment({
    config: config,
    env: shOpts.env
  });
  var task = new Task({
    config: config,
    env: env,
    argv: ["node", "builder", "run", setup],
    runner: runner
  });

  log.info("setup:start", "Starting setup task: " + setup);

  // Task `run` will return the child process, which we pass back here.
  var proc = task.execute(done);
  if (!proc) {
    throw new Error("Must create a trackable setup process object");
  }
  proc.on("exit", done);

  return proc;
};

/**
 * Wrap callback with setup termination behavior.
 *
 * - Create and invoke setup.
 * - Early termination on setup error.
 * - Ensure callback only called once.
 *
 * @param {Object}    shOpts    Shell options
 * @param {Object}    opts      Runner options
 * @param {Object}    tracker   Process tracker
 * @param {Function}  callback  Callback `(err)`
 * @returns {Function}          Wrapped callback
 */
var createFinish = function (shOpts, opts, tracker, callback) {
  // Wrap callback
  var finish = _.once(function (err) {
    tracker.kill(function () {
      if (finish.errors.length > 1) {
        log.error("finish", "Hit " + chalk.red(finish.errors.length) + " errors: \n" +
          finish.errors.map(function (errItem) {
            return "  * " + chalk.gray(errItem.name) + ": " + chalk.red(errItem.message);
          }).join("\n"));
      }

      callback(err || finish.errors[0]);
    });
  });

  // Create error storage.
  finish.errors = [];

  // Add, invoke, and hook to final callback if setup dies early.
  var setup = tracker.add(addSetup(opts.setup, shOpts));
  if (setup) {
    // If setup exit happens before normal termination, kill everything.
    setup.on("exit", function (code) {
      finish(new Error("Setup exited with code: " + code));
    });
  }

  return finish;
};

/**
 * Task runner.
 */
runner = module.exports = {
  // Helpers.
  _cmdWithCustom: cmdWithCustom,
  _expandArchetype: expandArchetype,
  _replaceToken: replaceToken,

  /**
   * Run a single task.
   *
   * @param {String}    cmd       Shell command
   * @param {Object}    shOpts    Shell options
   * @param {Object}    opts      Runner options
   * @param {Function}  callback  Callback `(err)`
   * @returns {Object}            Child process object
   */
  run: function (cmd, shOpts, opts, callback) {
    // Add + invoke setup (if any), bind tracker cleanup, and wrap callback.
    var tracker = new Tracker();
    var finish = createFinish(shOpts, opts, tracker, callback);
    var tries = opts.tries;

    // If no retries, actually track and return child process object.
    if (tries === 1) {
      return tracker.add(run(cmd, shOpts, opts, finish));
    }

    // Otherwise retry without returning process object.
    retry(cmd, shOpts, opts, finish);
  },

  /**
   * Run multiple tasks in parallel.
   *
   * @param {Array}     cmds      List of shell commands
   * @param {Object}    shOpts    Shell options
   * @param {Object}    opts      Runner options
   * @param {Function}  callback  Callback `(err)`
   * @returns {void}
   */
  concurrent: function (cmds, shOpts, opts, callback) {
    // Add + invoke setup (if any), bind tracker cleanup, and wrap callback.
    var tracker = new Tracker();
    var finish = createFinish(shOpts, opts, tracker, callback);

    var queue = opts.queue;
    var bail = opts.bail;

    log.info("concurrent", "Starting with queue size: " + chalk.magenta(queue || "unlimited"));
    async.mapLimit(cmds, queue || Infinity, function (cmd, cb) {
      retry(cmd, shOpts, _.extend({ tracker: tracker }, opts), function (err) {
        if (err) {
          finish.errors.push(err);
        }
        cb(bail ? err : null);
      });
    }, finish);
  },

  /**
   * Run a single task with multiple environment variables in parallel.
   *
   * @param {String}    cmd       Shell command
   * @param {Object}    shOpts    Shell options
   * @param {Object}    opts      Runner options
   * @param {Function}  callback  Callback `(err)`
   * @returns {void}
   */
  envs: function (cmd, shOpts, opts, callback) {
    // Add + invoke setup (if any), bind tracker cleanup, and wrap callback.
    var tracker = new Tracker();
    var finish = createFinish(shOpts, opts, tracker, callback);

    var queue = opts.queue;
    var taskEnvs = clone(opts._envs);
    var bail = opts.bail;

    log.info("envs", "Starting with queue size: " + chalk.magenta(queue || "unlimited"));
    async.mapLimit(taskEnvs, queue || Infinity, function (taskEnv, cb) {
      // Add each specific set of environment variables.
      // Clone `shOpts` to turn `env` into a plain object: in Node 4+
      // `process.env` is a special object which changes merge behavior.
      var taskShOpts = _.merge(clone(shOpts), { env: taskEnv });
      var taskOpts = _.extend({ tracker: tracker, taskEnv: taskEnv }, opts);

      log.info("envs", "Starting " + cmdStr(cmd, taskOpts));
      retry(cmd, taskShOpts, taskOpts, function (err) {
        if (err) {
          finish.errors.push(err);
        }
        cb(bail ? err : null);
      });
    }, finish);
  }
};
