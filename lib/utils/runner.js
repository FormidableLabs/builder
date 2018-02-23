"use strict";
/*eslint max-params: [2, 4], max-statements: [2, 20] */

var _ = require("lodash");
var async = require("async");
var chalk = require("chalk");
var log = require("../log");
var spawn = require("./spawn");
var clone = require("./clone");
var expandFlag = require("./archetype").expandFlag;

// Stash for stubbable internal methods.
var runner = module.exports;

// Helper for command strings for logging.
var cmdStr = module.exports.cmdStr = function (cmd, opts) {
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
var cmdWithCustom = module.exports._cmdWithCustom = function (cmd, opts, env) {
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
var replaceToken = module.exports._replaceToken = function (str, tokens, sub) {
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
var expandArchetype = module.exports._expandArchetype = function (cmd, opts, env) {
  opts = opts || {};
  env = env || {};

  // Permissively handle either explicit argv array _or_ nopt-parsed argv object.
  var argv = _.get(opts.argv, "unparsed") || opts.argv;

  // Short-circuit if no expansion.
  var expand = opts.expandArchetype || expandFlag({ env: env, argv: argv });
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
  if (/^win/.test(process.platform)) {
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
module.exports.run = function (cmd, shOpts, opts, callback) {
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

  // Mutation steps for command. Separated for easier ordering / testing.
  //
  // Mutate env and return new command w/ `--` custom flags.
  cmd = cmdWithCustom(cmd, opts, shOpts.env);
  // Mutate env and return new command w/ file paths from the archetype itself.
  cmd = expandArchetype(cmd, opts, shOpts.env);

  log.debug("proc:start", cmdStr(cmd, opts));
  var proc = spawn(sh, [shFlag, cmd], shOpts, function (err) {
    var code = err ? err.code || 1 : 0;
    var level = code === 0 ? "debug" : "warn";

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
module.exports.retry = function (cmd, shOpts, opts, callback) {
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
      var proc = runner.run(cmd, shOpts, opts, function (err) {
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
