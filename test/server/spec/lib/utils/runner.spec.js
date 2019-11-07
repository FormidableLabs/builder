"use strict";

const runner = require("../../../../../lib/utils/runner");

require("../../base.spec");

describe("lib/utils/runner", () => {
  describe("#cmdWithCustom", () => {
    const cmdWithCustom = runner._cmdWithCustom;

    describe("shell command", () => {
      it("handles base cases", () => {
        expect(cmdWithCustom("foo")).to.equal("foo");
        expect(cmdWithCustom("foo --before")).to.equal("foo --before");
        expect(cmdWithCustom("bar", { _customFlags: [] })).to.equal("bar");
      });

      it("adds custom arguments", () => {
        expect(cmdWithCustom("foo", { _customFlags: ["--bar"] })).to.equal("foo --bar");
        expect(cmdWithCustom("foo --before", { _customFlags: ["--bar", "2", "--baz=3"] }))
          .to.equal("foo --before --bar 2 --baz=3");
      });

      it("handles quoted --", () => {
        expect(cmdWithCustom("foo \"-- in quotes\"", { _customFlags: ["--bar"] }))
          .to.equal("foo \"-- in quotes\" --bar");
        expect(cmdWithCustom("foo '-- in quotes'", { _customFlags: ["--bar"] }))
          .to.equal("foo '-- in quotes' --bar");
        expect(cmdWithCustom("foo '{\"--\": \"in -- json\"}'", { _customFlags: ["--bar"] }))
          .to.equal("foo '{\"--\": \"in -- json\"}' --bar");
      });

      it("adds custom arguments with existing custom arguments", () => {
        expect(cmdWithCustom("foo -- --first", { _customFlags: ["--second"] }))
          .to.equal("foo -- --first --second");
        expect(cmdWithCustom("foo --before -- --first", { _customFlags: ["--second"] }))
          .to.equal("foo --before -- --first --second");
      });
    });

    describe("builder", () => {
      it("handles base cases", () => {
        expect(cmdWithCustom("builder"), { _isBuilderTask: true }).to.equal("builder");
        expect(cmdWithCustom("builder --before", { _isBuilderTask: true }))
          .to.equal("builder --before");
      });

      it("adds custom arguments", () => {
        let env;

        env = {};
        expect(cmdWithCustom("builder", { _customFlags: ["--bar"],
          _isBuilderTask: true }, env))
          .to.equal("builder");
        expect(env).to.have.property("_BUILDER_ARGS_CUSTOM_FLAGS")
          .that.equals(JSON.stringify(["--bar"]));

        // Add in environment.
        env = { _BUILDER_ARGS_CUSTOM_FLAGS: JSON.stringify(["--env", "hi"]) };
        expect(cmdWithCustom("builder --before",
          { _customFlags: ["--bar", "2", "--baz=3"],
            _isBuilderTask: true }, env))
          .to.equal("builder --before");
        expect(env).to.have.property("_BUILDER_ARGS_CUSTOM_FLAGS")
          .that.equals(JSON.stringify(["--bar", "2", "--baz=3", "--env", "hi"]));
      });

      it("handles quoted --", () => {
        let env;

        env = {};
        expect(cmdWithCustom("builder \"-- in quotes\"",
          { _customFlags: ["--bar"],
            _isBuilderTask: true }, env))
          .to.equal("builder \"-- in quotes\"");
        expect(env).to.have.property("_BUILDER_ARGS_CUSTOM_FLAGS")
          .that.equals(JSON.stringify(["--bar"]));

        env = {};
        expect(cmdWithCustom("builder '-- in quotes'",
          { _customFlags: ["--bar"],
            _isBuilderTask: true }, env))
          .to.equal("builder '-- in quotes'");
        expect(env).to.have.property("_BUILDER_ARGS_CUSTOM_FLAGS")
          .that.equals(JSON.stringify(["--bar"]));

        env = {};
        expect(cmdWithCustom("builder '{\"--\": \"in -- json\"}'",
          { _customFlags: ["--bar"],
            _isBuilderTask: true }, env))
          .to.equal("builder '{\"--\": \"in -- json\"}'");
        expect(env).to.have.property("_BUILDER_ARGS_CUSTOM_FLAGS")
          .that.equals(JSON.stringify(["--bar"]));
      });

      it("adds custom arguments with existing custom arguments", () => {
        let env;

        env = {};
        expect(cmdWithCustom("builder -- --first",
          { _customFlags: ["--second"],
            _isBuilderTask: true }, env))
          .to.equal("builder -- --first");
        expect(env).to.have.property("_BUILDER_ARGS_CUSTOM_FLAGS")
          .that.equals(JSON.stringify(["--second"]));

        env = {};
        expect(cmdWithCustom("builder --before -- --first",
          { _customFlags: ["--second"],
            _isBuilderTask: true }, env))
          .to.equal("builder --before -- --first");
        expect(env).to.have.property("_BUILDER_ARGS_CUSTOM_FLAGS")
          .that.equals(JSON.stringify(["--second"]));
      });
    });
  });

  describe("#replaceToken", () => {
    const replaceToken = runner._replaceToken;

    it("leaves strings without tokens unchanged", () => {
      expect(replaceToken("", ["t"], "r")).to.equal("");
      expect(replaceToken(" ", ["t"], "r")).to.equal(" ");
      expect(replaceToken("  ", ["t"], "r")).to.equal("  ");
      expect(replaceToken("no_match", ["T"], "R")).to.equal("no_match");
    });

    it("skips tokens after slashes", () => {
      expect(replaceToken("/TOK", ["TOK"], "SUB")).to.equal("/TOK");
      expect(replaceToken("hello ./TOK", ["TOK"], "SUB")).to.equal("hello ./TOK");
      expect(replaceToken("/TOK/TOK/TOK", ["TOK"], "SUB")).to.equal("/TOK/TOK/TOK");
    });

    it("skips tokens after characters", () => {
      expect(replaceToken("aTOK", ["TOK"], "SUB")).to.equal("aTOK");
      expect(replaceToken("TKTOK ", ["TOK"], "SUB")).to.equal("TKTOK ");
      expect(replaceToken("TO.*KTOK", ["TOK"], "SUB")).to.equal("TO.*KTOK");
    });

    it("replaces at the beginning of strings", () => {
      expect(replaceToken("TOK", ["TOK"], "SUB")).to.equal("SUB");
      expect(replaceToken("TOK hello", ["TOK"], "SUB")).to.equal("SUB hello");
      expect(replaceToken("TOK [hello]*", ["TOK"], "SUB")).to.equal("SUB [hello]*");
      expect(replaceToken("TOK/  \/hi .* TOk/ ", ["TOK"], "SUB")).to.equal("SUB/  \/hi .* TOk/ ");
    });

    it("replaces after quotes", () => {
      expect(replaceToken("'TOK' \"TOK/More\"", ["TOK"], "SUB")).to.equal("'SUB' \"SUB/More\"");
      expect(replaceToken("T/K hello 'T/K/T/K'", ["T/K"], "S/B")).to.equal("S/B hello 'S/B/T/K'");
      expect(replaceToken("T\\K hello 'T\\K/T/K'", ["T/K", "T\\K"], "S/B"))
        .to.equal("S/B hello 'S/B/T/K'");
    });

    it("replaces after whitespace", () => {
      expect(replaceToken("TOK TOK", ["TOK"], "SUB")).to.equal("SUB SUB");
      expect(replaceToken("TOK hello TOK", ["TOK"], "SUB")).to.equal("SUB hello SUB");
      expect(replaceToken("echo TOK/foo/TOK", ["TOK"], "SUB")).to.equal("echo SUB/foo/TOK");
    });
  });
});
