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
  task.execute(callback);
};
