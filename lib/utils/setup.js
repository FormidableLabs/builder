"use strict";

/**
 * Setup task support.
 */
var _ = require("lodash");

var log = require("../log");
var Config = require("../config");
var Environment = require("../environment");
var Task = require("../task");
var runner = require("./runner");

/**
 * Add and invoke a setup task if present in options.
 *
 * @param {String}    taskName  Setup task name
 * @param {Object}    shOpts    Shell options
 * @returns {Object}            Process object or `null` if no setup.
 */
module.exports.create = function (taskName, shOpts) {
  if (!taskName) { return null; }
  log.debug("setup:start", "Starting setup task: " + taskName);

  // Create a `Task` object to just infer the _command_ we need.
  //
  // **Note**: Could refactor this out to a higher-level `create` method or
  // something that could be reused by `builder-core.js`
  var argv = [null, "builder", "run", taskName];
  var config = new Config({
    env: shOpts.env,
    argv: argv
  });
  var env = new Environment({
    config: config,
    env: shOpts.env,
    argv: argv
  });
  var task = new Task({
    config: config,
    env: env,
    argv: argv
  });

  // Now, use the task to unpack and create a raw shell `run`.
  var main = task.getRunParams(this._command).main;

  // Finishing state.
  var done = _.once(function (code) {
    code = code || 0;
    var level = code === 0 ? "info" : "error";
    log[level]("setup:end", "Setup command ended with code: " + code);
  });

  // Run it!
  var proc = runner.run(main.cmd, { env: env.env }, { argv: argv }, done);
  proc.on("exit", done);

  return proc;
};
