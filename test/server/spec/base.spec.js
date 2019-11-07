"use strict";

/**
 * Base server unit test initialization / global before/after's.
 *
 * This file should be `require`'ed by all other test files.
 *
 * **Note**: Because there is a global sandbox server unit tests should always
 * be run in a separate process from other types of tests.
 */
const async = require("async");
const mockFs = require("mock-fs");
const fs = require("fs");
const sinon = require("sinon");
const log = require("../../../lib/log");
const clone = require("../../../lib/utils/clone");

// Is a test output file?
const isTestOuts = function (name) {
  return (/^std(out|err).*/).test(name);
};

const base = module.exports = {
  // Generic test helpers.
  sandbox: null,
  mockFs: null,

  // File stuff
  // NOTE: Sync methods are OK here because mocked and in-memory.
  fileRead(filePath) {
    return fs.readFileSync(filePath).toString();
  },
  fileExists(filePath) {
    return fs.existsSync(filePath);
  },
  isTestOuts
};

let origEnv;

before(() => {
  // Set test environment
  process.env.NODE_ENV = process.env.NODE_ENV || "test";

  // Stash the pristine environment.
  origEnv = clone(process.env);
});

beforeEach(() => {
  base.mockFs = mockFs;
  base.mockFs();
  base.sandbox = sinon.sandbox.create({
    useFakeTimers: true
  });

  process.env = clone(origEnv);
});

afterEach((done) => {
  base.mockFs.restore();
  base.sandbox.restore();
  log._unsetLevel();

  // Remove logs, ignoring errors.
  fs.readdir(process.cwd(), (err, files) => {
    if (err) { return done(err); }

    const outs = files.filter(isTestOuts);
    async.map(outs, (file, cb) => {
      fs.unlink(file, () => { cb(); });
    }, done);
  });
});
