"use strict";

/* eslint max-params: [2, 4]*/

const childProcess = require("child_process");

/**
 * Compatibility wrapper around `spawn` that makes it behave a little more
 * like `exec`.
 * @param {String} cmd        The command to run.
 * @param {Array} args        Arguments to pass to `cmd`.
 * @param {Object} opts       Spawn options.
 * @param {Function} callback A function to call with an `error` or null when
 *                            the process is done.
 * @returns {EventEmitter}    The child process object.
 */
module.exports = function (cmd, args, opts, callback) {
  const proc = childProcess.spawn(cmd, args, opts);
  let error;

  // The "error" event will almost never happen unless there's a problem at the
  // OS level; things like "command not found" and non-zero exit codes will be
  // normal "close" events, but with the appropriate `code` and `signal`.
  proc.on("error", (err) => {
    error = err;
  });

  proc.on("close", (code, signal) => {
    if (error) {
      return callback(error);
    }

    if (code !== 0) {
      // Behave like `exec` and construct an Error object.
      const cmdStr = [cmd].concat(args).join(" ");
      // TODO: To truly match `exec`, we'd tack on some stdout/stderr output to
      // the Error message here.
      error = new Error(`Command failed: ${cmdStr}\n`);
      // TODO: Are there signals we'd get here on a `close` event that *don't*
      // mean that the process was killed?
      error.killed = !!signal;
      error.code = code;
      error.signal = signal;
      error.cmd = cmdStr;
      return callback(error);
    }

    return callback(null);
  });

  return proc;
};
