"use strict";

var path = require("path");
var _ = require("lodash");
var args = require("../../../../lib/args");

require("../base.spec");

// Helper: Remove `argv` from nopts parsed object.
var _flags = function (parsed) {
  return _.omit(parsed, "argv");
};

// Dynamically create defaults
var _DEFAULTS = _(args.FLAGS)
  // Infer defaults and camel case fields.
  .mapValues(function (val) {
    return _(val)
      .mapValues(function (field) {
        var valOrFn = field.default;
        return _.isFunction(valOrFn) ? valOrFn() : valOrFn;
      })
      .mapKeys(function (field, fieldKey) { return _.camelCase(fieldKey); })
      .value();
  })
  // Merge in general flags
  .mapValues(function (val, key, all) {
    return key === "general" ? val : _.extend(val, all.general);
  })
  .value();

// Common case: overrides for "help" / "no choice" sceanrio.
var _HELP = {
  help: true,
  logLevel: "none"
};

describe("lib/args", function () {
  var origArgv;
  var argv;

  beforeEach(function () {
    origArgv = ["node", "builder"];
    argv = origArgv;
  });

  describe("general", function () {

    it("handles defaults for general flags", function () {
      expect(_flags(args.general(argv))).to.deep.equal(_.extend({}, _DEFAULTS.general, _HELP));
    });

    it("handles custom paths for --builderrc", function () {
      // Set to a nonexistent path (note args _doesn't_ check valid path).
      var dummyPath = path.join(__dirname, "DUMMYRC");
      argv = argv.concat(["--builderrc=" + dummyPath]);

      expect(_flags(args.general(argv))).to.deep.equal(_.extend({}, _DEFAULTS.general, _HELP, {
        builderrc: dummyPath
      }));
    });

    it("errors on invalid flags", function () {
      argv = argv.concat(["--bad"]);
      expect(function () {
        _flags(args.general(argv));
      }).to.throw("invalid/conflicting keys: bad");
    });

    it("errors on conflicting shorthand arguments", function () {
      argv = argv.concat(["-q"]); // Conflicts: queue vs quiet in concurrent
      expect(function () {
        _flags(args.concurrent(argv));
      }).to.throw("invalid/conflicting keys: q");
    });

    it("normalizes shorthand arguments", function () {
      argv = argv.concat(["--qui"]);
      expect(_flags(args.general(argv))).to.deep.equal(_.extend({}, _DEFAULTS.general, _HELP, {
        quiet: true
      }));
    });

    // TODO: Potential future functionality.
    // https://github.com/FormidableLabs/builder/issues/42
    it("validates paths for --builderrc");
  });

  describe("run", function () {

    it("handles defaults for run flags", function () {
      expect(_flags(args.run(argv))).to.deep.equal(_.extend({}, _DEFAULTS.run, _HELP));
    });

    it("handles valid --tries", function () {
      argv = argv.concat(["--tries=2"]);
      expect(_flags(args.run(argv))).to.deep.equal(_.extend({}, _DEFAULTS.run, _HELP, {
        tries: 2
      }));
    });

    it("handles invalid --tries", function () {
      // Invalid tries default to `1`.
      argv = origArgv.concat(["--tries=-1"]);
      expect(_flags(args.run(argv))).to.deep.equal(_.extend({}, _DEFAULTS.run, _HELP));

      argv = origArgv.concat(["--tries=BAD"]);
      expect(_flags(args.run(argv))).to.deep.equal(_.extend({}, _DEFAULTS.run, _HELP));

      argv = origArgv.concat(["--tries="]);
      expect(_flags(args.run(argv))).to.deep.equal(_.extend({}, _DEFAULTS.run, _HELP));
    });

    it("handles valid --setup", function () {
      argv = argv.concat(["--setup=foo"]);
      expect(_flags(args.run(argv))).to.deep.equal(_.extend({}, _DEFAULTS.run, _HELP, {
        setup: "foo"
      }));
    });

    it("handles invalid --setup", function () {
      argv = argv.concat(["--setup="]);
      expect(_flags(args.run(argv))).to.deep.equal(_.extend({}, _DEFAULTS.run, _HELP));
    });

  });

  describe("concurrent", function () {

    it("handles defaults for concurrent flags", function () {
      expect(_flags(args.concurrent(argv)))
        .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP));
    });

    it("handles valid --tries, --queue, --buffer, --no-bail", function () {
      argv = argv.concat(["--tries=2", "--queue=2", "--buffer", "--no-bail"]);
      expect(_flags(args.concurrent(argv)))
        .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP, {
          queue: 2,
          buffer: true,
          tries: 2,
          bail: false
        }));
    });

    it("handles valid --buffer", function () {
      argv = origArgv.concat(["--buffer"]);
      expect(_flags(args.concurrent(argv)))
        .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP, {
          buffer: true
        }));

      argv = origArgv.concat(["--no-buffer"]);
      expect(_flags(args.concurrent(argv)))
        .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP, {
          buffer: false
        }));

      argv = origArgv.concat(["--buffer=false"]);
      expect(_flags(args.concurrent(argv)))
        .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP, {
          buffer: false
        }));

      argv = origArgv.concat(["--buffer=true"]);
      expect(_flags(args.concurrent(argv)))
        .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP, {
          buffer: true
        }));

      argv = origArgv.concat(["--buf"]);
      expect(_flags(args.concurrent(argv)))
        .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP, {
          buffer: true
        }));

      // TODO(PRE): Make sure trimmed
      // argv = origArgv.concat(["--b"]);
      // expect(_flags(args.concurrent(argv)))
      //   .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP, {
      //     buffer: false
      //   }));
    });

    it("handles valid --bail", function () {
      argv = origArgv.concat(["--bail"]);
      expect(_flags(args.concurrent(argv)))
        .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP, {
          bail: true
        }));

      argv = origArgv.concat(["--no-bail"]);
      expect(_flags(args.concurrent(argv)))
        .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP, {
          bail: false
        }));

      argv = origArgv.concat(["--bail=false"]);
      expect(_flags(args.concurrent(argv)))
        .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP, {
          bail: false
        }));

      argv = origArgv.concat(["--bail=true"]);
      expect(_flags(args.concurrent(argv)))
        .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP, {
          bail: true
        }));

      argv = origArgv.concat(["--bai"]);
      expect(_flags(args.concurrent(argv)))
        .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP, {
          bail: true
        }));
    });

    it("handles invalid --tries", function () {
      // Invalid tries default to `1`.
      argv = origArgv.concat(["--tries=-1"]);
      expect(_flags(args.concurrent(argv)))
        .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP));

      argv = origArgv.concat(["--tries="]);
      expect(_flags(args.concurrent(argv)))
        .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP));

      argv = origArgv.concat(["--tries=BAD", "--queue=2"]);
      expect(_flags(args.concurrent(argv)))
        .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP, {
          queue: 2
        }));
    });

    it("handles invalid --queue", function () {
      // Invalid queue defaults to `null`.
      argv = origArgv.concat(["--queue=-1"]);
      expect(_flags(args.concurrent(argv)))
        .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP));

      argv = origArgv.concat(["--queue="]);
      expect(_flags(args.concurrent(argv)))
        .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP));

      argv = origArgv.concat(["--queue=BAD", "--tries=2"]);
      expect(_flags(args.concurrent(argv)))
        .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP, {
          tries: 2
        }));
    });

    it("handles multiple flags", function () {
      argv = argv.concat(["--queue=-1", "--tries=BAD", "--no-buffer", "--no-bail"]);
      expect(_flags(args.concurrent(argv)))
        .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP, {
          bail: false
        }));
    });
  });

  describe("envs", function () {
    // envs handles all `concurrent` flags, so just testing some additional
    // permutations

    it("handles valid --tries, --queue, --buffer, --envs-path", function () {
      // Set to a nonexistent path (note args _doesn't_ check valid path).
      var dummyPath = path.join(__dirname, "DUMMY_ENVS.json");
      argv = argv.concat(["--tries=2", "--queue=2", "--buffer", "--envs-path=" + dummyPath]);
      expect(_flags(args.envs(argv))).to.deep.equal(_.extend({}, _DEFAULTS.envs, _HELP, {
        queue: 2,
        envsPath: dummyPath,
        buffer: true,
        tries: 2
      }));
    });

    it("handles multiple flags", function () {
      argv = argv.concat(["--queue=-1", "--tries=BAD", "--no-buffer"]);
      expect(_flags(args.envs(argv))).to.deep.equal(_.extend({}, _DEFAULTS.envs, _HELP));
    });
  });

});
