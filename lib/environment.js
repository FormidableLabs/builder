"use strict";

/**
 * Environment enhancements.
 *
 * We augment the current environment with additional paths to encompass
 * Builder paths.
 */
const _ = require("lodash");
const path = require("path");
const args = require("./args");
const clone = require("./utils/clone");
const jsonParse = require("./utils/json").parse;

// OS-specific helpers
const IS_WIN = process.platform.indexOf("win") === 0;
const DELIM = IS_WIN ? ";" : ":";
const ENV_PATH_NAME = IS_WIN ? "Path" : "PATH";
const splitPath = function (val) {
  return (val || "").split(DELIM).filter(Boolean);
};

// Filter to unique values.
// Simple, but inefficient `O(n^2)`.
const uniqueVals = function (val, i, vals) { return vals.indexOf(val) === i; };

// Node directories.
const CWD_BIN = path.resolve("node_modules/.bin");
const CWD_NODE_PATH = path.resolve("node_modules");

/**
 * Environment wrapper.
 *
 * **NOTE**: Clones object if real `process.env` to avoid mutation
 *
 * @param {Object} opts         Options object
 * @param {Object} opts.config  Configuration object
 * @param {Object} opts.argv    Argv object (Default `process.argv`)
 * @param {Object} opts.env     Environment object to mutate (Default `process.env`)
 * @returns {void}
 */
const Environment = module.exports = function (opts) {
  opts = opts || {};
  this.config = opts.config;

  // Arguments
  this.argv = opts.argv || process.argv;
  const parsed = args.general(this.argv);

  // Clone if real process env to avoid direct mutation.
  this.env = opts.env || process.env;
  if (this.env === process.env) {
    this.env = clone(this.env);
  }

  // Chalk: Force colors.
  this.env.FORCE_COLOR = "true";

  // Validation
  if (!this.config) {
    throw new Error("Configuration object required");
  }

  // Mutate environment paths.
  this.env.PATH = this.env[ENV_PATH_NAME] = this.updatePath(this.config.archetypePaths);
  this.env.NODE_PATH = this.updateNodePath(this.config.archetypeNodePaths);

  // Add in npm config environment variables.
  this.updateConfigVars(this.config.pkgConfigs);

  // Add command-line `--env|--env-path` environment overrides.
  this.updateEnvFlag(parsed);
};

/**
 * Update `PATH` variable with CWD, archetype Node binary paths
 *
 * Resolution order:
 * 1. `ROOT/node_modules/ARCHETYPE[1-n]/node_modules/.bin`
 * 2. `ROOT/node_modules/.bin`
 * 3. existing `PATH`
 *
 * @param   {Array}   archetypePaths  Archetype `.bin` paths
 * @returns {String}                  `PATH` environment variable
 */
Environment.prototype.updatePath = function (archetypePaths) {
  return []
    .concat(archetypePaths || [])
    .concat([CWD_BIN])
    .concat(splitPath(this.env[ENV_PATH_NAME]))
    .concat(splitPath(this.env.PATH))
    .filter(uniqueVals)
    .join(DELIM);
};

/**
 * Update `NODE_PATH` variable with CWD, archetype paths
 *
 * Resolution order:
 * 1. `ROOT/node_modules/ARCHETYPE[1-n]/node_modules/`
 * 2. `ROOT/node_modules/`
 * 3. existing `NODE_PATH`
 *
 * @param   {Array}   archetypeNodePaths  Archetype `node_module` paths
 * @returns {String}                      `NODE_PATH` environment variable
 * @see https://nodejs.org/api/modules.html
 */
Environment.prototype.updateNodePath = function (archetypeNodePaths) {
  return []
    .concat(archetypeNodePaths || [])
    .concat([CWD_NODE_PATH])
    .concat(splitPath(this.env.NODE_PATH))
    .filter(uniqueVals)
    .join(DELIM);
};

/**
 * Update environment with configuration variables from package.json
 *
 * Resolution order:
 * 1. Existing environment
 * 2. `ROOT/package.json:config`
 * 3. `ROOT/node_modules/ARCHETYPE[1-n]/package.json:config`
 *
 * @param   {Object}   pkgConfigs  Resolved config variables.
 * @returns {Object}               Mutated environment variable.
 */
Environment.prototype.updateConfigVars = function (pkgConfigs) {
  const self = this;

  _.each(pkgConfigs, (val, name) => {
    const fullName = `npm_package_config_${name}`;
    if (!_.has(self.env, fullName)) {
      self.env[fullName] = val;
    }
  });

  return this.env;
};

/**
 * Update environment `--env` / `--env-path` command line options.
 *
 * @param   {Object}  opts          Options
 * @param   {String}  opts.env      Stringified JSON object
 * @param   {String}  opts.envPath  Path to JSON file
 * @returns {Object}                Mutated environment variable.
 */
Environment.prototype.updateEnvFlag = function (opts) {
  // Nothing to parse.
  if (!(opts.env || opts.envPath)) {
    return this.env;
  }

  // Parse envs.
  const envsObj = jsonParse({
    str: opts.env,
    path: opts.envPath
  });

  // Validation
  if (!_.isPlainObject(envsObj)) {
    throw new Error(`Non-object JSON environment: ${JSON.stringify(envsObj)}`);
  }

  // Mutate environment and return.
  return _.merge(this.env, envsObj);
};
