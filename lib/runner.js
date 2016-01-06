"use strict";
/*eslint max-params: [2, 4]*/

var exec = require("child_process").exec;
var _ = require("lodash");
var async = require("async");
var chalk = require("chalk");
var argvSplit = require("argv-split");
var log = require("./log");
var Tracker = require("./utils/tracker");

// One limitation of `exec()` is that it unconditionally buffers stdout/stderr
// input (whether piped, listened, or whatever) leading to a `maxBuffer` bug:
// https://github.com/FormidableLabs/builder/issues/62
//
// We set a comfortable margin here to up the number. In the future, we could
// just go "whole hog" and bump to `Infinity` if needed.
//
// Longer term, we can consider whether we want to do what npm does and use
// `spawn` with manual OS-compatible `sh` vs. `cmd` detection, cobble together
// our own flags and manage everything so that we can use the much more flexible
// `spawn` instead of `exec`.
// https://github.com/FormidableLabs/builder/issues/20
var MAX_BUFFER = 32 * 1024 * 1024;

// Helper for command strings for logging.
var cmdStr = function (cmd, opts) {
  return "Command: " + chalk.gray(cmd) +
    (opts.taskEnv ? ", Environment: " + chalk.magenta(JSON.stringify(opts.taskEnv)) : "");
};

// Helper for merging in custom options.
var cmdWithCustom = function (cmd, opts) {
  opts = opts || {};
  var customArgs = (opts || {})._customArgs || [];

  // Base case: No custom arguments to add.
  if (customArgs.length === 0) {
    return cmd;
  }

  // Scenario: A base command may have `--` already like `foo -- --bar` which
  // we need to add to. The hard part is the command may alternately be
  // something perverse like: `foo "totally -- not extra args"` where we need
  // to add the `--` to.
  //
  // This means _parsing_ a full command string, which we've tried to avoid
  // doing. So, current library of choice is:
  // - https://github.com/kaelzhang/node-argv-split
  //
  // Other working candidates:
  // - https://github.com/gabrieleds/node-argv (brings in `minimist` too)
  //
  // All of these libraries are a bit wonky / incomplete, so we only _detect_
  // if `--` is pre-existing before appending to the existing command. But,
  // for safety we don't mutate the original command (besides appending).
  var parsed = argvSplit(cmd);
  var haveCustom = parsed.indexOf("--") > 0;

  // Only add the `--` token if _not_ already there and _is_ a builder task.
  var isBuilderTask = opts._isBuilderTask === true;
  var addCustomToken = isBuilderTask && !haveCustom;

  // Add in the custom args with/without `--` token.
  return cmd + (addCustomToken ? " -- " : " ") + customArgs.join(" ");
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
  cmd = cmdWithCustom(cmd, opts);

  // Update shell options.
  shOpts = _.extend({
    maxBuffer: MAX_BUFFER
  }, shOpts);

  // Check if buffered output or piped.
  var buffer = opts.buffer;

  log.info("proc:start", cmdStr(cmd, opts));
  var proc = exec(cmd, shOpts, function (err, stdout, stderr) {
    var code = err ? err.code || 1 : 0;
    var level = code === 0 ? "info" : "warn";

    // Write out buffered output.
    if (buffer) {
      process.stdout.write(stdout);
      process.stderr.write(stderr);
    }

    log[level]("proc:end:" + code, cmdStr(cmd, opts));
    callback(err);
  });

  // Concurrent / "whenever" output.
  if (!buffer) {
    proc.stdout.pipe(process.stdout, { end: false });
    proc.stderr.pipe(process.stderr, { end: false });
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
 * @returns {Object}            Process object or `null`.
 */
var addSetup = function (setup, shOpts) {
  if (!setup) { return null; }

  var done = _.once(function (code) {
    var level = code === 0 ? "info" : "error";
    log[level]("setup:end", "Setup command ended with code: " + code);
  });

  log.info("setup:start", "Starting setup task: " + setup);
  var proc = run("builder run " + setup, shOpts, {}, done);
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
module.exports = {
  // Helpers.
  _cmdWithCustom: cmdWithCustom,

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

    return retry(cmd, shOpts, opts, finish);
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
    var taskEnvs = opts._envs;
    var bail = opts.bail;

    log.info("envs", "Starting with queue size: " + chalk.magenta(queue || "unlimited"));
    async.mapLimit(taskEnvs, queue || Infinity, function (taskEnv, cb) {
      // Add each specific set of environment variables.
      // Clone `shOpts` to turn `env` into a plain object: in Node 4+
      // `process.env` is a special object which changes merge behavior.
      var taskShOpts = _.merge(_.cloneDeep(shOpts), { env: taskEnv });
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
