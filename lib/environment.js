"use strict";

/**
 * Environment enhancements.
 *
 * We augment the current environment with additional paths to encompass
 * Builder paths.
 */
var path = require("path");

path.join(process.cwd(), "node_modules/.bin");
// OS-agnostic path delimiter.
var DELIM = process.platform.indexOf("win") === 0 ? ";" : ":";

// Node binary directories.
var CWD_BIN = path.join(process.cwd(), "node_modules/.bin");
var BUILDER_BIN = path.join(__dirname, "../node_modules/.bin");

/**
 * Environment wrapper.
 *
 * @param {Object} env  Environment object to mutate (Default `process.env`)
 */
var Environment = module.exports = function (env) {
  this.env = env || process.env;
  this.env.FORCE_COLOR = "true";
};

/**
 * Update `PATH` variable with Node binary paths
 *
 * Adds:
 * - CWD
 * - Builder
 *
 * **NOTE - Side Effects**: Mutates wrapped environment object.
 *
 * @returns {String} `PATH` environment variable (post-mutation)
 */
Environment.prototype.updatePath = function () {
  return this.env.PATH = (this.env.PATH || "")
    .split(DELIM)
    .filter(function (x) { return x; }) // Remove empty strings
    .concat([CWD_BIN, BUILDER_BIN])
    .join(DELIM);
};