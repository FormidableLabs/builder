"use strict";

/**
 * Setup task support.
 */
const _ = require("lodash");

const log = require("../log");
const Config = require("../config");
const Environment = require("../environment");
const Task = require("../task");
const runner = require("./runner");

/**
 * Add and invoke a setup task if present in options.
 *
 * @param {String}    taskName  Setup task name
 * @param {Object}    shOpts    Shell options
 * @returns {Object}            Process object or `null` if no setup.
 */
module.exports.create = function (taskName, shOpts) {
  if (!taskName) { return null; }
  log.debug("setup:start", `Starting setup task: ${taskName}`);

  // Create a `Task` object to just infer the _command_ we need.
  //
  // **Note**: Could refactor this out to a higher-level `create` method or
  // something that could be reused by `builder-core.js`
  const argv = [null, "builder", "run", taskName];
  const config = new Config({
    env: shOpts.env,
    argv
  });
  const env = new Environment({
    config,
    env: shOpts.env,
    argv
  });
  const task = new Task({
    config,
    env,
    argv
  });

  // Now, use the task to unpack and create a raw shell `run`.
  const main = task.getRunParams(this._command).main;

  // Finishing state.
  const done = _.once((code) => {
    code = code || 0;
    const level = code === 0 ? "info" : "error";
    log[level]("setup:end", `Setup command ended with code: ${code}`);
  });

  // Run it!
  const proc = runner.run(main.cmd, { env: env.env }, { argv }, done);
  proc.on("exit", done);

  return proc;
};
