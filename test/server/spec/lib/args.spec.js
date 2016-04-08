"use strict";

var path = require("path");
var _ = require("lodash");
var args = require("../../../../lib/args");

require("../base.spec");

// Helper: Remove `argv` from nopts parsed object.
var _flags = function (parsed) {
  return _.omit(parsed, "argv");
};

describe("lib/args", function () {
  var argv;

  beforeEach(function () {
    argv = ["node", "builder"];
  });

  describe("general", function () {

    it("handles defaults for general flags", function () {
      expect(_flags(args.general(argv))).to.deep.equal({
        builderrc: ".builderrc",
        help: false,
        logLevel: "info",
        unlimitedBuffer: false,
        quiet: false,
        version: false
      });
    });

    it("handles custom paths for --builderrc", function () {
      // Set to a nonexistent path (note args _doesn't_ check valid path).
      var dummyPath = path.join(__dirname, "DUMMYRC");
      argv = argv.concat(["--builderrc=" + dummyPath]);

      expect(_flags(args.general(argv))).to.deep.equal({
        builderrc: dummyPath,
        help: false,
        logLevel: "info",
        unlimitedBuffer: false,
        quiet: false,
        version: false
      });
    });

    // TODO: Potential future functionality.
    // https://github.com/FormidableLabs/builder/issues/42
    it("validates paths for --builderrc");

  });

  describe("run", function () {

    it("handles defaults for run flags", function () {
      expect(_flags(args.run(argv))).to.deep.equal({
        tries: 1,
        expandArchetype: false,
        setup: null
      });
    });

    it("handles valid --tries", function () {
      argv = argv.concat(["--tries=2"]);
      expect(_flags(args.run(argv))).to.deep.equal({
        tries: 2,
        expandArchetype: false,
        setup: null
      });
    });

    it("handles invalid --tries", function () {
      // Invalid tries default to `1`.

      expect(_flags(args.run(argv.concat(["--tries=-1"])))).to.deep.equal({
        tries: 1,
        expandArchetype: false,
        setup: null
      });

      expect(_flags(args.run(argv.concat(["--tries=BAD"])))).to.deep.equal({
        tries: 1,
        expandArchetype: false,
        setup: null
      });

      expect(_flags(args.run(argv.concat(["--tries="])))).to.deep.equal({
        tries: 1,
        expandArchetype: false,
        setup: null
      });
    });

    it("handles valid --setup", function () {
      argv = argv.concat(["--setup=foo"]);
      expect(_flags(args.run(argv))).to.deep.equal({
        tries: 1,
        expandArchetype: false,
        setup: "foo"
      });
    });

    it("handles invalid --setup", function () {
      argv = argv.concat(["--setup="]);
      expect(_flags(args.run(argv))).to.deep.equal({
        tries: 1,
        expandArchetype: false,
        setup: null
      });
    });

  });

  describe("concurrent", function () {

    it("handles defaults for concurrent flags", function () {
      expect(_flags(args.concurrent(argv))).to.deep.equal({
        queue: null,
        buffer: false,
        tries: 1,
        expandArchetype: false,
        setup: null,
        bail: true
      });
    });

    it("handles valid --tries, --queue, --buffer, --no-bail", function () {
      argv = argv.concat(["--tries=2", "--queue=2", "--buffer", "--no-bail"]);
      expect(_flags(args.concurrent(argv))).to.deep.equal({
        queue: 2,
        buffer: true,
        tries: 2,
        expandArchetype: false,
        setup: null,
        bail: false
      });
    });

    it("handles valid --buffer", function () {
      expect(_flags(args.concurrent(argv.concat(["--buffer"])))).to.deep.equal({
        queue: null,
        buffer: true,
        tries: 1,
        expandArchetype: false,
        setup: null,
        bail: true
      });

      expect(_flags(args.concurrent(argv.concat(["--no-buffer"])))).to.deep.equal({
        queue: null,
        buffer: false,
        tries: 1,
        expandArchetype: false,
        setup: null,
        bail: true
      });

      expect(_flags(args.concurrent(argv.concat(["--buffer=false"])))).to.deep.equal({
        queue: null,
        buffer: false,
        tries: 1,
        expandArchetype: false,
        setup: null,
        bail: true
      });

      expect(_flags(args.concurrent(argv.concat(["--buffer=true"])))).to.deep.equal({
        queue: null,
        buffer: true,
        tries: 1,
        expandArchetype: false,
        setup: null,
        bail: true
      });

      expect(_flags(args.concurrent(argv.concat(["--buffer=1"])))).to.deep.equal({
        queue: null,
        buffer: true,
        tries: 1,
        expandArchetype: false,
        setup: null,
        bail: true
      });
    });

    it("handles valid --bail", function () {
      expect(_flags(args.concurrent(argv.concat(["--bail"])))).to.deep.equal({
        queue: null,
        buffer: false,
        tries: 1,
        expandArchetype: false,
        setup: null,
        bail: true
      });

      expect(_flags(args.concurrent(argv.concat(["--no-bail"])))).to.deep.equal({
        queue: null,
        buffer: false,
        tries: 1,
        expandArchetype: false,
        setup: null,
        bail: false
      });

      expect(_flags(args.concurrent(argv.concat(["--bail=false"])))).to.deep.equal({
        queue: null,
        buffer: false,
        tries: 1,
        expandArchetype: false,
        setup: null,
        bail: false
      });

      expect(_flags(args.concurrent(argv.concat(["--bail=true"])))).to.deep.equal({
        queue: null,
        buffer: false,
        tries: 1,
        expandArchetype: false,
        setup: null,
        bail: true
      });

      expect(_flags(args.concurrent(argv.concat(["--bail=1"])))).to.deep.equal({
        queue: null,
        buffer: false,
        tries: 1,
        expandArchetype: false,
        setup: null,
        bail: true
      });
    });

    it("handles invalid --tries", function () {
      // Invalid tries default to `1`.
      expect(_flags(args.concurrent(argv.concat(["--tries=-1"])))).to.deep.equal({
        queue: null,
        buffer: false,
        tries: 1,
        expandArchetype: false,
        setup: null,
        bail: true
      });

      expect(_flags(args.concurrent(argv.concat(["--tries=BAD", "--queue=2"])))).to.deep.equal({
        queue: 2,
        buffer: false,
        tries: 1,
        expandArchetype: false,
        setup: null,
        bail: true
      });

      expect(_flags(args.concurrent(argv.concat(["--tries="])))).to.deep.equal({
        queue: null,
        buffer: false,
        tries: 1,
        expandArchetype: false,
        setup: null,
        bail: true
      });
    });

    it("handles invalid --queue", function () {
      // Invalid queue defaults to `null`.
      expect(_flags(args.concurrent(argv.concat(["--queue=-1"])))).to.deep.equal({
        queue: null,
        buffer: false,
        tries: 1,
        expandArchetype: false,
        setup: null,
        bail: true
      });

      expect(_flags(args.concurrent(argv.concat(["--queue=BAD", "--tries=2"])))).to.deep.equal({
        queue: null,
        buffer: false,
        tries: 2,
        expandArchetype: false,
        setup: null,
        bail: true
      });

      expect(_flags(args.concurrent(argv.concat(["--queue="])))).to.deep.equal({
        queue: null,
        buffer: false,
        tries: 1,
        expandArchetype: false,
        setup: null,
        bail: true
      });
    });

    it("handles multiple flags", function () {
      var flags = ["--queue=-1", "--tries=BAD", "--no-buffer", "--no-bail"];
      expect(_flags(args.concurrent(argv.concat(flags)))).to.deep.equal({
        queue: null,
        buffer: false,
        tries: 1,
        expandArchetype: false,
        setup: null,
        bail: false
      });
    });
  });

  describe("envs", function () {
    // envs handles all `concurrent` flags, so just testing some additional
    // permutations

    it("handles defaults for envs flags", function () {
      expect(_flags(args.envs(argv))).to.deep.equal({
        queue: null,
        envsPath: null,
        buffer: false,
        tries: 1,
        expandArchetype: false,
        setup: null,
        bail: true
      });
    });

    it("handles valid --tries, --queue, --buffer, --envs-path", function () {
      // Set to a nonexistent path (note args _doesn't_ check valid path).
      var dummyPath = path.join(__dirname, "DUMMY_ENVS.json");
      argv = argv.concat(["--tries=2", "--queue=2", "--buffer", "--envs-path=" + dummyPath]);
      expect(_flags(args.envs(argv))).to.deep.equal({
        queue: 2,
        envsPath: dummyPath,
        buffer: true,
        tries: 2,
        expandArchetype: false,
        setup: null,
        bail: true
      });
    });

    it("handles multiple flags", function () {
      var flags = ["--queue=-1", "--tries=BAD", "--no-buffer"];
      expect(_flags(args.envs(argv.concat(flags)))).to.deep.equal({
        queue: null,
        envsPath: null,
        buffer: false,
        tries: 1,
        expandArchetype: false,
        setup: null,
        bail: true
      });
    });
  });

});
