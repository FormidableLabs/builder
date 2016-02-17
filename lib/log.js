"use strict";

var chalk = require("chalk");

// Wrap "type".
var wrapType = function (type) {
  return chalk.yellow("[TODO REMOVE ENV HACKS] ") + "[builder" + (type ? ":" + type : "") + "]";
};

/**
 * A super-small logger.
 */
module.exports = {
  // TODO(6): Configurable log levels.
  // https://github.com/FormidableLabs/builder/issues/6
  _logger: function () {
    return console;
  },

  info: function (type, msg) {
    this._logger().info([chalk.green(wrapType(type)), msg].join(" "));
  },

  warn: function (type, msg) {
    this._logger().warn([chalk.yellow(wrapType(type)), msg].join(" "));
  },

  error: function (type, msg) {
    this._logger().error([chalk.red(wrapType(type)), msg].join(" "));
  }
};
