"use strict";
/*eslint max-params: [2, 4]*/

var exec = require("child_process").exec;
var _ = require("lodash");
var async = require("async");
var chalk = require("chalk");
var log = require("./log");
var Tracker = require("./utils/tracker");

// Helper for command strings for logging.
var cmdStr = function (cmd, opts) {
  return "Command: " + chalk.gray(cmd) +
    (opts.taskEnv ? ", Environment: " + chalk.magenta(JSON.stringify(opts.taskEnv)) : "");
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
      callback(err);
    });
  });

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
    var errors = [];

    log.info("concurrent", "Starting with queue size: " + chalk.magenta(queue || "unlimited"));
    async.mapLimit(cmds, queue || Infinity, function (cmd, cb) {
      retry(cmd, shOpts, _.extend({ tracker: tracker }, opts), function (err) {
        if (err) {
          errors.push(err);
        }
        cb(bail ? err : null);
      });
    }, function () {
      finish(errors[0]);
    });
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
    var errors = [];

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
          errors.push(err);
        }
        cb(bail ? err : null);
      });
    }, function () {
      finish(errors[0]);
    });
  }
};
