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
 * @param {Function}  callback  Callback `(err)`
 * @returns {Object}            Child process object
 */
var run = function (cmd, shOpts, callback) {
  log.info("proc:start", cmd);
  var proc = exec(cmd, shOpts, function (err) {
    var code = err ? err.code || 1 : 0;
    var level = code === 0 ? "info" : "warn";

    log[level]("proc:end:" + code, cmd);
    callback(err);
  });

  proc.stdout.pipe(process.stdout, { end: false });
  proc.stderr.pipe(process.stderr, { end: false });

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
  var tries = opts.tries > 0 ? opts.tries : 1;
  var tracker = opts.tracker;

  // State.
  var success = false;
  var error;

  // Iterate and retry!
  async.whilst(
    function () {
      return !success && tries > 0;
    },
    function (cb) {
      var proc = run(cmd, shOpts, function (err) {
        // Manage, update state.
        tries--;
        error = err;
        success = !error;

        // Check tries.
        if (error && tries > 0) {
          log.warn("proc:retry", chalk.red(tries) + " tries left, Command: " + cmd);
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

    async.map(cmds, function (cmd, cb) {
      retry(cmd, shOpts, _.extend({ tracker: tracker }, opts), cb);
    }, function (err) {
      tracker.kill();
      callback(err);
    });
  }
};
