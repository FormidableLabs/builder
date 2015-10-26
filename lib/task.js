"use strict";

var path = require("path");
var _ = require("lodash");
var chalk = require("chalk");
var Environment = require("../lib/environment");
var runner = require("./runner");
var log = require("./log");

/**
 * Task wrapper.
 *
 * @param {Object} opts         Options object
 * @param {Object} opts.config  Configuration object
 * @param {Object} opts.env     Environment object to mutate (Default `process.env`)
 * @param {Array}  opts.argv    Arguments array (Default: `process.argv`)
 * @returns {void}
 */
var Task = module.exports = function (opts) {
  opts = opts || {};

  // Options.
  this.config = opts.config;
  this.env = opts.env || new Environment();

  // Infer parts.
  var argv = opts.argv || process.argv;
  this.script = argv[1];
  this.action = argv[2];
  this.command = argv[3];
  this.commands = argv.slice(3);

  // Validation.
  if (!this.config) {
    throw new Error("Configuration object required");
  }
  if (!_.contains(this.ACTIONS, this.action)) {
    throw new Error("Invalid action: " + this.action +
      " - Valid actions: " + this.ACTIONS.join(", "));
  }
};

Task.prototype.ACTIONS = ["run", "help", "concurrent"];

Task.prototype.toString = function () {
  var cmd = this.command;
  if (this.action === "concurrent") {
    cmd = this.commands.join(", ");
  }

  return this.action + " " + cmd;
};

/**
 * Is this task a simple passthrough to another builder command?
 *
 * @param   {String} task   Task
 * @returns {Boolean}       Is this task a passthrough?
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
 * @param   {String} cmd  Script command
 * @returns {String}      String to execute
 */
Task.prototype.getCommand = function (cmd) {
  // Select first non-passthrough command.
  var task = _.find(this.config.getCommands(cmd), function (curCmd) {
    /*eslint-disable no-invalid-this*/
    return !this.isPassthrough(curCmd);
  }, this);

  // Error out if still can't find task.
  if (!task) {
    throw new Error("Unable to find task for: " + cmd);
  }

  return task;
};

/**
 * Execute task or tasks.
 *
 * @param   {Object}   env        Environment object
 * @param   {Function} callback   Callback function `(err)`
 * @returns {void}
 */
Task.prototype.execute = function (env, callback) {
  if (!env) {
    throw new Error("Requires `env`");
  }

  if (this.action === "help") {
    log.info("help",
      "\n\n" + chalk.green.bold("Usage") + ": \n\n  builder [action] [task]" +
      "\n\n" + chalk.green.bold("Actions") + ": \n\n  " + this.ACTIONS.join(", ") +
      "\n\n" + chalk.green.bold("Tasks") + ": \n" + this.config.displayScripts());
    return callback();
  }

  if (this.action === "run") {
    var task = this.getCommand(this.command);
    log.info(this.action, this.command + chalk.gray(" - " + task));
    return runner.run(env, task, callback);
  }

  if (this.action === "concurrent") {
    var cmds = this.commands;
    var tasks = cmds.map(this.getCommand.bind(this));
    log.info(this.action, cmds.join(", ") + tasks.map(function (t, i) {
      return "\n * " + cmds[i] + chalk.gray(" - " + t);
    }).join(""));
    return runner.concurrent(env, tasks, callback);
  }

  callback(new Error("Unrecognized action: " + this.action));
};
