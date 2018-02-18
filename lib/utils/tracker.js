"use strict";

var async = require("async");
var treeKill = require("tree-kill");

// Ignore errors: We want to kill as many procs as we can.
var ignoreError = function (cb) {
  return cb ?
    function () { cb(); } :
    function () {}; // noop
};

/**
 * Multi-process tracker.
 *
 * @returns {void}
 */
var Tracker = module.exports = function Tracker() {
  this.procs = [];
  this.killed = false;
};

/**
 * Add process and track close.
 *
 * @param {Object} proc Child process object
 * @returns {Object}    Child process object
 */
Tracker.prototype.add = function (proc) {
  if (!proc) { return proc; }

  var self = this;

  // Short-circuit and kill without async wait if killed.
  if (self.killed) {
    treeKill(proc.pid, "SIGTERM", ignoreError());
    return proc;
  }

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
 * @param   {Function} callback Called when kills are issued
 * @returns {void}
 */
Tracker.prototype.kill = function (callback) {
  this.killed = true;
  if (this.procs.length === 0) { return callback(); }

  async.map(this.procs, function (proc, cb) {
    treeKill(proc.pid, "SIGTERM", ignoreError(cb));
  }, callback);
};
