#!/usr/bin/env node
"use strict";

var resolve = require("resolve");
var log = require("../lib/log");
var localBuilder;

// Try to resolve builder in the current project's root, use global if fails
try {
  localBuilder = resolve.sync(
    "builder", { basedir: process.cwd(), moduleDirectory: "node_modules" }
  );
} catch (e) {
  log.info("proc:info", "Using global builder");
  require("../index"); // eslint-disable-line global-require
}

if (localBuilder) {
  log.info("proc:info", "Using local builder");
  require(localBuilder); // eslint-disable-line global-require

}
