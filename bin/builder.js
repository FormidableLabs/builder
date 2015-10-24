#!/usr/bin/env node
"use strict";

// Set up environment
var Environment = require("../lib/environment");
var env = new Environment();
env.updatePath();
// TODO: Abstract to archetype selection.
env.updateNodePath("node_modules/builder-react-component/node_modules");

// Infer task to run
var Task = require("../lib/task");
var task = new Task();

// Run the task
task.execute(env, function (err) {
  /*eslint-disable no-process-exit*/
  process.exit(err ? err.code || 1 : 0);
});
