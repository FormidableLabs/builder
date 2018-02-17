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
var clone = require("../../../lib/utils/clone");

// Is a test output file?
var isTestOuts = function (name) {
  return /^std(out|err).*/.test(name);
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
  },
  isTestOuts: isTestOuts
};

var origEnv;

before(function () {
  // Set test environment
  process.env.NODE_ENV = process.env.NODE_ENV || "test";

  // Stash the pristine environment.
  origEnv = clone(process.env);
});

beforeEach(function () {
  base.mockFs = mockFs;
  base.mockFs();
  base.sandbox = sinon.sandbox.create({
    useFakeTimers: true
  });

  process.env = clone(origEnv);
});

afterEach(function (done) {
  base.mockFs.restore();
  base.sandbox.restore();
  log._unsetLevel();

  // Remove logs, ignoring errors.
  fs.readdir(process.cwd(), function (err, files) {
    if (err) { return done(err); }

    var outs = files.filter(isTestOuts);
    async.map(outs, function (file, cb) {
      fs.unlink(file, function () { cb(); });
    }, done);
  });
});
