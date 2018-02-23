"use strict";

var Task = require("../../../../lib/task");
var builderCliPath = require.resolve("../../../../bin/builder");

require("../base.spec");

describe("lib/task", function () {

  describe("#isBuilderTask", function () {
    var isBuilderTask = function (task, script) {
      script = script || builderCliPath;
      return Task.prototype.isBuilderTask.call({ _script: script }, task);
    };

    it("handles base misses", function () {
      expect(isBuilderTask("")).to.be.false;
      expect(isBuilderTask()).to.be.false;
      expect(isBuilderTask("bolder")).to.be.false;
      expect(isBuilderTask("buildr run foo")).to.be.false;
      expect(isBuilderTask("npm run foo")).to.be.false;
    });

    it("handles base matches", function () {
      expect(isBuilderTask("builder")).to.be.true;
      expect(isBuilderTask(" builder")).to.be.true;
      expect(isBuilderTask("builder run foo")).to.be.true;
    });

    it("handles node PATH matches for same path as builder", function () {
      expect(isBuilderTask("node " + builderCliPath + " foo")).to.be.true;
      expect(isBuilderTask("node bin/builder.js foo")).to.be.true;
      expect(isBuilderTask("node ./bin/builder.js foo")).to.be.true;
    });

    it("handles node PATH matches in node_modules/builder", function () {
      expect(isBuilderTask("node node_modules/builder/bin/builder.js foo")).to.be.true;
      expect(isBuilderTask("node ./node_modules/builder/bin/builder.js foo")).to.be.true;
      expect(isBuilderTask("node /ABS/PATH/node_modules/builder/bin/builder.js foo")).to.be.true;
    });

    it("handles node PATH matches in node_modules/.bin", function () {
      expect(isBuilderTask("node node_modules/.bin/builder foo")).to.be.true;
      expect(isBuilderTask("node ./node_modules/.bin/builder foo")).to.be.true;
      expect(isBuilderTask("node /ABS/PATH/node_modules/.bin/builder foo")).to.be.true;
    });
  });

});
