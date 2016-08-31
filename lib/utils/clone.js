"use strict";

/**
 * A super-simple clone.
 *
 * Rationale: Lodash's `_.clone(|Deep)` has problems with empty strings
 * on certain Node versions with the ever terrifying `process.env` pseudo-
 * object.
 *
 * Limitations: No functions, no circular references, etc.
 *
 * @param   {Object} obj  Object to clone
 * @returns {Object}      Cloned object
 */
module.exports = function (obj) {
  return JSON.parse(JSON.stringify(obj)); // Such hackery...
};
