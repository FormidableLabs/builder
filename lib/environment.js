"use strict";

/**
 * Environment enhancements.
 *
 * We augment the current environment with additional paths to encompass
 * Builder paths.
 */
var _ = require("lodash");
var path = require("path");

// OS-agnostic path delimiter.
var DELIM = process.platform.indexOf("win") === 0 ? ";" : ":";

// Node directories.
var CWD_BIN = path.join(process.cwd(), "node_modules/.bin");
var CWD_NODE_PATH = path.join(process.cwd(), "node_modules");

/**
 * Environment wrapper.
 *
 * **NOTE - Side Effects**: Mutates wrapped environment object.
 *
 * @param {Object} opts         Options object
 * @param {Object} opts.config  Configuration object
 * @param {Object} opts.env     Environment object to mutate (Default `process.env`)
 * @returns {void}
 */
var Environment = module.exports = function (opts) {
  opts = opts || {};
  this.config = opts.config;
  this.env = opts.env || process.env;

  // Chalk: Force colors.
  this.env.FORCE_COLOR = "true";

  // Validation
  if (!this.config) {
    throw new Error("Configuration object required");
  }

  // Mutate environment paths.
  this.env.PATH = this.updatePath(this.config.archetypePaths);
  this.env.NODE_PATH = this.updateNodePath(this.config.archetypeNodePaths);

  // Add in npm config environment variables.
  this.updateConfigVars(this.config.pkgConfigs);
};

/**
 * Update `PATH` variable with CWD, archetype Node binary paths
 *
 * Resolution order:
 * 1. `ROOT/node_modules/.bin`
 * 2. `ROOT/node_modules/ARCHETYPE[1-n]/node_modules/.bin`
 * 3. existing `PATH`
 *
 * @param   {Array}   archetypePaths  Archetype `.bin` paths
 * @returns {String}                  `PATH` environment variable
 */
Environment.prototype.updatePath = function (archetypePaths) {
  var basePath = (this.env.PATH || "")
    .split(DELIM)
    .filter(function (x) { return x; });

  return []
    .concat(archetypePaths || [])
    .concat([CWD_BIN])
    .concat(basePath)
    .join(DELIM);
};

/**
 * Update `NODE_PATH` variable with CWD, archetype paths
 *
 * Resolution order:
 * 1. `ROOT/node_modules/`
 * 2. `ROOT/node_modules/ARCHETYPE[1-n]/node_modules/`
 * 3. existing `NODE_PATH`
 *
 * @param   {Array}   archetypeNodePaths  Archetype `node_module` paths
 * @returns {String}                      `NODE_PATH` environment variable
 * @see https://nodejs.org/api/modules.html
 */
Environment.prototype.updateNodePath = function (archetypeNodePaths) {
  var baseNodePath = (this.env.NODE_PATH || "")
    .split(DELIM)
    .filter(function (x) { return x; });

  return []
    .concat(archetypeNodePaths || [])
    .concat([CWD_NODE_PATH])
    .concat(baseNodePath)
    .join(DELIM);
};

/**
 * Update environment with configuration variables from package.json
 *
 * **Note**: We only go _one level deep_ for process.env mutations.
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
  var self = this;

  _.each(pkgConfigs, function (val, name) {
    var fullName = "npm_package_config_" + name;
    if (!_.has(self.env, fullName)) {
      self.env[fullName] = val;
    }
  });

  return this.env;
};
