"use strict";

/**
 * A simple script for run testing:
 *
 * Usage:
 *
 * ```
 * $ node echo.js <optional extra message>
 * ```
 *
 * Uses environment variable `npm_package_config_message`, typically set
 * in `package.json` like:
 *
 * ```js
 * {
 *   "config": {
 *     "_test_message": "Hello"
 *   }
 * }
 * ```
 *
 * Secondarily falls back on real environment variable `TEST_MESSAGE` if above
 * is not set.
 */
var msg = process.env.npm_package_config__test_message;
if (typeof msg === "undefined") {
  msg = process.env.TEST_MESSAGE;
}
// Separate `--*` flags
var argv = process.argv.filter(function (a) { return a.indexOf("--") === -1; });
var extra = process.argv.filter(function (a) { return a.indexOf("--") > -1; });
if (extra.length) {
  process.stdout.write("ECHO EXTRA FLAGS - " + extra.join(",") + "\n");
}

var addl = argv[2] || "";
var out = typeof msg + " - " + (msg || "EMPTY") + (addl ? " - " + addl : "");

process.stdout.write(out + "\n");
