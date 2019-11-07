"use strict";

/**
 * Echo in a repeating loop forever.
 *
 * Usage:
 *
 * ```
 * $ node echo-forever.js <optional extra message>
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
const create = require("./echo");
const INTERVAL = 50;

const echo = create("ECHO FOREVER");
echo.extra();
echo.log();
setInterval(echo.log, INTERVAL);
