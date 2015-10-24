"use strict";

var path = require("path");
var _ = require("lodash");
var scripts = require("./scripts");

/**
 * Task wrapper.
 *
 * @param {Array} argv Arguments array (Default: `process.argv`)
 */
var Task = module.exports = function (argv) {
  argv = argv || process.argv;

  // Infer parts.
  this.script = argv[1];
  this.action = argv[2];
  this.command = argv[3];
  this.args = argv.slice(4);

  // Validation.
  if (!_.contains(this.ACTIONS, this.action)) {
    throw new Error("Invalid action: " + this.action +
      " - Valid actions: " + this.ACTIONS.join(", "));
  }
};

Task.prototype.ACTIONS = ["run", "help"];

Task.prototype.toString = function () {
  var args = this.args.join(" ,");
  return this.action + " " + this.command + (args ? " (" + args + ")" : "");
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
  var task = scripts.cwd[this.command];

  // Go to archetype if passthrough or not found.
  if (!task || this.isPassthrough(task)) {
    task = scripts.archetype[this.command];
  }

  // Error out if still can't find task.
  if (!task) {
    throw new Error("Unable to find task for: " + this.command);
  }

  return task;
};
