"use strict";

var chalk = require("chalk");

// TODO: Configure level...
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

  error: function (type, msg) {
    cons.error([chalk.red(wrapType(type)), msg].join(" "));
  }
};
