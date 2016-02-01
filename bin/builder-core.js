"use strict";

var chalk = require("chalk");

var Config = require("../lib/config");
var Environment = require("../lib/environment");
var Task = require("../lib/task");
var runner = require("../lib/runner");
var log = require("../lib/log");

/**
 * Builder runner.
 *
 * @param {Object}    [opts]      Options object
 * @param {Object}    [opts.env]  Environment object to mutate (Default `process.env`)
 * @param {Array}     [opts.argv] Arguments array (Default: `process.argv`)
 * @param {Function}  callback    Callback `(err)`
 * @returns {void}
 */
module.exports = function (opts, callback) {
  callback = arguments.length === 2 ? callback : opts;
  opts = (arguments.length === 2 ? opts : {}) || {};

  // Configuration
  var config = new Config();

  // Set up environment
  var env = new Environment({
    config: config,
    env: opts.env
  });

  // Infer task to run
  var task = new Task({
    config: config,
    env: env,
    argv: opts.argv,
    runner: runner
  });

  // Run the task
  log.info("builder-core:start:" + process.pid, "Started: " + chalk.gray(task));
  task.execute(function (err) {
    if (err) {
      log.error("builder-core:end:" + process.pid,
        "Task: " + chalk.gray(task) + ", Error: " + chalk.red(err.message));
    } else {
      log.info("builder-core:end:" + process.pid, "Task: " + chalk.gray(task) + " ended normally");
    }

    callback(err);
  });
};
