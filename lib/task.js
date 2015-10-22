"use strict";

var path = require("path");

// Load local `package.json`.
// TODO: Protect on import error.
var CWD_PKG = require(path.join(process.cwd(), "package.json"));
// TODO: HACK -- Import archetypes
var ARCH_PKG = require(path.join(process.cwd(), "node_modules/builder-react-component/package.json"));

/**
 * Task wrapper.
 *
 * @param {Array} argv Arguments array (Default: `process.argv`)
 */
var Task = module.exports = function (argv) {
  argv = argv || process.argv;

  // Infer parts.
  this.script = argv[1];
  this.action = argv[2]; // TODO: Currently only `run`
  this.command = argv[3];
  this.args = argv.slice(4);
};

/**
 * Is this task a simple passthrough to another builder command?
 *
 * @returns {Boolean} Is this task a passthrough?
 */
Task.prototype.isPassthrough = function (task) {
  var builder = path.basename(this.script);
  var taskParts = task.split(/\s+/);
  var taskBin = taskParts[0];
  var taskAction = taskParts[1];
  var taskCommand = taskParts[2];

  // Note: Assumes a binary script match without `.js` extension.
  return builder === taskBin &&
    this.action === taskAction &&
    this.command === taskCommand;
};

/**
 * Get executable command.
 *
 * @returns {String} String to execute
 */
Task.prototype.getCommand = function () {
  // Try CWD task first.
  var task = (CWD_PKG.scripts || {})[this.command];

  // Go to archetype if passthrough or not found.
  if (!task || this.isPassthrough(task)) {
    task = (ARCH_PKG.scripts || {})[this.command];
  }

  // Error out if still can't find task.
  if (!task) {
    throw new Error("Unable to find task for: " + this.command);
  }

  return task;
};
