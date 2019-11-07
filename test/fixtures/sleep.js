"use strict";

// Separate `--*` flags
const argv = process.argv.filter((a) => a.indexOf("--") === -1);
const extra = process.argv.filter((a) => a.indexOf("--") > -1);
if (extra.length) {
  process.stdout.write(`SLEEP EXTRA FLAGS - ${extra.join(",")}\n`);
}

// Sleep defaults to 5 ms.
const timeMs = parseInt(argv[2] || "200", 10);

setTimeout(() => {
  process.stdout.write(`SLEEP DONE - ${timeMs} ms\n`);
  process.exit(0); // eslint-disable-line no-process-exit
}, timeMs);
