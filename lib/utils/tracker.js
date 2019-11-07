"use strict";

const async = require("async");
const treeKill = require("tree-kill");

// Ignore errors: We want to kill as many procs as we can.
const ignoreError = function (cb) {
  return cb
    ? function () { cb(); }
    : function () {}; // noop
};

/**
 * Multi-process tracker.
 *
 * @returns {void}
 */
const Tracker = module.exports = function Tracker() {
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

  const self = this;

  // Short-circuit and kill without async wait if killed.
  if (self.killed) {
    treeKill(proc.pid, "SIGTERM", ignoreError());
    return proc;
  }

  // Track.
  self.procs.push(proc);

  // Remove from tracked list when closed.
  proc.on("close", () => {
    self.procs = self.procs.filter((obj) => obj.pid !== proc.pid);
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
  if (this.procs.length === 0) { return void callback(); }

  async.map(this.procs, (proc, cb) => {
    treeKill(proc.pid, "SIGTERM", ignoreError(cb));
  }, callback);
};
