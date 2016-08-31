"use strict";

/**
 * Base server unit test initialization / global before/after's.
 *
 * This file should be `require`'ed by all other test files.
 *
 * **Note**: Because there is a global sandbox server unit tests should always
 * be run in a separate process from other types of tests.
 */
var async = require("async");
var mockFs = require("mock-fs");
var fs = require("fs");
var sinon = require("sinon");
var log = require("../../../lib/log");

var base = module.exports = {
  // Generic test helpers.
  sandbox: null,
  mockFs: null,

  // File stuff
  // NOTE: Sync methods are OK here because mocked and in-memory.
  fileRead: function (filePath) {
    return fs.readFileSync(filePath).toString();
  },
  fileExists: function (filePath) {
    return fs.existsSync(filePath);
  }
};

before(function () {
  // Set test environment
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
});

beforeEach(function () {
  base.mockFs = mockFs;
  base.mockFs();
  base.sandbox = sinon.sandbox.create({
    useFakeTimers: true
  });
});

afterEach(function (done) {
  base.mockFs.restore();
  base.sandbox.restore();
  log._unsetLevel(process.env);

  // Remove logs, ignoring errors.
  async.parallel([
    function (cb) { fs.unlink("stdout.log", function () { cb(); }); },
    function (cb) { fs.unlink("stdout-setup.log", function () { cb(); }); },
    function (cb) { fs.unlink("stdout-1.log", function () { cb(); }); },
    function (cb) { fs.unlink("stdout-2.log", function () { cb(); }); },
    function (cb) { fs.unlink("stdout-3.log", function () { cb(); }); },
    function (cb) { fs.unlink("stderr.log", function () { cb(); }); }
  ], done);
});
