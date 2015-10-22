#!/usr/bin/env node

// Set up environment
var Environment = require("../lib/environment");
var env = new Environment();
env.updatePath();

// Infer task to run
var Task = require("../lib/task");
var task = new Task();
var cmd = task.getCommand();

// Run the task
// TODO: Decompose to `lib/runner.js`
var exec = require("child_process").exec;
var proc = exec(cmd, {
  env: env.env
}, function (err) {
  if (err) { process.exit(err.code); }
});

proc.stdout.pipe(process.stdout, { end: false });
proc.stderr.pipe(process.stderr, { end: false });
