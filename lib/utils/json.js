"use strict";

var fs = require("fs");
var path = require("path");
var _ = require("lodash");

var parseJson = function (objStr, callback) {
  try {
    return callback(null, JSON.parse(objStr));
  } catch (parseErr) {
    return callback(parseErr);
  }
};

/**
 * Parse environment string and/or JSON file path into a full JS object.
 *
 * For use with environment variable specification.
 *
 * Parsing logic:
 *
 * 1. Try `opts.str` string if set
 * 2. If not, try `opts.path` file
 *
 * @param {Object}    opts        Options
 * @param {String}    opts.str    Stringified JSON object
 * @param {String}    opts.path   Path to JSON file
 * @param {Function}  callback    Callback `(err, obj)`
 */
module.exports = {
  parse: function (opts, callback) {
    var jsonStr = _.isUndefined(opts.str) ? null : opts.str;
    var jsonPath = _.isUndefined(opts.path) ? null : opts.path;

    // Validation: Programming error if thrown.
    if (jsonStr === null && jsonPath === null) {
      return callback(new Error("Must specify JSON string or path."));
    }

    // Try string first.
    if (jsonStr) {
      return parseJson(jsonStr, callback);
    }

    // Try JSON file path next.
    if (jsonPath) {
      return fs.readFile(path.resolve(jsonPath), function (readErr, data) {
        if (readErr) {
          return callback(readErr);
        }

        return parseJson(data, callback);
      });
    }

    // Programming error.
    callback(new Error("Invalid parsing path."));
  }
};
