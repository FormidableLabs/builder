"use strict";

// Separate `--*` flags
var argv = process.argv.filter(function (a) { return a.indexOf("--") === -1; });
var extra = process.argv.filter(function (a) { return a.indexOf("--") > -1; });
if (extra.length) {
  process.stdout.write("SLEEP EXTRA FLAGS - " + extra.join(",") + "\n");
}

// Sleep defaults to 5 ms.
var timeMs = parseInt(argv[2] || "5", 10);

setTimeout(function () {
  process.stdout.write("SLEEP DONE - " + timeMs + " ms\n");
  process.exit(0); // eslint-disable-line no-process-exit
}, timeMs);
