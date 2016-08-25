"use strict";

/**
 * Base server unit test initialization / global before/after's.
 *
 * This file should be `require`'ed by all other test files.
 *
 * **Note**: Because there is a global sandbox server unit tests should always
 * be run in a separate process from other types of tests.
 */
var mockFs = require("mock-fs");
var fs = require("fs");
var sinon = require("sinon");
var Promise = require("es6-promise").Promise;
var log = require("../../../lib/log");

var removeFile = function (filename) {
  return new Promise(function (resolve) {
    fs.unlink(filename, function () {
      resolve(); // Don't get about errors.
    });
  });
};

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

afterEach(function () {
  base.mockFs.restore();
  base.sandbox.restore();
  log._unsetLevel();
  return Promise.all([
    removeFile("stdout.log"),
    removeFile("stderr.log")
  ]);
});
