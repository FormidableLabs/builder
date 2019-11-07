"use strict";

const path = require("path");
const _ = require("lodash");
const args = require("../../../../lib/args");

require("../base.spec");

// Helper: Remove `argv` from nopts parsed object.
const _flags = function (parsed) {
  return _.omit(parsed, "argv");
};

// Dynamically create defaults
const _DEFAULTS = _(args.FLAGS)
  // Infer defaults and camel case fields.
  .mapValues((val) => _(val)
    .mapValues((field) => {
      const valOrFn = field.default;
      return _.isFunction(valOrFn) ? valOrFn() : valOrFn;
    })
    .mapKeys((field, fieldKey) => _.camelCase(fieldKey))
    .value())
  // Merge in general flags
  .mapValues((val, key, all) => key === "general" ? val : _.extend(val, all.general))
  .value();

// Common case: overrides for "help" / "no choice" sceanrio.
const _HELP = {
  help: true,
  logLevel: "none"
};

describe("lib/args", () => {
  let origArgv;
  let argv;

  beforeEach(() => {
    origArgv = ["node", "builder"];
    argv = origArgv;
  });

  describe("general", () => {
    it("handles defaults for general flags", () => {
      expect(_flags(args.general(argv))).to.deep.equal(_.extend({}, _DEFAULTS.general, _HELP));
    });

    it("handles custom paths for --builderrc", () => {
      // Set to a nonexistent path (note args _doesn't_ check valid path).
      const dummyPath = path.join(__dirname, "DUMMYRC");
      argv = argv.concat([`--builderrc=${dummyPath}`]);

      expect(_flags(args.general(argv))).to.deep.equal(_.extend({}, _DEFAULTS.general, _HELP, {
        builderrc: dummyPath
      }));
    });

    it("errors on invalid flags", () => {
      argv = argv.concat(["--bad"]);
      expect(() => {
        _flags(args.general(argv));
      }).to.throw("invalid/conflicting keys: bad");
    });

    it("errors on conflicting shorthand arguments", () => {
      // Conflicts: queue vs quiet in concurrent
      argv = origArgv.concat(["-q"]);
      expect(() => {
        _flags(args.concurrent(argv));
      }).to.throw("invalid/conflicting keys: q");

      // Conflicts: buffer vs bail in concurrent
      argv = origArgv.concat(["--b"]);
      expect(() => {
        _flags(args.concurrent(argv));
      }).to.throw("invalid/conflicting keys: b");
    });

    it("normalizes shorthand arguments", () => {
      argv = argv.concat(["--qui"]);
      expect(_flags(args.general(argv))).to.deep.equal(_.extend({}, _DEFAULTS.general, _HELP, {
        quiet: true
      }));
    });

    // TODO: Potential future functionality.
    // https://github.com/FormidableLabs/builder/issues/42
    it("validates paths for --builderrc");
  });

  describe("run", () => {
    it("handles defaults for run flags", () => {
      expect(_flags(args.run(argv))).to.deep.equal(_.extend({}, _DEFAULTS.run, _HELP));
    });

    it("handles valid --tries", () => {
      argv = argv.concat(["--tries=2"]);
      expect(_flags(args.run(argv))).to.deep.equal(_.extend({}, _DEFAULTS.run, _HELP, {
        tries: 2
      }));
    });

    it("handles invalid --tries", () => {
      // Invalid tries default to `1`.
      argv = origArgv.concat(["--tries=-1"]);
      expect(_flags(args.run(argv))).to.deep.equal(_.extend({}, _DEFAULTS.run, _HELP));

      argv = origArgv.concat(["--tries=BAD"]);
      expect(_flags(args.run(argv))).to.deep.equal(_.extend({}, _DEFAULTS.run, _HELP));

      argv = origArgv.concat(["--tries="]);
      expect(_flags(args.run(argv))).to.deep.equal(_.extend({}, _DEFAULTS.run, _HELP));
    });

    it("handles valid --setup", () => {
      argv = argv.concat(["--setup=foo"]);
      expect(_flags(args.run(argv))).to.deep.equal(_.extend({}, _DEFAULTS.run, _HELP, {
        setup: "foo"
      }));
    });

    it("handles invalid --setup", () => {
      argv = argv.concat(["--setup="]);
      expect(_flags(args.run(argv))).to.deep.equal(_.extend({}, _DEFAULTS.run, _HELP));
    });
  });

  describe("concurrent", () => {
    it("handles defaults for concurrent flags", () => {
      expect(_flags(args.concurrent(argv)))
        .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP));
    });

    it("handles valid --tries, --queue, --buffer, --no-bail", () => {
      argv = argv.concat(["--tries=2", "--queue=2", "--buffer", "--no-bail"]);
      expect(_flags(args.concurrent(argv)))
        .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP, {
          queue: 2,
          buffer: true,
          tries: 2,
          bail: false
        }));
    });

    it("handles valid --buffer", () => {
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
    });

    it("handles valid --bail", () => {
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

    it("handles invalid --tries", () => {
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

    it("handles invalid --queue", () => {
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

    it("handles multiple flags", () => {
      argv = argv.concat(["--queue=-1", "--tries=BAD", "--no-buffer", "--no-bail"]);
      expect(_flags(args.concurrent(argv)))
        .to.deep.equal(_.extend({}, _DEFAULTS.concurrent, _HELP, {
          bail: false
        }));
    });
  });

  describe("envs", () => {
    // envs handles all `concurrent` flags, so just testing some additional
    // permutations

    it("handles valid --tries, --queue, --buffer, --envs-path", () => {
      // Set to a nonexistent path (note args _doesn't_ check valid path).
      const dummyPath = path.join(__dirname, "DUMMY_ENVS.json");
      argv = argv.concat(["--tries=2", "--queue=2", "--buffer", `--envs-path=${dummyPath}`]);
      expect(_flags(args.envs(argv))).to.deep.equal(_.extend({}, _DEFAULTS.envs, _HELP, {
        queue: 2,
        envsPath: dummyPath,
        buffer: true,
        tries: 2
      }));
    });

    it("handles multiple flags", () => {
      argv = argv.concat(["--queue=-1", "--tries=BAD", "--no-buffer"]);
      expect(_flags(args.envs(argv))).to.deep.equal(_.extend({}, _DEFAULTS.envs, _HELP));
    });
  });
});
