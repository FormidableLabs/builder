"use strict";

const chalk = require("chalk");
const args = require("./args");
const clone = require("./utils/clone");

// Wrap "type".
const wrapType = function (type) {
  return `[builder${type ? `:${type}` : ""}]`;
};

// Levels
const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4
};

/**
 * A super-small logger.
 */
const log = module.exports = {
  /**
   * Set log level from command flags or environment.
   *
   * **NOTE**: Clones object if real `process.env` to avoid mutation
   *
   * @param {Object} opts         Options object
   * @param {Object} opts.argv    Arguments array.
   * @param {Object} opts.env     Environment object to mutate (Default `process.env`)
   * @returns {void}
   */
  setLevel(opts) {
    opts = opts || {};

    // Clone if real process env to avoid direct mutation.
    log._env = opts.env && opts.env.env || log._env || process.env;
    if (log._env === process.env) {
      log._env = clone(log._env);
    }

    // Try to determine log level from environment.
    let level = log._env._BUILDER_ARGS_LOG_LEVEL;

    // If not, determine log level from command line.
    if (!level) {
      const parsed = args.general(opts.argv);
      level = parsed.quiet === true ? "none" : parsed.logLevel;
    }

    // Statefully set level.
    log._env._BUILDER_ARGS_LOG_LEVEL = level;
    log._level = LEVELS[level];
    if (typeof log._level === "undefined") {
      throw new Error(`Unknown log level: ${level}`);
    }

    // Drain message queue.
    log._drainQueue();
  },

  // Nuke everything for test runs.
  _unsetLevel() {
    if (log._env) {
      delete log._env._BUILDER_ARGS_LOG_LEVEL;
    }
    delete log._level;
    delete log._queue;
  },

  // Drain internal queue and emit log events.
  _drainQueue() {
    (log._queue || []).forEach((obj) => {
      log[obj.level](obj.type, obj.msg);
    });
    log._queue = null;
  },

  _logger() {
    return console;
  },

  _wrapper(level, color, type, msg) { // eslint-disable-line max-params
    // Queue if level is unset.
    //
    // **Scenario**: This queue is used when `log` has been imported from the
    // actual builder instance that is running. However, we have calls to log
    // events before we can call `log.setLevel`, so need to queue until that
    // happens.
    if (typeof log._level === "undefined") {
      log._queue = log._queue || [];
      log._queue.push({ level,
        type,
        msg });
      return;
    }

    // Should only get to here, _after_ `log.setlevel()` is imported.
    // Check if logging at this integer level.
    if (LEVELS[level] < log._level) {
      return;
    }

    // Switch to `console.log` friendly methods.
    // - `console.debug` won't normally output to stdout.
    level = level === "debug" ? "log" : level;

    // Call directly once level is set.
    // This is also used to drain the queue.
    const formattedMsg = [chalk[color](wrapType(type)), msg].join(" ");
    log._logger()[level](formattedMsg);
  }
};

// Actual implementation methods.
log.debug = log._wrapper.bind(log, "debug", "gray");
log.info = log._wrapper.bind(log, "info", "green");
log.warn = log._wrapper.bind(log, "warn", "yellow");
log.error = log._wrapper.bind(log, "error", "red");
