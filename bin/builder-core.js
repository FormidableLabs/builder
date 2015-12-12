"use strict";

module.exports = function (callback) {
  /*eslint-disable global-require*/
  // Configuration
  var Config = require("../lib/config");
  var config = new Config();

  // Set up environment
  var Environment = require("../lib/environment");
  var env = new Environment({
    config: config
  });

  // Infer task to run
  var Task = require("../lib/task");
  var task = new Task({
    config: config,
    env: env
  });

  // Run the task
  var chalk = require("chalk");
  var log = require("../lib/log");

  log.info("builder-core:start:" + process.pid, "Started: " + chalk.gray(task));
  task.execute(function (err) {
    if (err) {
      log.error("builder-core:end:" + process.pid,
        "Ended with error: " + chalk.gray(task) + " - " + chalk.red(err.message.split("\n")[0]));
    } else {
      log.info("builder-core:end:" + process.pid, "Ended normally: " + chalk.gray(task));
    }

    callback(err);
  });
};
