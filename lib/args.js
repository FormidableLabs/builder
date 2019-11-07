"use strict";

/* eslint max-statements:[2, 30]*/

/**
 * Argv command flags.
 */
const path = require("path");
const _ = require("lodash");
const nopt = require("nopt");
const chalk = require("chalk");
const pkg = require("../package.json");

// Generic flags:
const FLAG_TRIES = {
  desc: "Number of times to attempt a task (default: `1`)",
  types: [Number],
  "default"(val) { return val > 0 ? val : 1; }
};
const FLAG_QUEUE = {
  desc: "Number of concurrent processes to run (default: unlimited - `0|null`)",
  types: [Number],
  "default"(val) { return val > 0 ? val : null; }
};
const FLAG_BUFFER = {
  desc: "Buffer output until process end (default: `false`)",
  types: [Boolean],
  "default": false
};
const FLAG_SETUP = {
  desc: "Single task to run for the entirety of <action>.",
  types: [String],
  "default"(val) { return val || null; }
};
const FLAG_BAIL = {
  desc: "End all processes after the first failure (default: `true`)",
  types: [Boolean],
  "default": true
};
const FLAG_EXPAND_ARCHETYPE = {
  desc: "Expand occurences of `node_modules/<archetype>` with full path (default: `false`)",
  types: [Boolean],
  "default": false
};
const FLAG_HELP = {
  desc: "Display help and exit",
  types: [Boolean],
  "default": false
};
const FLAG_VERSION = {
  desc: "Display version and exit",
  types: [Boolean],
  "default": false
};

// Option flags.
const FLAGS = {
  // Global: Should apply across any action.
  general: {
    builderrc: {
      desc: "Path to builder config file (default: `.builderrc`)",
      types: [path],
      "default": ".builderrc"
    },
    help: FLAG_HELP,
    version: FLAG_VERSION,
    quiet: {
      desc: "Silence logging",
      types: [Boolean],
      "default": false
    },
    "log-level": {
      desc: "Level to log at (`debug`, `info`, `warn`, `error`, `none`)",
      types: [String],
      "default": "error"
    },
    env: {
      desc: "JSON string of environment variables to add to process",
      types: [String],
      "default": null
    },
    "env-path": {
      desc: "JSON file path of environment variables to add to process",
      types: [path],
      "default": null
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
      desc: "JSON File path to `envs` array",
      types: [path],
      "default": null
    }
  }
};

// Get all possible flag fields.
const FLAGS_ALL_FIELDS = _.chain(FLAGS) // Use `_.chain` not `_()` because of `reduce`
  .values()
  .reduce((memo, obj) => memo.concat(_.keys(obj)), [])
  .uniq()
  .value();

// Convert our bespoke flags object into `nopt` options.
const getOpts = function (obj) {
  return _.mapValues(obj, (val) => val.types);
};

/**
 * Retrieve help.
 *
 * @param   {String} flagKey  Key of flags to return or `undefined` for general
 * @returns {String}          Help string
 */
const help = function (flagKey) {
  const flags = _.isUndefined(flagKey) ? FLAGS.general : FLAGS[flagKey];

  return !flags ? "" : _.map(
    flags, (val, key) => `${chalk.cyan(`--${key}`)}: ${val.desc}`).join("\n\n  "
  );
};

/**
 * Retrieve version.
 *
 * @returns {String}          Version string
 */
const version = function () {
  return pkg.version;
};

// Option parser.
const createFn = function (flags, isGeneral) {
  const opts = getOpts(flags);
  const flagKeys = _.keys(flags);

  // eslint-disable-next-line complexity
  return function (argv) {
    argv = argv || process.argv;
    const unparsedArgv = argv;

    // Capture any flags after `--` like `npm run <task> -- <args>` does.
    // See: https://docs.npmjs.com/cli/run-script#description
    let customFlags = [];
    const customIdx = argv.indexOf("--");
    if (customIdx > -1) {
      // Update custom args.
      customFlags = argv.slice(customIdx + 1);

      // Remove custom args from input.
      argv = argv.slice(0, customIdx);
    }

    // Parse.
    const parsedOpts = nopt(opts, {}, argv);

    // Hack in unparsed for pristine version.
    parsedOpts.argv.unparsed = unparsedArgv;

    // Stash if log-level was actually set.
    const logLevel = parsedOpts["log-level"];

    // Inject defaults and mutate parsed object.
    _.extend(parsedOpts, _.mapValues(flags, (val, key) => {
      const parsedVal = parsedOpts[key];

      if (_.isFunction(val.default)) {
        return val.default(parsedVal);
      }

      return _.isUndefined(parsedVal) ? val.default : parsedVal;
    }));

    // Update options for _command_ of `help`, `` (nothing = help), `version`
    if (parsedOpts.argv.remain[0] === "version") {
      parsedOpts.version = true;
    }
    if (!parsedOpts.version
      && (parsedOpts.argv.remain.length === 0 || parsedOpts.argv.remain[0] === "help")) {
      parsedOpts.help = true;
    }

    // If `help` or `version`, silence log if not explicitly set.
    // https://github.com/FormidableLabs/builder/issues/127
    if ((parsedOpts.help || parsedOpts.version) && !logLevel) {
      parsedOpts["log-level"] = "none";
    }

    // Validate no invalid or ambiguous flags.

    const parsedKeys = _(parsedOpts).keys().without("argv").value();
    let extraKeys = _.difference(parsedKeys, flagKeys);
    if (isGeneral) {
      // If the general command, allow flags from *any* other action.
      // We'll eventually hit the right action with tighter enforcement.
      extraKeys = _.difference(extraKeys, FLAGS_ALL_FIELDS);
    }
    if (extraKeys.length) {
      throw new Error(`Found invalid/conflicting keys: ${extraKeys.join(", ")}`);
    }

    return _(parsedOpts)
      // Camel-case flags.
      .mapKeys((val, key) => _.camelCase(key))
      // Add in custom flags if found earlier.
      .merge(customFlags.length > 0 ? { _customFlags: customFlags } : {})
      .value();
  };
};

module.exports = _.extend({
  FLAGS,
  help,
  version
}, _.mapValues(FLAGS, (flags, key) => {
  // Merge in general flags to all other configs.
  const isGeneral = key === "general";
  flags = isGeneral ? flags : _.extend({}, FLAGS.general, flags);

  // Add in `KEY()` methods.
  return createFn(flags, isGeneral);
}));
