"use strict";

var childProcess = require("child_process");
var EventEmitter = require("events").EventEmitter;

var spawn = require("../../../../../lib/utils/spawn");

var base = require("../../base.spec");

describe("lib/spawn", function () {
  beforeEach(function () {
    base.sandbox.stub(childProcess, "spawn", function () {
      var proc = new EventEmitter();
      base.sandbox.spy(proc, "on");
      return proc;
    });
  });

  it("calls child_process.spawn", function () {
    spawn("echo", ["hello"], {});
    expect(childProcess.spawn).to.be.calledWithMatch("echo", ["hello"], {});
  });

  it("listens to error and close events", function () {
    var proc = spawn("echo", ["hello"], {});
    expect(proc.on).to.be.calledWith("error");
    expect(proc.on).to.be.calledWith("close");
  });

  it("calls the given callback upon close", function () {
    var callback = base.sandbox.spy();
    var proc = spawn("echo", ["hello"], {}, callback);
    proc.emit("close", 0, null);
    expect(callback).to.be.calledWith(null);
  });

  it("passes error to the callback upon error", function () {
    var callback = base.sandbox.spy();
    var proc = spawn("echo", ["hello"], {}, callback);
    proc.emit("error", { message: "uh-oh" });
    expect(callback).to.not.be.called;
    proc.emit("close", 0, null);
    expect(callback).to.be.calledWithMatch({ message: "uh-oh" });
  });

  it("passes error to the callback upon non-zero exit", function () {
    var callback = base.sandbox.spy();
    var proc = spawn("echo", ["hello"], {}, callback);
    expect(callback).to.not.be.called;
    proc.emit("close", 1, null);
    expect(callback).to.be.calledWithMatch({ code: 1 });
  });
});
