"use strict";

/**
 * Argv command flags.
 */
var path = require("path");
var _ = require("lodash");
var nopt = require("nopt");
var chalk = require("chalk");

// Option flags.
var FLAGS = {
  // Global: Should apply across any action.
  general: {
    builderrc: {
      desc: "Path to builder config file (default: `.builderrc`)",
      types: [path]
    }
  },

  run: {
    tries: {
      desc: "Number of times to attempt a task (default: `1`)",
      types: [Number]
    }
  }
};

// Convert our bespoke flags object into `nopt` options.
var getOpts = function (obj) {
  return _.mapValues(obj, function (val) {
    return val.types;
  });
};

/**
 * Retrieve help.
 *
 * @param   {String} flagKey  Key of flags to return or `undefined` for general
 * @returns {String}          Help string
 */
var help = function (flagKey) {
  var flags = _.isUndefined(flagKey) ? FLAGS.general : FLAGS[flagKey];

  return !flags ? "" : _.map(flags, function (val, key) {
    return chalk.cyan("--" + key) + ": " + val.desc;
  }).join("\n\n  ");
};

// Option parser.
var createFn = function (opts) {
  return function (argv) {
    argv = argv || process.argv;

    return nopt(opts, {}, argv);
  };
};

module.exports = _.extend({
  FLAGS: FLAGS,
  help: help
}, _.mapValues(FLAGS, function (val) {
  // Add in `KEY()` methods.
  return createFn(getOpts(val));
}));
