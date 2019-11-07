"use strict";

const fs = require("fs");
const path = require("path");
const _ = require("lodash");

/**
 * Parse environment string and/or JSON file path into a full JS object.
 *
 * For use with environment variable specification.
 *
 * **Note**: Does synchronous file read.
 *
 * Parsing logic:
 *
 * 1. Try `opts.str` string if set
 * 2. If not, try `opts.path` file
 *
 * @param {Object}    opts        Options
 * @param {String}    opts.str    Stringified JSON object
 * @param {String}    opts.path   Path to JSON file
 * @returns {Object}              Data object.
 */
module.exports = {
  parse(opts) {
    const jsonStr = _.isUndefined(opts.str) ? null : opts.str;
    const jsonPath = _.isUndefined(opts.path) ? null : opts.path;

    // Validation: Programming error if thrown.
    if (jsonStr === null && jsonPath === null) {
      throw new Error("Must specify JSON string or path.");
    }

    // Try string first.
    if (jsonStr) {
      return JSON.parse(jsonStr);
    }

    // Try JSON file path next.
    if (jsonPath) {
      const data = fs.readFileSync(path.resolve(jsonPath));
      return JSON.parse(data);
    }

    // Programming error.
    throw new Error("Invalid parsing path.");
  }
};
