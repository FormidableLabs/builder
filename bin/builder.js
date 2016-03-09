#!/usr/bin/env node
"use strict";

var path = require("path");

// Buffer up log messages to pass on.
//
// **Scenario**: We can't import `log` here and use it's internal queue because
// this might be the _global_ builder in this script, which if we then switch
// to _local_ builder below, we'll import a different (local) `log` and when
// that gets called, it wouldn't have any internal queue / notion of these log
// events here. So, instead of using the internal log queue, we manually create
// an array of messages in the same format and drain in `builder-core`
// explicitly.
var msgs = [];

// Infer if we are global and there is a local version available.
var builderPath = require.resolve("./builder-core");
var localPath = path.resolve(process.cwd(), "node_modules/builder/bin/builder-core.js");

// Swap to local path if different.
if (builderPath !== localPath) {
  try {
    builderPath = require.resolve(localPath);
    msgs.push({
      level: "info", type: "local-detect",
      msg: "Switched to local builder at: " + localPath
    });
  } catch (err) {
    msgs.push({
      level: "warn", type: "local-detect",
      msg: "Error importing local builder: " + err.message
    });
    msgs.push({
      level: "info", type: "local-detect",
      msg: "Using global builder at: " + builderPath
    });
  }
}

// Import and run.
var builder = require(builderPath);
builder({
  msgs: msgs
}, function (err) {
  /*eslint-disable no-process-exit*/
  process.exit(err ? err.code || 1 : 0);
});
