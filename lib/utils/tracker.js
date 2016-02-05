"use strict";

var async = require("async");
var treeKill = require("tree-kill");

/**
 * Multi-process tracker.
 *
 * @returns {void}
 */
var Tracker = module.exports = function Tracker() {
  this.procs = [];
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
  if (this.procs.length === 0) { return callback(); }

  async.map(this.procs, function (proc, cb) {
    // Ignore errors: We want to kill as many procs as we can.
    treeKill(proc.pid, "SIGTERM", function () { cb(); });

  }, callback);
};
