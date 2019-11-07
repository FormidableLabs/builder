"use strict";

const childProcess = require("child_process");
const EventEmitter = require("events").EventEmitter;

const spawn = require("../../../../../lib/utils/spawn");

const base = require("../../base.spec");

describe("lib/utils/spawn", () => {
  beforeEach(() => {
    base.sandbox.stub(childProcess, "spawn", () => {
      const proc = new EventEmitter();
      base.sandbox.spy(proc, "on");
      return proc;
    });
  });

  it("calls child_process.spawn", () => {
    spawn("echo", ["hello"], {});
    expect(childProcess.spawn).to.be.calledWithMatch("echo", ["hello"], {});
  });

  it("listens to error and close events", () => {
    const proc = spawn("echo", ["hello"], {});
    expect(proc.on).to.be.calledWith("error");
    expect(proc.on).to.be.calledWith("close");
  });

  it("calls the given callback upon close", () => {
    const callback = base.sandbox.spy();
    const proc = spawn("echo", ["hello"], {}, callback);
    proc.emit("close", 0, null);
    expect(callback).to.be.calledWith(null);
  });

  it("passes error to the callback upon error", () => {
    const callback = base.sandbox.spy();
    const proc = spawn("echo", ["hello"], {}, callback);
    proc.emit("error", { message: "uh-oh" });
    expect(callback).to.not.be.called;
    proc.emit("close", 0, null);
    expect(callback).to.be.calledWithMatch({ message: "uh-oh" });
  });

  it("passes error to the callback upon non-zero exit", () => {
    const callback = base.sandbox.spy();
    const proc = spawn("echo", ["hello"], {}, callback);
    expect(callback).to.not.be.called;
    proc.emit("close", 1, null);
    expect(callback).to.be.calledWithMatch({ code: 1 });
  });
});
