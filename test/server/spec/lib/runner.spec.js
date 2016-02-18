"use strict";

var runner = require("../../../../lib/runner");

require("../base.spec");

describe("lib/runner", function () {

  describe("#cmdWithCustom", function () {
    var cmdWithCustom = runner._cmdWithCustom;

    describe("shell command", function () {

      it("handles base cases", function () {
        expect(cmdWithCustom("foo")).to.equal("foo");
        expect(cmdWithCustom("foo --before")).to.equal("foo --before");
        expect(cmdWithCustom("bar", { _customFlags: [] })).to.equal("bar");
      });

      it("adds custom arguments", function () {
        expect(cmdWithCustom("foo", { _customFlags: ["--bar"] })).to.equal("foo --bar");
        expect(cmdWithCustom("foo --before", { _customFlags: ["--bar", "2", "--baz=3"] }))
          .to.equal("foo --before --bar 2 --baz=3");
      });

      it("handles quoted --", function () {
        expect(cmdWithCustom("foo \"-- in quotes\"", { _customFlags: ["--bar"] }))
          .to.equal("foo \"-- in quotes\" --bar");
        expect(cmdWithCustom("foo '-- in quotes'", { _customFlags: ["--bar"] }))
          .to.equal("foo '-- in quotes' --bar");
        expect(cmdWithCustom("foo '{\"--\": \"in -- json\"}'", { _customFlags: ["--bar"] }))
          .to.equal("foo '{\"--\": \"in -- json\"}' --bar");
      });

      it("adds custom arguments with existing custom arguments", function () {
        expect(cmdWithCustom("foo -- --first", { _customFlags: ["--second"] }))
          .to.equal("foo -- --first --second");
        expect(cmdWithCustom("foo --before -- --first", { _customFlags: ["--second"] }))
          .to.equal("foo --before -- --first --second");
      });
    });

    describe("builder", function () {

      it("handles base cases", function () {
        expect(cmdWithCustom("builder"), { _isBuilderTask: true }).to.equal("builder");
        expect(cmdWithCustom("builder --before", { _isBuilderTask: true }))
          .to.equal("builder --before");
      });

      it("adds custom arguments", function () {
        var env;

        env = {};
        expect(cmdWithCustom("builder", { _customFlags: ["--bar"], _isBuilderTask: true }, env))
          .to.equal("builder");
        expect(env).to.have.property("_BUILDER_ARGS_CUSTOM_FLAGS")
          .that.equals(JSON.stringify(["--bar"]));

        // Add in environment.
        env = { _BUILDER_ARGS_CUSTOM_FLAGS: JSON.stringify(["--env", "hi"]) };
        expect(cmdWithCustom("builder --before",
          { _customFlags: ["--bar", "2", "--baz=3"], _isBuilderTask: true }, env))
          .to.equal("builder --before");
        expect(env).to.have.property("_BUILDER_ARGS_CUSTOM_FLAGS")
          .that.equals(JSON.stringify(["--bar", "2", "--baz=3", "--env", "hi"]));
      });

      it("handles quoted --", function () {
        var env;

        env = {};
        expect(cmdWithCustom("builder \"-- in quotes\"",
          { _customFlags: ["--bar"], _isBuilderTask: true }, env))
          .to.equal("builder \"-- in quotes\"");
        expect(env).to.have.property("_BUILDER_ARGS_CUSTOM_FLAGS")
          .that.equals(JSON.stringify(["--bar"]));

        env = {};
        expect(cmdWithCustom("builder '-- in quotes'",
          { _customFlags: ["--bar"], _isBuilderTask: true }, env))
          .to.equal("builder '-- in quotes'");
        expect(env).to.have.property("_BUILDER_ARGS_CUSTOM_FLAGS")
          .that.equals(JSON.stringify(["--bar"]));

        env = {};
        expect(cmdWithCustom("builder '{\"--\": \"in -- json\"}'",
          { _customFlags: ["--bar"], _isBuilderTask: true }, env))
          .to.equal("builder '{\"--\": \"in -- json\"}'");
        expect(env).to.have.property("_BUILDER_ARGS_CUSTOM_FLAGS")
          .that.equals(JSON.stringify(["--bar"]));
      });

      it("adds custom arguments with existing custom arguments", function () {
        var env;

        env = {};
        expect(cmdWithCustom("builder -- --first",
          { _customFlags: ["--second"], _isBuilderTask: true }, env))
          .to.equal("builder -- --first");
        expect(env).to.have.property("_BUILDER_ARGS_CUSTOM_FLAGS")
          .that.equals(JSON.stringify(["--second"]));

        env = {};
        expect(cmdWithCustom("builder --before -- --first",
          { _customFlags: ["--second"], _isBuilderTask: true }, env))
          .to.equal("builder --before -- --first");
        expect(env).to.have.property("_BUILDER_ARGS_CUSTOM_FLAGS")
          .that.equals(JSON.stringify(["--second"]));
      });
    });

  });

});
