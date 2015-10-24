#!/usr/bin/env node

var log = require("../lib/log");

// Set up environment
var Environment = require("../lib/environment");
var env = new Environment();
env.updatePath();
// TODO: Abstract to archetype selection.
env.updateNodePath("node_modules/builder-react-component/node_modules");

// Infer task to run
var Task = require("../lib/task");
var task = new Task();

// Detect help
if (task.action === "help") {
  var tasks = require("../lib/scripts").display();
  log.info("help",
    "\n\nUsage: \n\n  builder [action] [task]" +
    "\n\nActions: \n\n  " + task.ACTIONS.join(", ") +
    "\n\nTasks: \n" + tasks);
  process.exit(0);
}

var cmd = task.getCommand();

// Run the task
// TODO: Decompose to `lib/runner.js`
var exec = require("child_process").exec;
var proc = exec(cmd, {
  env: env.env
}, function (err) {
  if (err) {
    log.error("error", "Failure: " + cmd);
    process.exit(err.code || 1);
  }
});

proc.stdout.pipe(process.stdout, { end: false });
proc.stderr.pipe(process.stderr, { end: false });

// TODO: Move around logger.
log.info("task", task.toString());
log.info("exec", cmd);
