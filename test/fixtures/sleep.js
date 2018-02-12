"use strict";

// Sleep defaults to 5 ms.
var timeMs = parseInt(process.argv[2] || "5", 10);

setTimeout(function () {
  process.stdout.write("SLEEP DONE - " + timeMs + " ms\n");
  //process.exit(0);
}, timeMs);
