"use strict";

var runner = require("../../../../lib/runner");

require("../base.spec");

describe("lib/runner", function () {

  describe("#cmdWithCustom", function () {
    var cmdWithCustom = runner._cmdWithCustom;

    it("handles base cases", function () {
      expect(cmdWithCustom("foo")).to.equal("foo");
      expect(cmdWithCustom("foo --before")).to.equal("foo --before");
      expect(cmdWithCustom("bar", { _customArgs: [] })).to.equal("bar");
    });

    it("adds custom arguments", function () {
      expect(cmdWithCustom("foo", { _customArgs: ["--bar"] })).to.equal("foo -- --bar");
      expect(cmdWithCustom("foo --before", { _customArgs: ["--bar", "2", "--baz=3"] }))
        .to.equal("foo --before -- --bar 2 --baz=3");
    });

    it("adds custom arguments with existing custom arguments", function () {
      expect(cmdWithCustom("foo -- --first", { _customArgs: ["--second"] }))
        .to.equal("foo -- --first --second");
      expect(cmdWithCustom("foo --before -- --first", { _customArgs: ["--second"] }))
        .to.equal("foo --before -- --first --second");
    });
  });

});
