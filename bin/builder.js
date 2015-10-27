#!/usr/bin/env node
"use strict";

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
task.execute(function (err) {
  /*eslint-disable no-process-exit*/
  process.exit(err ? err.code || 1 : 0);
});
