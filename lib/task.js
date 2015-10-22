"use strict";

var path = require("path");

// Load local `package.json`.
// TODO: Protect on import error.
var CWD_PKG = require(path.join(process.cwd(), "package.json"));

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

  // Select task.
  this.task = (CWD_PKG.scripts || {})[this.command];
  if (!this.task) {
    throw new Error("Cannot find task: " + this.command);
  }
};

/**
 * Is this task a simple passthrough to another builder command?
 *
 * @returns {Boolean} Is this task a passthrough?
 */
Task.prototype.isPassthrough = function () {
  var builder = path.basename(this.script);
  var taskBin = this.task.split(/\s+/)[0];

  // Note: Assumes a binary script match without `.js` extension.
  return builder === taskBin;
};

/**
 * Get executable command.
 *
 * @returns {String} String to execute
 */
Task.prototype.getCommand = function () {
  return this.isPassthrough ?
    this.task :
    "echo TODO: " + JSON.stringify(this.task);
};
