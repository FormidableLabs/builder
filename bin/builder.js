#!/usr/bin/env node
"use strict";

var path = require("path");
var log = require("../lib/log");

// Infer if we are global and there is a local version available.
var builderPath = require.resolve("./builder-core");
var localPath = path.resolve(process.cwd(), "node_modules/builder/bin/builder-core.js");

// Swap to local path if different.
if (builderPath !== localPath) {
  try {
    builderPath = require.resolve(localPath);
    log.info("local-detect", "Switched to local builder at: " + localPath);
  } catch (err) {
    log.warn("local-detect", "Error importing local builder: " + err.message);
    log.info("local-detect", "Using global builder at: " + builderPath);
  }
}

// Import and run.
var builder = require(builderPath);
builder(function (err) {
  /*eslint-disable no-process-exit*/
  process.exit(err ? err.code || 1 : 0);
});
