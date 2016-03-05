"use strict";

var chalk = require("chalk");
var args = require("./args");

// Wrap "type".
var wrapType = function (type) {
  return "[builder" + (type ? ":" + type : "") + "]";
};

// Levels
var LEVELS = {
  info: 0,
  warn: 1,
  error: 2,
  none: 3
};

/**
 * A super-small logger.
 */
var log = module.exports = {
  /**
   * Set log level from command flags or environment.
   *
   * **NOTE - Side Effects**: Mutates environment.
   *
   * @param {Object} opts         Options object
   * @param {Object} opts.argv    Arguments array.
   * @param {Object} opts.env     Environment object to mutate (Default `process.env`)
   * @returns {void}
   */
  setLevel: function (opts) {
    opts = opts || {};
    var env = opts.env && opts.env.env || process.env;

    // Try to determine log level from environment.
    var level = env._BUILDER_ARGS_LOG_LEVEL;

    // If not, determine log level from command line.
    if (!level) {
      var parsed = args.general(opts.argv);
      level = parsed.quiet === true ? "none" : parsed.logLevel;
    }

    // Statefully set level.
    env._BUILDER_ARGS_LOG_LEVEL = level;
    log._level = LEVELS[level];
    if (typeof log._level === "undefined") {
      throw new Error("Unknown log level: " + level);
    }

    // Drain message queue.
    log._drainQueue();
  },

  // Nuke everything for test runs.
  _unsetLevel: function () {
    delete process.env._BUILDER_ARGS_LOG_LEVEL;
    delete log._level;
    delete log._queue;
  },

  // Drain internal queue and emit log events.
  _drainQueue: function () {
    (log._queue || []).forEach(function (obj) {
      log[obj.level](obj.type, obj.msg);
    });
    log._queue = null;
  },

  _logger: function () {
    return console;
  },

  _wrapper: function (level, color, type, msg) { // eslint-disable-line max-params
    // Queue if level is unset.
    //
    // **Scenario**: This queue is used when `log` has been imported from the
    // actual builder instance that is running. However, we have calls to log
    // events before we can call `log.setLevel`, so need to queue until that
    // happens.
    if (typeof log._level === "undefined") {
      log._queue = log._queue || [];
      log._queue.push({ level: level, type: type, msg: msg });
      return;
    }

    // Should only get to here, _after_ `log.setlevel()` is imported.
    // Check if logging at this integer level.
    if (LEVELS[level] < log._level) {
      return;
    }

    // Call directly once level is set.
    // This is also used to drain the queue.
    var formattedMsg = [chalk[color](wrapType(type)), msg].join(" ");
    log._logger()[level](formattedMsg);
  }
};

// Actual implementation methods.
log.info = log._wrapper.bind(log, "info", "green");
log.warn = log._wrapper.bind(log, "warn", "yellow");
log.error = log._wrapper.bind(log, "error", "red");
