"use strict";
/*eslint max-params: [2, 4]*/

var exec = require("child_process").exec;
var _ = require("lodash");
var async = require("async");
var chalk = require("chalk");
var log = require("../lib/log");

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

  log.info("proc:start", cmd);
  var proc = exec(cmd, shOpts, function (err, stdout, stderr) {
    var code = err ? err.code || 1 : 0;
    var level = code === 0 ? "info" : "warn";

    // Write out buffered output.
    if (buffer) {
      process.stdout.write(stdout);
      process.stderr.write(stderr);
    }

    log[level]("proc:end:" + code, cmd);
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
  var taskEnv = opts.taskEnv;

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
          log.warn("proc:retry", chalk.red(tries) + " tries left, Command: " + chalk.gray(cmd) +
            (taskEnv ? ", Environment: " + chalk.magenta(JSON.stringify(taskEnv)) : ""));
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
        log.error("proc:error", "Code: " + code + ", Command: " + cmd);
      }

      callback(error);
    }
  );
};

/**
 * Multi-process tracker.
 *
 * @returns {void}
 */
var Tracker = function Tracker() {
  this.procs = [];
};

/**
 * Add process and track close.
 *
 * @param {Object} proc Child process object
 * @returns {Object}    Child process object
 */
Tracker.prototype.add = function (proc) {
  var self = this;

  // Track.
  self.procs.push(proc);

  // Remove from tracked list when closed.
  proc.on("close", function () {
    self.procs = self.procs.filter(function (obj) {
      return obj.pid !== proc.pid;
    });
  });

  return proc;
};

/**
 * Terminate all open processes
 *
 * @returns {void}
 */
Tracker.prototype.kill = function () {
  this.procs.forEach(function (proc) {
    proc.kill();
  });
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
    return retry(cmd, shOpts, opts, callback);
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
    var tracker = new Tracker();
    var queue = opts.queue;

    // Get mapper (queue vs. non-queue)
    var map = queue ?
      async.mapLimit.bind(async, cmds, queue) :
      async.map.bind(async, cmds);

    log.info("concurrent", "Starting with queue size: " + chalk.magenta(queue || "unlimited"));
    map(function (cmd, cb) {
      retry(cmd, shOpts, _.extend({ tracker: tracker }, opts), cb);
    }, function (err) {
      tracker.kill();
      callback(err);
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
    var tracker = new Tracker();
    var queue = opts.queue;
    var taskEnvs = opts._envs;

    // Get mapper (queue vs. non-queue)
    var map = queue ?
      async.mapLimit.bind(async, taskEnvs, queue) :
      async.map.bind(async, taskEnvs);

    log.info("envs", "Starting with queue size: " + chalk.magenta(queue || "unlimited"));
    map(function (taskEnv, cb) {
      // Add each specific set of environment variables.
      var taskShOpts = _.merge({}, shOpts, { env: taskEnv });
      var taskOpts = _.extend({ tracker: tracker, taskEnv: taskEnv }, opts);

      log.info("envs", "Starting environment " + chalk.magenta(JSON.stringify(taskEnv)) +
        " run for command: " + chalk.gray(cmd));
      retry(cmd, taskShOpts, taskOpts, cb);
    }, function (err) {
      tracker.kill();
      callback(err);
    });
  }
};
