"use strict";

/**
 * Argv command flags.
 */
var path = require("path");
var _ = require("lodash");
var nopt = require("nopt");
var chalk = require("chalk");
var pkg = require("../package.json");

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
var FLAG_SETUP = {
  desc: "Single task to run for the entirety of <action>.",
  types: [String],
  default: function (val) { return val || null; }
};
var FLAG_BAIL = {
  desc: "End all processes after the first failure (default: `true`)",
  types: [Boolean],
  default: true
};
var FLAG_EXPAND_ARCHETYPE = {
  desc: "Expand occurences of `node_modules/<archetype>` with full path (default: `false`)",
  types: [Boolean],
  default: false
};
var FLAG_HELP = {
  desc: "Display help and exit",
  types: [Boolean],
  default: false
};
var FLAG_VERSION = {
  desc: "Display version and exit",
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
    },
    help: FLAG_HELP,
    version: FLAG_VERSION,
    quiet: {
      desc: "Silence logging",
      types: [Boolean],
      default: false
    },
    "log-level": {
      desc: "Level to log at (`info`, `warn`, `error`, `none`)",
      types: [String],
      default: "info"
    }
  },

  run: {
    "expand-archetype": FLAG_EXPAND_ARCHETYPE,
    tries: FLAG_TRIES,
    setup: FLAG_SETUP
  },

  concurrent: {
    "expand-archetype": FLAG_EXPAND_ARCHETYPE,
    tries: FLAG_TRIES,
    setup: FLAG_SETUP,
    queue: FLAG_QUEUE,
    buffer: FLAG_BUFFER,
    bail: FLAG_BAIL
  },

  envs: {
    "expand-archetype": FLAG_EXPAND_ARCHETYPE,
    tries: FLAG_TRIES,
    setup: FLAG_SETUP,
    queue: FLAG_QUEUE,
    buffer: FLAG_BUFFER,
    bail: FLAG_BAIL,
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

/**
 * Retrieve version.
 *
 * @returns {String}          Version string
 */
var version = function () {
  return pkg.version;
};

// Option parser.
var createFn = function (flags) {
  var opts = getOpts(flags);

  return function (argv) {
    argv = argv || process.argv;

    // Capture any flags after `--` like `npm run <task> -- <args>` does.
    // See: https://docs.npmjs.com/cli/run-script#description
    var customFlags = [];
    var customIdx = argv.indexOf("--");
    if (customIdx > -1) {
      // Update custom args.
      customFlags = argv.slice(customIdx + 1);

      // Remove custom args from input.
      argv = argv.slice(0, customIdx);
    }

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

    return _(parsedOpts)
      // Camel-case flags.
      .mapKeys(function (val, key) { return _.camelCase(key); })
      // Add in custom flags if found earlier.
      .merge(customFlags.length > 0 ? { _customFlags: customFlags } : {})
      .value();
  };
};

module.exports = _.extend({
  FLAGS: FLAGS,
  help: help,
  version: version
}, _.mapValues(FLAGS, function (flags) {
  // Add in `KEY()` methods.
  return createFn(flags);
}));
