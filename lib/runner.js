"use strict";

var exec = require("child_process").exec;
var async = require("async");
var log = require("../lib/log");

/**
 * Run a single task.
 *
 * @param {Object}    env       Enviroment object
 * @param {String}    cmd       Shell command
 * @param {Function}  callback  Callback `(err)`
 * @returns {Object}            Child process object
 */
var run = function (env, cmd, callback) {
  log.info("proc:start", cmd);
  var proc = exec(cmd, {
    env: env.env
  }, function (err) {
    var code = 0;

    if (err) {
      code = err.code || 1;
      log.error("proc:error", "Code: " + code + ", Command: " + cmd);
    }

    log.info("proc:end:" + code, cmd);
    callback(err);
  });

  proc.stdout.pipe(process.stdout, { end: false });
  proc.stderr.pipe(process.stderr, { end: false });

  return proc;
};

/**
 * Task runner.
 */
module.exports = {
  /**
   * Run a single task.
   *
   * @param {Object}    env       Enviroment object
   * @param {String}    cmd       Shell command
   * @param {Function}  callback  Callback `(err)`
   * @returns {Object}            Child process object
   */
  run: function (env, cmd, callback) {
    return run(env, cmd, callback);
  },

  /**
   * Run multiple tasks in parallel.
   *
   * @param {Object}    env       Enviroment object
   * @param {Array}     cmds      List of shell commands
   * @param {Function}  callback  Callback `(err)`
   * @returns {void}
   */
  concurrent: function (env, cmds, callback) {
    // Manually track processes.
    var procs = [];

    async.map(cmds, function (cmd, cb) {
      var proc = run(env, cmd, cb);

      // Add to tracked list.
      procs.push(proc);

      // Remove from tracked list when closed.
      proc.on("close", function () {
        procs = procs.filter(function (obj) {
          return obj.pid !== proc.pid;
        });
      });

    }, function (err) {
      // Kill remaining processes if alive.
      procs.forEach(function (proc) {
        proc.kill();
      });

      callback(err);
    });
  }
};
