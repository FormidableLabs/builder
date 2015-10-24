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
log.info("task", task.toString());

// Detect help
if (task.action === "help") {
  var tasks = require("../lib/scripts").display();
  log.info("help",
    "\n\nUsage: \n\n  builder [action] [task]" +
    "\n\nActions: \n\n  " + task.ACTIONS.join(", ") +
    "\n\nTasks: \n" + tasks);
  process.exit(0);
}

// Run the task
var runner = require("../lib/runner");
var cmd = task.getCommand();
runner.run(env, cmd);
