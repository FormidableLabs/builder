"use strict";

var chalk = require("chalk");

// TODO(6): Configurable log levels.
// https://github.com/FormidableLabs/builder/issues/6
var cons = console;

// Wrap "type".
var wrapType = function (type) {
  return "[builder" + (type ? ":" + type : "") + "]";
};

/**
 * A super-small logger.
 */
module.exports = {
  info: function (type, msg) {
    cons.log([chalk.green(wrapType(type)), msg].join(" "));
  },

  warn: function (type, msg) {
    cons.warn([chalk.yellow(wrapType(type)), msg].join(" "));
  },

  error: function (type, msg) {
    cons.error([chalk.red(wrapType(type)), msg].join(" "));
  }
};
