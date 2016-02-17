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
        expect(cmdWithCustom("bar", { _customArgs: [] })).to.equal("bar");
      });

      it("adds custom arguments", function () {
        expect(cmdWithCustom("foo", { _customArgs: ["--bar"] })).to.equal("foo --bar");
        expect(cmdWithCustom("foo --before", { _customArgs: ["--bar", "2", "--baz=3"] }))
          .to.equal("foo --before --bar 2 --baz=3");
      });

      it("handles quoted --", function () {
        expect(cmdWithCustom("foo \"-- in quotes\"", { _customArgs: ["--bar"] }))
          .to.equal("foo \"-- in quotes\" --bar");
        expect(cmdWithCustom("foo '-- in quotes'", { _customArgs: ["--bar"] }))
          .to.equal("foo '-- in quotes' --bar");
        expect(cmdWithCustom("foo '{\"--\": \"in -- json\"}'", { _customArgs: ["--bar"] }))
          .to.equal("foo '{\"--\": \"in -- json\"}' --bar");
      });

      it("adds custom arguments with existing custom arguments", function () {
        expect(cmdWithCustom("foo -- --first", { _customArgs: ["--second"] }))
          .to.equal("foo -- --first --second");
        expect(cmdWithCustom("foo --before -- --first", { _customArgs: ["--second"] }))
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
        expect(cmdWithCustom("builder", { _customArgs: ["--bar"], _isBuilderTask: true }))
          .to.equal("builder -- --bar");

        // Preserve `--before` _before_ the `--`.
        expect(cmdWithCustom("builder --before",
          { _customArgs: ["--bar", "2", "--baz=3"], _isBuilderTask: true }))
          .to.equal("builder --before -- --bar 2 --baz=3");
      });

      it("handles quoted --", function () {
        expect(cmdWithCustom("builder \"-- in quotes\"",
          { _customArgs: ["--bar"], _isBuilderTask: true }))
          .to.equal("builder \"-- in quotes\" -- --bar");
        expect(cmdWithCustom("builder '-- in quotes'",
          { _customArgs: ["--bar"], _isBuilderTask: true }))
          .to.equal("builder '-- in quotes' -- --bar");
        expect(cmdWithCustom("builder '{\"--\": \"in -- json\"}'",
          { _customArgs: ["--bar"], _isBuilderTask: true }))
          .to.equal("builder '{\"--\": \"in -- json\"}' -- --bar");
      });

      it("adds custom arguments with existing custom arguments", function () {
        expect(cmdWithCustom("builder -- --first",
          { _customArgs: ["--second"], _isBuilderTask: true }))
          .to.equal("builder -- --first --second");
        expect(cmdWithCustom("builder --before -- --first",
          { _customArgs: ["--second"], _isBuilderTask: true }))
          .to.equal("builder --before -- --first --second");
      });
    });

  });

  describe("#replaceToken", function () {
    var replaceToken = runner._replaceToken;

    it("leaves strings without tokens unchanged", function () {
      expect(replaceToken("", "t", "r")).to.equal("");
      expect(replaceToken(" ", "t", "r")).to.equal(" ");
      expect(replaceToken("  ", "t", "r")).to.equal("  ");
      expect(replaceToken("no_match", "T", "R")).to.equal("no_match");
    });

    it("skips tokens after slashes");
    it("skips tokens after characters");
    it("replaces at the beginning of strings");
    it("replaces after quotes");
    it("replaces after whitespace");
  });

});
