"use strict";

var exec = require("child_process").exec;
var _ = require("lodash");
var async = require("async");
var log = require("../lib/log");

/**
 * Run a single task.
 *
 * @param {String}    cmd       Shell command
 * @param {Object}    opts      Shell options
 * @param {Function}  callback  Callback `(err)`
 * @returns {Object}            Child process object
 */
var run = function (cmd, opts, callback) {
  log.info("proc:start", cmd);
  var proc = exec(cmd, opts, function (err) {
    var code = 0;

    if (err) {
      code = err.code || 1;
      log.error("proc:error", "Code: " + code + ", Command: " + cmd);
    }

    log.info("proc:end:" + code, cmd);
    callback(err);
  });

  proc.stdout.pipe(process.stdout, { end: false });
  proc.stderr.pipe(process.stderr, { end: false });

  return proc;
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
   * @param {Object}    opts      Shell options
   * @param {Function}  callback  Callback `(err)`
   * @returns {Object}            Child process object
   */
  run: function (cmd, opts, callback) {
    return run(cmd, opts, callback);
  },

  /**
   * Run multiple tasks in parallel.
   *
   * @param {Array}     cmds      List of shell commands
   * @param {Object}    opts      Shell options
   * @param {Function}  callback  Callback `(err)`
   * @returns {void}
   */
  concurrent: function (cmds, opts, callback) {
    var tracker = new Tracker();

    async.map(cmds, function (cmd, cb) {
      tracker.add(run(cmd, opts, cb));
    }, function (err) {
      tracker.kill();

      callback(err);
    });
  },

  /**
   * Install archetypes.
   *
   * @deprecated https://github.com/FormidableLabs/builder/issues/16
   *
   * `devDependencies` should come from an `ARCHETYPE-dev` package now and
   * not from the `ARCHETYPE/package.json`'s `devDependencies`, obviating the
   * need for this separate installation step.
   *
   * @param {Array}     paths       List of paths in which to `npm install`
   * @param {Object}    opts        Shell options
   * @param {Function}  callback    Callback `(err)`
   * @returns {void}
   */
  install: function (paths, opts, callback) {
    var tracker = new Tracker();

    async.mapSeries(paths, function (nodePath, cb) {
      log.info("install:npm", nodePath);
      tracker.add(run("npm install", _.extend({}, opts, { cwd: nodePath }), cb));
    }, function (err) {
      tracker.kill();

      callback(err);
    });
  }
};
