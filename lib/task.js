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
  this._config = opts.config;
  this._env = opts.env || new Environment();

  // Infer parts.
  var argv = opts.argv || process.argv;
  this._script = argv[1];
  this._action = argv[2];
  this._command = argv[3];
  this._commands = argv.slice(3);

  // Validation.
  if (!this._config) {
    throw new Error("Configuration object required");
  }
  if (!_.contains(this.ACTIONS, this._action)) {
    throw new Error("Invalid action: " + this._action +
      " - Valid actions: " + this.ACTIONS.join(", "));
  }
};

Task.prototype.ACTIONS = ["help", "run", "concurrent", "install"];

Task.prototype.toString = function () {
  var cmd = this._command;
  if (this._action === "concurrent") {
    cmd = this._commands.join(", ");
  }

  return this._action + " " + cmd;
};

/**
 * Is this task a simple passthrough to another builder command?
 *
 * @param   {String} task   Task
 * @returns {Boolean}       Is this task a passthrough?
 */
Task.prototype.isPassthrough = function (task) {
  var builder = path.basename(this._script);
  var taskParts = task.split(/\s+/);
  var taskBin = taskParts[0];
  var taskAction = taskParts[1];
  var taskCommand = taskParts[2];

  // Note: Assumes a binary script match without `.js` extension.
  return builder === taskBin &&
    this._action === taskAction &&
    this._command === taskCommand;
};

/**
 * Get executable command.
 *
 * @param   {String} cmd  Script command
 * @returns {String}      String to execute
 */
Task.prototype.getCommand = function (cmd) {
  // Select first non-passthrough command.
  var task = _.find(this._config.getCommands(cmd), function (curCmd) {
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
 * Help.
 *
 * ```sh
 * $ builder help [ARCHETYPE, ARCHETYPE]
 * ```
 *
 * @param   {Function} callback   Callback function `(err)`
 * @returns {void}
 */
Task.prototype.help = function (callback) {
  // Arguments after `help` are archetypes.
  var archetypes = this._commands;

  log.info("help",
    "\n\n" + chalk.green.bold("Usage") + ": \n\n  builder [action] [task]" +
    "\n\n" + chalk.green.bold("Actions") + ": \n\n  " + this.ACTIONS.join(", ") +
    "\n\n" + chalk.green.bold("Tasks") + ": \n" + this._config.displayScripts(archetypes));

  callback();
};

/**
 * Run.
 *
 * @param   {Function} callback   Callback function `(err)`
 * @returns {void}
 */
Task.prototype.run = function (callback) {
  var env = this._env.env; // Raw environment object.
  var task = this.getCommand(this._command);

  log.info(this._action, this._command + chalk.gray(" - " + task));

  runner.run(task, { env: env }, callback);
};

/**
 * Concurrent.
 *
 * @param   {Function} callback   Callback function `(err)`
 * @returns {void}
 */
Task.prototype.concurrent = function (callback) {
  var env = this._env.env; // Raw environment object.
  var cmds = this._commands;
  var tasks = cmds.map(this.getCommand.bind(this));

  log.info(this._action, cmds.join(", ") + tasks.map(function (t, i) {
    return "\n * " + cmds[i] + chalk.gray(" - " + t);
  }).join(""));

  runner.concurrent(tasks, { env: env }, callback);
};

/**
 * Install dev dependencies of archetypes.
 *
 * @param   {Function} callback   Callback function `(err)`
 * @returns {void}
 */
Task.prototype.install = function (callback) {
  var env = this._env.env; // Raw environment object.
  var paths = this._config.archetypeNodePaths;

  log.info(this._action, "Install dev dependencies for:" + paths.map(function (p) {
    return "\n * " + chalk.gray(p);
  }).join(""));

  runner.install(paths, { env: env }, callback);
};

/**
 * Execute task or tasks.
 *
 * @param   {Function} callback   Callback function `(err)`
 * @returns {void}
 */
Task.prototype.execute = function (callback) {
  // Check task action method exists.
  if (!this[this._action]) {
    return callback(new Error("Unrecognized action: " + this._action));
  }

  // Call action.
  this[this._action](callback);
};
