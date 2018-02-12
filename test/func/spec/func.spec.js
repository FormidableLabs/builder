"use strict";

/**
 * Functional tests.
 *
 * These tests are **real** process / fs executions. Use sparingly as these
 * take about 0.5 seconds each.
 *
 * **Note**: Mac/Linux/Unix compatible.
 */
if (/^win/.test(process.platform)) {
  throw new Error("Functional tests are not Windows compatible");
}

var path = require("path");
var cp = require("child_process");

var _ = require("lodash");
var pify = require("pify");


var builder = require.resolve("../../../bin/builder");
var clone = require("../../../lib/utils/clone");

var CWD = path.resolve(__dirname, "..");
var STDOUT = 0;
var STDERR = 1;

var execBase = pify(cp.exec, { multiArgs: true });
var exec = function (cmd, opts) {
  opts = _.merge({
    cwd: CWD
  }, opts);

  return execBase(cmd, opts)
    .then(function (stdio) {
      return {
        stdout: stdio[STDOUT],
        stderr: stdio[STDERR]
      };
    });
};

describe("functional", function () {

  describe("environment variables", function () {

    it("get environment from package.json:config", function () {
      return exec("node \"" + builder + "\" run echo")
        .then(function (stdio) {
          expect(stdio.stdout)
            .to.contain("ECHO MSG: hi").and
            .to.contain("builder-core:start");
          expect(stdio.stderr).to.equal("");
        });
    });

    it("overrides package.json:config from environment", function () {
      return exec("node \"" + builder + "\" run echo", {
        env: _.merge(clone(process.env), {
          npm_package_config_msg: "over" // eslint-disable-line camelcase
        })
      })
        .then(function (stdio) {
          expect(stdio.stdout).to.contain("ECHO MSG: over");
          expect(stdio.stderr).to.equal("");
        });
    });

  });

  describe("logging", function () {

    it("silences logging", function () {
      return exec("node \"" + builder + "\" run echo --log-level=none")
        .then(function (stdio) {
          expect(stdio.stdout)
            .to.contain("ECHO MSG: hi").and
            .to.not.contain("builder-core:start");
          expect(stdio.stderr).to.equal("");
        });
    });

  });

  describe("--setup", function () {

    it("runs setup with --env values", function () {
      return exec(
        "node \"" + builder + "\" run sleep -q --setup=repeat " +
        "--env=\"{\\\"TEST_MESSAGE\\\":\\\"FROM_ENV\\\"}\""
      )
        .then(function (stdio) {
          expect(stdio.stdout).to.contain("REPEAT DONE - FROM_ENV");
          expect(stdio.stderr).to.equal("");
        });
    });

  })

});
