"use strict";

const chalk = require("chalk");

const Config = require("../lib/config");
const Environment = require("../lib/environment");
const Task = require("../lib/task");
const log = require("../lib/log");

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
  callback = arguments.length === 2 ? callback : opts; // eslint-disable-line no-magic-numbers
  opts = (arguments.length === 2 ? opts : {}) || {}; // eslint-disable-line no-magic-numbers

  // Configuration
  const config = new Config({
    env: opts.env,
    argv: opts.argv
  });

  // Set up environment
  const env = new Environment({
    config,
    env: opts.env,
    argv: opts.argv
  });

  // Set up logger state.
  log.setLevel({
    env,
    argv: opts.argv
  });

  // Drain outer `builder` messages manually (may be global or locally-sourced).
  (opts.msgs || []).forEach((obj) => {
    log[obj.level](obj.type, obj.msg);
  });

  // Infer task to run
  const task = new Task({
    config,
    env,
    argv: opts.argv
  });

  // Run the task
  log.info(`builder-core:start:${process.pid}`, `Started: ${chalk.gray(task)}`);
  task.execute((err) => {
    if (err) {
      log.error(`builder-core:end:${process.pid}`,
        `Task: ${chalk.gray(task)}, Error: ${chalk.red(err.message)}`);
    } else {
      log.info(`builder-core:end:${process.pid}`, `Task: ${chalk.gray(task)} ended normally`);
    }

    callback(err);
  });
};
