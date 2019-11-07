"use strict";

/**
 * A simple script for run testing:
 *
 * Usage:
 *
 * ```
 * $ node test/server/repeat.js NUM_TIMES MSG EXIT_CODE
 *
 * # Zero times = "forever".
 * $ node test/server/repeat.js 0 "Forever"
 *
 * # Zero times = "forever".
 * $ node test/server/repeat.js 5 "Bad Exit" 1
 * ```
 *
 * It runs continuously echoing input args every `INTERVAL` ms.
 */
// Separate `--*` flags
const argv = process.argv.filter((a) => a.indexOf("--") === -1);
const extra = process.argv.filter((a) => a.indexOf("--") > -1);
if (extra.length) {
  process.stdout.write(`REPEAT EXTRA FLAGS - ${extra.join(",")}\n`);
}

const NUM_TIMES = parseInt(argv[2] || "100", 10);
const MSG = argv[3] || process.env.TEST_MESSAGE || "EMPTY";
const EXIT_CODE = parseInt(argv[4] || "0", 10);
const INTERVAL = 5;

process.stdout.write(`REPEAT START - ${MSG} - `);

let i = 0;
const log = function () {
  if (NUM_TIMES !== 0 && i++ > NUM_TIMES) {
    process.exit(EXIT_CODE); // eslint-disable-line no-process-exit
  }

  process.stdout.write(`${(NUM_TIMES === 0 ? "" : `${i} - `) + MSG}\n`);
};

setInterval(log, INTERVAL);

process.on("exit", (code) => {
  process.stdout.write(`REPEAT DONE - ${MSG} - ${code}`);
});
