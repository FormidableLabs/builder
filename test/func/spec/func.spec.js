"use strict";

/**
 * Functional tests.
 *
 * These tests are **real** process / fs executions. Use sparingly as these
 * take about 0.5 seconds each.
 *
 * **Note**: Mac/Linux/Unix compatible.
 */
const path = require("path");
const cp = require("child_process");

const _ = require("lodash");
const builder = require.resolve("../../../bin/builder");
const clone = require("../../../lib/utils/clone");

const CWD = path.resolve(__dirname, "..");
const exec = function () {
  const args = [].slice.apply(arguments);
  const cmd = args[0];
  const callback = args[args.length - 1];
  let opts = args.length === 3 ? args[1] : {};
  opts = _.merge({ cwd: CWD }, opts);

  return cp.exec(cmd, opts, callback);
};

const STDERR_SETUP_END_RE = /^(|Terminated\s*)$/i;

describe("functional", () => {
  describe("environment variables", () => {
    it("get environment from package.json:config", (done) => {
      exec(`node "${builder}" run echo --log=debug`, (err, stdout, stderr) => {
        if (err) { return done(err); }

        expect(stdout)
          .to.contain("string - hi").and
          .to.contain("builder-core:start");
        expect(stderr).to.equal("");

        done();
      });
    });

    it("overrides package.json:config from environment", (done) => {
      exec(`node "${builder}" run echo`, {
        env: _.merge(clone(process.env), {
          npm_package_config__test_message: "over" // eslint-disable-line camelcase
        })
      }, (err, stdout, stderr) => {
        if (err) { return done(err); }

        expect(stdout).to.contain("string - over");
        expect(stderr).to.equal("");
        done();
      });
    });
  });

  describe("logging", () => {
    it("silences logging", (done) => {
      exec(`node "${builder}" run echo --log-level=none`, (err, stdout, stderr) => {
        if (err) { return done(err); }

        expect(stdout)
          .to.contain("string - hi").and
          .to.not.contain("builder-core:start");
        expect(stderr).to.equal("");
        done();
      });
    });
  });

  describe("--setup", () => {
    it("runs setup with --env values applied", (done) => {
      exec(
        `node "${builder}" run sleep -q --setup=echo-forever `
        + "--env=\"{\\\"TEST_MESSAGE\\\":\\\"FROM_ENV\\\"}\" ",
        (err, stdout, stderr) => {
          if (err) { return done(err); }

          expect(stdout).to.contain("ECHO FOREVER - string - FROM_ENV");
          expect(stderr).to.match(STDERR_SETUP_END_RE);
          done();
        });
    });

    it("runs setup with --quiet flag applied", (done) => {
      exec(`node "${builder}" run sleep -q --setup=echo-forever:builder`,
        (err, stdout, stderr) => {
          if (err) { return done(err); }

          expect(stdout).to.not.contain("[builder");
          expect(stderr).to.match(STDERR_SETUP_END_RE);
          done();
        });
    });

    it("runs setup with --log-level=debug flag applied", (done) => exec(
      `node "${builder}" run sleep --log-level=debug --setup=echo-forever:builder`,
      (err, stdout, stderr) => {
        if (err) { return done(err); }

        expect(stdout).to.contain("[builder:proc:start");
        expect(stderr).to.contain("[builder:proc:end");
        done();
      }));

    it("runs setup with --log-level=none flag applied", (done) => exec(
      `node "${builder}" run sleep --log-level=none --setup=echo-forever:builder`,
      (err, stdout, stderr) => {
        if (err) { return done(err); }

        expect(stdout).to.not.contain("[builder");
        expect(stderr).to.match(STDERR_SETUP_END_RE);
        done();
      }));

    it("runs setup without --tries flag applied", (done) => {
      const sleepMs = 1000; // Give the sleep a little while to let failures happen.

      return exec(
        `node "${builder}" run sleep -q --setup=fail --tries=2 -- ${sleepMs}`,
        (err, stdout) => {
          expect(err).to.have.property("code", 1);
          expect(stdout.match(/FAIL/g)).to.have.length(1); // Only one try.
          done();
        });
    });

    it("runs setup without -- custom flags", (done) => exec(
      `node "${builder}" run sleep -q --setup=echo-forever -- --foo`,
      (err, stdout, stderr) => {
        if (err) { return done(err); }

        expect(stdout)
          .to.contain("SLEEP EXTRA FLAGS - --foo").and
          .to.not.contain("ECHO FOREVER EXTRA FLAGS");
        expect(stderr).to.match(STDERR_SETUP_END_RE);
        done();
      }));

    // TODO: This one is going to be... tough.
    // https://github.com/FormidableLabs/builder/issues/9
    it("overrides a <archetype> command with a <root> one in a composed <archetype> command");
  });
});
