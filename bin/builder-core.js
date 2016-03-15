"use strict";

var chalk = require("chalk");

var Config = require("../lib/config");
var Environment = require("../lib/environment");
var Task = require("../lib/task");
var runner = require("../lib/runner");
var log = require("../lib/log");

// TODO: HERE DEBUGORAMA
/*eslint-disable no-console*/
console.log("TODO HERE PATH\n", "NODE_PATH=" + process.env.NODE_PATH);
console.log("TODO HERE LODASH\n", require.resolve("lodash"));
/*eslint-enable no-console*/

/**
 * Builder runner.
 *
 * @param {Object}    [opts]      Options object
 * @param {Object}    [opts.env]  Environment object to mutate (Default `process.env`)
 * @param {Array}     [opts.argv] Arguments array (Default: `process.argv`)
 * @param {Array}     [opts.msgs] Array of log messages (`{ level, type, msg }`)
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

  // Set up logger state.
  log.setLevel({
    env: env,
    argv: opts.argv
  });

  // Drain outer `builder` messages manually (may be global or locally-sourced).
  (opts.msgs || []).forEach(function (obj) {
    log[obj.level](obj.type, obj.msg);
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
