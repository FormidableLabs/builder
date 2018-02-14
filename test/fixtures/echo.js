"use strict";

/**
 * A simple script for run testing:
 *
 * Usage:
 *
 * ```
 * $ node echo.js <optional message>
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
// Separate `--*` flags
var argv = process.argv.filter(function (a) { return a.indexOf("--") === -1; });
var extra = process.argv.filter(function (a) { return a.indexOf("--") > -1; });

// Get message.
var msg = argv[2];
if (typeof msg === "undefined") {
  msg = process.env.TEST_MESSAGE;
}
if (typeof msg === "undefined") {
  msg = process.env.npm_package_config__test_message;
}

var out = typeof msg + " - " + (msg || "EMPTY");

var create = module.exports = function (prefix) {
  return {
    extra: function () {
      if (!extra.length) { return; }
      process.stdout.write(prefix + " EXTRA FLAGS - " + extra.join(",") + "\n");
    },
    log: function () {
      process.stdout.write(prefix + " - " + out + "\n");
    }
  };
};

if (require.main === module) {
  // Add slight delay so things like setup can get started, etc.
  var DELAY = 10;
  setTimeout(function () {
    var echo = create("ECHO");
    echo.extra();
    echo.log();
  }, DELAY);
}
