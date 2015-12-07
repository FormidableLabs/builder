"use strict";

/**
 * Argv command flags.
 */
var path = require("path");
var _ = require("lodash");
var nopt = require("nopt");
var chalk = require("chalk");

// Generic flags:
var FLAG_TRIES = {
  desc: "Number of times to attempt a task (default: `1`)",
  types: [Number],
  default: function (val) { return val > 0 ? val : 1; }
};
var FLAG_QUEUE = {
  desc: "Number of concurrent processes to run (default: unlimited - `0|null`)",
  types: [Number],
  default: function (val) { return val > 0 ? val : null; }
};
var FLAG_BUFFER = {
  desc: "Buffer output until process end (default: `false`)",
  types: [Boolean],
  default: false
};

// Option flags.
var FLAGS = {
  // Global: Should apply across any action.
  general: {
    builderrc: {
      desc: "Path to builder config file (default: `.builderrc`)",
      types: [path],
      default: ".builderrc"
    }
  },

  run: {
    tries: FLAG_TRIES
  },

  concurrent: {
    tries: FLAG_TRIES,
    queue: FLAG_QUEUE,
    buffer: FLAG_BUFFER
  },

  envs: {
    tries: FLAG_TRIES,
    queue: FLAG_QUEUE,
    buffer: FLAG_BUFFER,
    "envs-path": {
      desc: "Path to JSON env variable array file (default: `null`)",
      types: [path],
      default: null
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
var createFn = function (flags) {
  var opts = getOpts(flags);

  return function (argv) {
    argv = argv || process.argv;

    // Parse.
    var parsedOpts = nopt(opts, {}, argv);

    // Inject defaults and mutate parsed object.
    _.extend(parsedOpts, _.mapValues(flags, function (val, key) {
      var parsedVal = parsedOpts[key];

      if (_.isFunction(val.default)) {
        return val.default(parsedVal);
      }

      return _.isUndefined(parsedVal) ? val.default : parsedVal;
    }));

    // Camel-case flags.
    return _.mapKeys(parsedOpts, function (val, key) {
      return _.camelCase(key);
    });
  };
};

module.exports = _.extend({
  FLAGS: FLAGS,
  help: help
}, _.mapValues(FLAGS, function (flags) {
  // Add in `KEY()` methods.
  return createFn(flags);
}));
