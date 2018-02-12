"use strict";

/**
 * A simple script for run testing:
 *
 * Usage:
 *
 * ```
 * $ node test/server/repeat-script.js NUM_TIMES MSG EXIT_CODE
 *
 * # Zero times = "forever".
 * $ node test/server/repeat-script.js 0 "Forever"
 *
 * # Zero times = "forever".
 * $ node test/server/repeat-script.js 5 "Bad Exit" 1
 * ```
 *
 * It runs continuously echoing input args every `INTERVAL` ms.
 */
var NUM_TIMES = parseInt(process.argv[2] || "5", 10);
var MSG = process.argv[3] || process.env.TEST_MESSAGE || "EMPTY";
var EXIT_CODE = parseInt(process.argv[4] || "0", 10);
var INTERVAL = 5;

var i = 0;
var log = function () {
  if (NUM_TIMES !== 0 && i++ > NUM_TIMES) {
    process.exit(EXIT_CODE); // eslint-disable-line no-process-exit
  }

  process.stdout.write((NUM_TIMES === 0 ? "" : i + " - ") + MSG + "\n");
};

setInterval(log, INTERVAL);

process.on("exit", function (code) {
  process.stdout.write("REPEAT DONE - " + MSG + " - " + code);
});
