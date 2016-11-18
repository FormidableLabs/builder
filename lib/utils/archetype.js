"use strict";

/**
 * Archetype utilities
 */
var args = require("../args");

/**
 * Return if `--expand-archetype` flag is set (or in env).
 *
 * @param {Object} opts         Options object
 * @param {Object} opts.env     Raw environment (Default `process.env`)
 * @param {Array}  opts.argv    Raw arguments array (Default: `process.argv`)
 * @returns {Boolean}           True if archetype is expanded.
 */
module.exports.expandFlag = function (opts) {
  opts = opts || {};
  var env = opts.env || process.env; // Raw environment object.
  var parsed = args.general(opts.argv || process.argv);

  return parsed.expandArchetype || env._BUILDER_ARGS_EXPAND_ARCHETYPE === "true";
};
