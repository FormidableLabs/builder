"use strict";

var exec = require("child_process").exec;
var log = require("../lib/log");

/**
 * Task runner.
 */
module.exports = {
  run: function (env, cmd) {
    var proc = exec(cmd, {
      env: env.env
    }, function (err) {
      if (err) {
        var code = err.code || 1;
        log.error("error", "Code: " + code + ", Command: " + cmd);
        process.exit(code);
      }
    });

    proc.stdout.pipe(process.stdout, { end: false });
    proc.stderr.pipe(process.stderr, { end: false });

    log.info("run", cmd);
    return proc;
  }
};
