"use strict";

/**
 * These are _almost_ functional tests as we're basically invoking the entire
 * application, just:
 *
 * - Mocking filesystem
 * - Stubbing the logging abstraction to capture output
 *
 * Tests _do_ however use real process `exec`'s. This _slightly_ slows things
 * down, but allows us to have some very real use case scenarios.
 */
var fs = require("fs");
var path = require("path");
var chalk = require("chalk");

var pkg = require("../../../../package.json");
var Config = require("../../../../lib/config");
var Task = require("../../../../lib/task");
var log = require("../../../../lib/log");
var run = require("../../../../bin/builder-core");

var base = require("../base.spec");

// Read file, do assert callbacks, and trap everything, calling `done` at the
// end. A little limited in use as it's the *last* thing you can call in a
// given test, but we can abstract more later if needed.
var readFile = function (filename, callback, done) {
  base.mockFs.restore();
  fs.readFile(filename, { encoding: "utf8" }, function (err, data) {
    try {
      if (!err) {
        callback(data); // eslint-disable-line callback-return
      }
    } catch (assertErr) {
      err = assertErr;
    }

    done(err);
  });
};

describe("bin/builder-core", function () {
  var logStubs;

  beforeEach(function () {
    logStubs = {
      info: base.sandbox.spy(),
      warn: base.sandbox.spy(),
      error: base.sandbox.spy()
    };

    base.sandbox.stub(log, "_logger").returns(logStubs);

    // Skip `require()`-ing at all so we avoid `require` cache issues.
    base.sandbox.stub(Config.prototype, "_lazyRequire", function (mod) {
      if (base.fileExists(mod)) {
        return {
          mod: JSON.parse(base.fileRead(mod)),
          path: path.dirname(path.resolve(mod))
        };
      } else if (base.fileExists(path.join("node_modules", mod))) {
        return {
          mod: JSON.parse(base.fileRead(path.join("node_modules", mod))),
          path: path.dirname(path.resolve(path.join("node_modules", mod)))
        };
      }
      throw new Error("Cannot require: " + mod);
    });
  });

  afterEach(function () {
    // Remove mutations to the process environment.
    delete process.env.npm_package_config__test_message; // eslint-disable-line camelcase
  });

  describe("errors", function () {

    it("errors on invalid action", function () {
      base.mockFs({
        "package.json": "{}"
      });

      var callback = base.sandbox.spy();

      try {
        run({
          argv: ["node", "builder", "bad-action"]
        }, callback);
      } catch (err) {
        expect(err).to.have.property("message").that.contains("Invalid action: bad-action");
        expect(callback).to.not.be.called;
        return;
      }

      throw new Error("should have already thrown");
    });

    it("errors on bad log level", function () {
      base.mockFs({
        "package.json": "{}"
      });

      var callback = base.sandbox.spy();

      try {
        run({
          argv: ["node", "builder", "help", "--log-level=BAD"]
        }, callback);
      } catch (err) {
        expect(err).to.have.property("message").that.contains("Unknown log level: BAD");
        expect(callback).to.not.be.called;
        return;
      }

      throw new Error("should have already thrown");
    });

  });

  describe("builder --version", function () {

    it("runs version", function (done) {
      base.sandbox.spy(process.stdout, "write");
      base.sandbox.spy(Task.prototype, "version");
      base.mockFs({
        "package.json": "{}"
      });

      run({
        argv: ["node", "builder", "--version"]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.version).to.be.calledOnce;
        expect(process.stdout.write).to.be.calledWithMatch(pkg.version);

        done();
      });
    });

  });

  describe("builder help", function () {

    it("runs help with no arguments", function (done) {
      base.sandbox.spy(Task.prototype, "help");
      base.mockFs({
        "package.json": "{}"
      });

      run({
        argv: ["node", "builder"]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.help).to.be.calledOnce;
        expect(logStubs.info).to.be.calledWithMatch("builder <action> <task(s)>");

        done();
      });
    });

    it("runs help with `builder run` alone", function (done) {
      base.sandbox.spy(Task.prototype, "help");
      base.mockFs({
        "package.json": "{}"
      });

      run({
        argv: ["node", "builder", "run"]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.help).to.be.calledOnce;
        expect(logStubs.info).to.be.calledWithMatch("builder <action> <task(s)>");

        done();
      });
    });

    it("runs help with flags", function (done) {
      base.sandbox.spy(Task.prototype, "help");
      base.sandbox.spy(Task.prototype, "run");
      base.mockFs({
        "package.json": "{}"
      });

      run({
        argv: ["node", "builder", "run", "foo", "--help"]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.help).to.be.calledOnce;
        expect(Task.prototype.run).to.not.be.called;
        expect(logStubs.info).to.be.calledWithMatch("builder <action> <task(s)>");

        done();
      });
    });

    it("runs help for run command", function (done) {
      base.sandbox.spy(Task.prototype, "help");
      base.mockFs({
        "package.json": "{}"
      });

      run({
        argv: ["node", "builder", "help", "run"]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.help).to.be.calledOnce;
        expect(logStubs.info).to.be.calledWithMatch("builder " + chalk.red("run") + " <task(s)>");

        done();
      });
    });

    // Regression test for: https://github.com/FormidableLabs/builder/issues/113
    it("runs help with config in archetype", function (done) {
      base.sandbox.spy(Task.prototype, "help");
      base.mockFs({
        ".builderrc": "---\narchetypes:\n  - mock-archetype",
        "package.json": "{}",
        "node_modules": {
          "mock-archetype": {
            "package.json": JSON.stringify({
              "config": {
                "_test_message": "from archetype"
              }
            }, null, 2)
          }
        }
      });

      run({
        argv: ["node", "builder", "help"]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.help).to.be.calledOnce;
        expect(logStubs.info)
          .to.be.calledWithMatch("Task Configs").and
          .to.be.calledWithMatch("_test_message");

        done();
      });
    });

  });

  describe("builder run", function () {

    it("runs a <root>/package.json command", function (done) {
      base.sandbox.spy(Task.prototype, "run");
      base.mockFs({
        "package.json": JSON.stringify({
          "scripts": {
            "bar": "echo BAR_TASK >> stdout.log"
          }
        }, null, 2)
      });

      run({
        argv: ["node", "builder", "run", "bar"]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.run).to.be.calledOnce;

        readFile("stdout.log", function (data) {
          expect(data).to.contain("BAR_TASK");
        }, done);
      });

    });

    it("runs with quiet log output", function (done) {
      base.sandbox.spy(Task.prototype, "run");
      base.mockFs({
        "package.json": JSON.stringify({
          "scripts": {
            "bar": "echo BAR_TASK >> stdout.log"
          }
        }, null, 2)
      });

      run({
        argv: ["node", "builder", "run", "--quiet", "bar"]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.run).to.be.calledOnce;
        expect(logStubs.info).not.be.called;
        expect(logStubs.warn).not.be.called;
        expect(logStubs.error).not.be.called;

        readFile("stdout.log", function (data) {
          expect(data).to.contain("BAR_TASK");
        }, done);
      });
    });

    it("runs with specified log level", function (done) {
      base.sandbox.spy(Task.prototype, "run");
      base.mockFs({
        "package.json": JSON.stringify({
          "scripts": {
            "bar": "BAD_COMMAND 2>> stderr.log"
          }
        }, null, 2)
      });

      run({
        argv: ["node", "builder", "run", "--log-level=error", "bar"]
      }, function (err) {
        expect(err).to.have.property("message")
          .that.contains("Command failed").and
          .that.contains("BAD_COMMAND");

        expect(Task.prototype.run).to.be.calledOnce;
        expect(logStubs.info).not.be.called;
        expect(logStubs.warn).not.be.called;
        expect(logStubs.error)
          .to.be.calledWithMatch("Command failed").and
          .to.be.calledWithMatch("BAD_COMMAND");

        readFile("stderr.log", function (data) {
          expect(data).to.contain("BAD_COMMAND");
        }, done);
      });

    });

    it("runs an <archetype>/package.json command", function (done) {
      base.sandbox.spy(Task.prototype, "run");
      base.mockFs({
        ".builderrc": "---\narchetypes:\n  - mock-archetype",
        "package.json": "{}",
        "node_modules": {
          "mock-archetype": {
            "package.json": JSON.stringify({
              "scripts": {
                "foo": "echo FOO_TASK >> stdout.log"
              }
            }, null, 2)
          }
        }
      });

      run({
        argv: ["node", "builder", "run", "foo"]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.run).to.be.calledOnce;

        readFile("stdout.log", function (data) {
          expect(data).to.contain("FOO_TASK");
        }, done);
      });

    });

    it("ignores archetype builder:-prefaced tasks", function () {
      base.mockFs({
        ".builderrc": "---\narchetypes:\n  - mock-archetype",
        "package.json": "{}",
        "node_modules": {
          "mock-archetype": {
            "package.json": JSON.stringify({
              "scripts": {
                "builder:foo": "echo FOO"
              }
            }, null, 2)
          }
        }
      });

      var callback = base.sandbox.spy();

      try {
        run({
          argv: ["node", "builder", "run", "builder:foo"]
        }, callback);
      } catch (err) {
        expect(err).to.have.property("message")
          .that.contains("Unable to find task for: builder:foo");
        expect(callback).to.not.be.called;
        return;
      }

      throw new Error("should have already thrown");
    });

    it("overrides a <archetype> command with a <root> one", function (done) {
      base.sandbox.spy(Task.prototype, "run");
      base.mockFs({
        ".builderrc": "---\narchetypes:\n  - mock-archetype",
        "package.json": JSON.stringify({
          "scripts": {
            "foo": "echo ROOT_TASK >> stdout.log"
          }
        }, null, 2),
        "node_modules": {
          "mock-archetype": {
            "package.json": JSON.stringify({
              "scripts": {
                "foo": "echo ARCH_TASK >> stdout.log"
              }
            }, null, 2)
          }
        }
      });

      run({
        argv: ["node", "builder", "run", "foo"]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.run).to.be.calledOnce;

        readFile("stdout.log", function (data) {
          expect(data).to.contain("ROOT_TASK");
        }, done);
      });

    });

    // TODO: This one is going to be... tough.
    // https://github.com/FormidableLabs/builder/issues/9
    it("overrides a <archetype> command with a <root> one in a composed <archetype> command");

    it("runs with --setup", function (done) {
      base.sandbox.spy(Task.prototype, "run");
      base.mockFs({
        "package.json": JSON.stringify({
          "scripts": {
            // *real* fs for script references. (`0` runs forever).
            "setup": "node test/server/fixtures/repeat-script.js 0 SETUP >> stdout.log",
            "bar": "node test/server/fixtures/repeat-script.js 5 BAR_TASK >> stdout.log"
          }
        }, null, 2)
      });

      run({
        argv: ["node", "builder", "run", "bar", "--setup=setup"]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.run).to.have.callCount(2);

        readFile("stdout.log", function (data) {
          expect(data)
            .to.contain("SETUP").and
            .to.contain("BAR_TASK").and
            .to.contain("EXIT - BAR_TASK - 0");
        }, done);
      });

    });

    it("handles --setup early 0 exit", function (done) {
      base.sandbox.spy(Task.prototype, "run");
      base.mockFs({
        "package.json": JSON.stringify({
          "scripts": {
            "setup": "node test/server/fixtures/repeat-script.js 2 SETUP",
            "bar": "sleep 10"
          }
        }, null, 2)
      });

      run({
        argv: ["node", "builder", "run", "bar", "--setup=setup"]
      }, function (err) {
        expect(err).to.have.property("message")
          .that.contains("Setup exited with code: 0");

        expect(Task.prototype.run).to.have.callCount(2);
        expect(logStubs.error)
          .to.be.calledWithMatch("run bar").and
          .to.be.calledWithMatch("Setup exited with code: 0");

        done();
      });

    });

    it("handles --setup early 1 exit", function (done) {
      base.sandbox.spy(Task.prototype, "run");
      base.mockFs({
        "package.json": JSON.stringify({
          "scripts": {
            "setup": "node test/server/fixtures/repeat-script.js 2 SETUP 1",
            "bar": "sleep 10"
          }
        }, null, 2)
      });

      run({
        argv: ["node", "builder", "run", "bar", "--setup=setup"]
      }, function (err) {
        expect(err).to.have.property("message")
          .that.contains("Setup exited with code: 1");

        expect(Task.prototype.run).to.have.callCount(2);
        expect(logStubs.error)
          .to.be.calledWithMatch("run bar").and
          .to.be.calledWithMatch("Setup exited with code: 1");

        done();
      });

    });

    it("runs with --tries=2", function (done) {
      base.sandbox.spy(Task.prototype, "run");
      base.mockFs({
        "package.json": JSON.stringify({
          "scripts": {
            "foo": "BAD_COMMAND 2>> stderr.log"
          }
        }, null, 2)
      });

      run({
        argv: ["node", "builder", "run", "foo", "--tries=2"]
      }, function (err) {
        expect(err).to.have.property("message")
          .that.contains("Command failed").and
          .that.contains("BAD_COMMAND");

        expect(Task.prototype.run).to.be.calledOnce;
        expect(logStubs.warn).to.be.calledWithMatch(chalk.red("1") + " tries left");
        expect(logStubs.error)
          .to.be.calledWithMatch("Command failed").and
          .to.be.calledWithMatch("BAD_COMMAND");

        readFile("stderr.log", function (data) {
          expect(data).to.contain("BAD_COMMAND");
        }, done);
      });

    });

    it("runs with base config value", function (done) {
      base.sandbox.spy(Task.prototype, "run");
      base.mockFs({
        "package.json": JSON.stringify({
          "config": {
            "_test_message": "from base config"
          },
          "scripts": {
            "echo": "node test/server/fixtures/echo.js >> stdout.log"
          }
        }, null, 2)
      });

      run({
        argv: ["node", "builder", "run", "echo"]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.run).to.have.callCount(1);

        readFile("stdout.log", function (data) {
          expect(data).to.contain("string - from base config");
        }, done);
      });
    });

    it("runs with archetype config value", function (done) {
      base.sandbox.spy(Task.prototype, "run");
      base.mockFs({
        ".builderrc": "---\narchetypes:\n  - mock-archetype",
        "package.json": "{}",
        "node_modules": {
          "mock-archetype": {
            "package.json": JSON.stringify({
              "config": {
                "_test_message": "from archetype"
              },
              "scripts": {
                "echo": "node test/server/fixtures/echo.js >> stdout.log"
              }
            }, null, 2)
          }
        }
      });

      run({
        argv: ["node", "builder", "run", "echo"]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.run).to.have.callCount(1);

        readFile("stdout.log", function (data) {
          expect(data).to.contain("string - from archetype");
        }, done);
      });
    });

    it("runs with empty base + non-empty archetype config value", function (done) {
      base.sandbox.spy(Task.prototype, "run");
      base.mockFs({
        ".builderrc": "---\narchetypes:\n  - mock-archetype",
        "package.json": JSON.stringify({
          "config": {
            "_test_message": "" // base with empty strings wins.
          }
        }, null, 2),
        "node_modules": {
          "mock-archetype": {
            "package.json": JSON.stringify({
              "config": {
                "_test_message": "from archetype"
              },
              "scripts": {
                "echo": "node test/server/fixtures/echo.js >> stdout.log"
              }
            }, null, 2)
          }
        }
      });

      run({
        argv: ["node", "builder", "run", "echo"]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.run).to.have.callCount(1);

        readFile("stdout.log", function (data) {
          expect(data).to.contain("string - EMPTY");
        }, done);
      });
    });

    it("runs with real ENV overriding archetype config value", function (done) {
      base.sandbox.spy(Task.prototype, "run");
      base.mockFs({
        ".builderrc": "---\narchetypes:\n  - mock-archetype",
        "package.json": "{}",
        "node_modules": {
          "mock-archetype": {
            "package.json": JSON.stringify({
              "config": {
                "_test_message": "from archetype"
              },
              "scripts": {
                "echo": "node test/server/fixtures/echo.js >> stdout.log"
              }
            }, null, 2)
          }
        }
      });

      /*eslint-disable camelcase*/
      process.env.npm_package_config__test_message = "from real env";
      /*eslint-enable camelcase*/

      run({
        argv: ["node", "builder", "run", "echo"]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.run).to.have.callCount(1);

        readFile("stdout.log", function (data) {
          expect(data).to.contain("string - from real env");
        }, done);
      });
    });

    it("runs with real ENV overriding base + archetype config values", function (done) {
      base.sandbox.spy(Task.prototype, "run");
      base.mockFs({
        ".builderrc": "---\narchetypes:\n  - mock-archetype",
        "package.json": JSON.stringify({
          "config": {
            "_test_message": "from base"
          }
        }, null, 2),
        "node_modules": {
          "mock-archetype": {
            "package.json": JSON.stringify({
              "config": {
                "_test_message": "from archetype"
              },
              "scripts": {
                "echo": "node test/server/fixtures/echo.js >> stdout.log"
              }
            }, null, 2)
          }
        }
      });

      /*eslint-disable camelcase*/
      process.env.npm_package_config__test_message = "from real env";
      /*eslint-enable camelcase*/

      run({
        argv: ["node", "builder", "run", "echo"]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.run).to.have.callCount(1);

        readFile("stdout.log", function (data) {
          expect(data).to.contain("string - from real env");
        }, done);
      });
    });

    describe("expands paths with --expand-archetype", function () {

      it("Skips `../node_modules/<archetype>`", function (done) {
        base.sandbox.spy(Task.prototype, "run");
        base.mockFs({
          ".builderrc": "---\narchetypes:\n  - mock-archetype",
          "package.json": JSON.stringify({}, null, 2),
          "node_modules": {
            "mock-archetype": {
              "package.json": JSON.stringify({
                "scripts": {
                  "bar": "echo WONT_EXPAND ../node_modules/mock-archetype/A_FILE.txt >> stdout.log"
                }
              }, null, 2)
            }
          }
        });

        run({
          argv: ["node", "builder", "--expand-archetype", "run", "bar"]
        }, function (err) {
          if (err) { return done(err); }

          expect(Task.prototype.run).to.be.calledOnce;

          readFile("stdout.log", function (data) {
            expect(data).to.contain(
              "WONT_EXPAND ../node_modules/mock-archetype/A_FILE.txt"
            );
          }, done);
        });
      });

      it("Skips `other/node_modules/<archetype>`", function (done) {
        base.sandbox.spy(Task.prototype, "run");
        base.mockFs({
          ".builderrc": "---\narchetypes:\n  - mock-archetype",
          "package.json": JSON.stringify({}, null, 2),
          "node_modules": {
            "mock-archetype": {
              "package.json": JSON.stringify({
                "scripts": {
                  "bar": "echo WONT_EXPAND " +
                    "other/node_modules/mock-archetype/A_FILE.txt >> stdout.log"
                }
              }, null, 2)
            }
          }
        });

        run({
          argv: ["node", "builder", "--expand-archetype", "run", "bar"]
        }, function (err) {
          if (err) { return done(err); }

          expect(Task.prototype.run).to.be.calledOnce;

          readFile("stdout.log", function (data) {
            expect(data).to.contain(
              "WONT_EXPAND other/node_modules/mock-archetype/A_FILE.txt"
            );
          }, done);
        });
      });

      it("Replaces `node_modules/<archetype>`", function (done) {
        base.sandbox.spy(Task.prototype, "run");
        base.mockFs({
          ".builderrc": "---\narchetypes:\n  - mock-archetype",
          "package.json": JSON.stringify({}, null, 2),
          "node_modules": {
            "mock-archetype": {
              "package.json": JSON.stringify({
                "scripts": {
                  "bar": "echo EXPANDED node_modules/mock-archetype/A_FILE.txt >> stdout.log"
                }
              }, null, 2)
            }
          }
        });

        run({
          argv: ["node", "builder", "--expand-archetype", "run", "bar"]
        }, function (err) {
          if (err) { return done(err); }

          expect(Task.prototype.run).to.be.calledOnce;

          readFile("stdout.log", function (data) {
            expect(data).to.contain(
              "EXPANDED " + path.join(process.cwd(), "node_modules/mock-archetype/A_FILE.txt")
            );
          }, done);
        });
      });

      it("Replaces `\"node_modules/<archetype>`", function (done) {
        base.sandbox.spy(Task.prototype, "run");
        base.mockFs({
          ".builderrc": "---\narchetypes:\n  - mock-archetype",
          "package.json": JSON.stringify({}, null, 2),
          "node_modules": {
            "mock-archetype": {
              "package.json": JSON.stringify({
                "scripts": {
                  // Note: Need double escaping here for command line echo.
                  // Note: Not sure if the quote escaping is the same on windows.
                  "bar": "echo EXPANDED " +
                    "\\\"node_modules/mock-archetype/A_FILE.txt\\\" >> stdout.log"
                }
              }, null, 2)
            }
          }
        });

        run({
          argv: ["node", "builder", "--expand-archetype", "run", "bar"]
        }, function (err) {
          if (err) { return done(err); }

          expect(Task.prototype.run).to.be.calledOnce;

          readFile("stdout.log", function (data) {
            expect(data).to.contain(
              "EXPANDED \"" + path.join(process.cwd(), "node_modules/mock-archetype/A_FILE.txt\"")
            );
          }, done);
        });
      });

      it("Propagates flag to sub-task", function (done) {
        base.sandbox.spy(Task.prototype, "run");
        base.mockFs({
          ".builderrc": "---\narchetypes:\n  - mock-archetype",
          "package.json": JSON.stringify({}, null, 2),
          "node_modules": {
            "mock-archetype": {
              "package.json": JSON.stringify({
                "scripts": {
                  "bar": "echo EXPANDED node_modules/mock-archetype/A_FILE.txt >> stdout.log"
                }
              }, null, 2)
            }
          }
        });

        process.env._BUILDER_ARGS_EXPAND_ARCHETYPE = "true";

        run({
          argv: ["node", "builder", "run", "bar"]
        }, function (err) {
          if (err) { return done(err); }

          expect(Task.prototype.run).to.be.calledOnce;

          readFile("stdout.log", function (data) {
            expect(data).to.contain(
              "EXPANDED " + path.join(process.cwd(), "node_modules/mock-archetype/A_FILE.txt")
            );
          }, done);
        });
      });

      it("Skips replacing root project tasks", function (done) {
        base.sandbox.spy(Task.prototype, "run");
        base.mockFs({
          ".builderrc": "---\narchetypes:\n  - mock-archetype",
          "package.json": JSON.stringify({
            "scripts": {
              "bar": "echo WONT_EXPAND node_modules/mock-archetype/A_FILE.txt >> stdout.log"
            }
          }, null, 2),
          "node_modules": {
            "mock-archetype": {
              "package.json": JSON.stringify({}, null, 2)
            }
          }
        });

        run({
          argv: ["node", "builder", "--expand-archetype", "run", "bar"]
        }, function (err) {
          if (err) { return done(err); }

          expect(Task.prototype.run).to.be.calledOnce;

          readFile("stdout.log", function (data) {
            expect(data).to.contain(
              "WONT_EXPAND node_modules/mock-archetype/A_FILE.txt"
            );
          }, done);
        });
      });

    });

  });

  describe("builder concurrent", function () {

    it("runs <root>/package.json concurrent commands", function (done) {
      base.sandbox.spy(Task.prototype, "concurrent");
      base.mockFs({
        "package.json": JSON.stringify({
          "scripts": {
            "one": "echo ONE_TASK >> stdout.log",
            "two": "echo TWO_TASK >> stdout.log",
            "three": "echo THREE_TASK >> stdout.log"
          }
        }, null, 2)
      });

      run({
        argv: ["node", "builder", "concurrent", "one", "two", "three"]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.concurrent).to.be.calledOnce;

        readFile("stdout.log", function (data) {
          expect(data)
            .to.contain("ONE_TASK").and
            .to.contain("TWO_TASK").and
            .to.contain("THREE_TASK");
        }, done);
      });

    });

    it("runs <archetype>/package.json concurrent commands", function (done) {
      base.sandbox.spy(Task.prototype, "concurrent");
      base.mockFs({
        ".builderrc": "---\narchetypes:\n  - mock-archetype",
        "package.json": JSON.stringify({
          "scripts": {
            "two": "echo TWO_ROOT_TASK >> stdout.log",
            "three": "echo THREE_ROOT_TASK >> stdout.log"
          }
        }, null, 2),
        "node_modules": {
          "mock-archetype": {
            "package.json": JSON.stringify({
              "scripts": {
                "one": "echo ONE_TASK >> stdout.log",
                "two": "echo TWO_TASK >> stdout.log",
                "three": "echo THREE_TASK >> stdout.log"
              }
            }, null, 2)
          }
        }
      });

      run({
        argv: ["node", "builder", "concurrent", "one", "two", "three"]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.concurrent).to.be.calledOnce;

        readFile("stdout.log", function (data) {
          expect(data)
            .to.contain("ONE_TASK").and
            .to.contain("TWO_ROOT_TASK").and
            .to.contain("THREE_ROOT_TASK");
        }, done);
      });

    });

    // TODO: Finish outlined tests.
    // https://github.com/FormidableLabs/builder/issues/9
    it("runs with --tries=2");
    it("runs with --setup");
    it("runs with --queue=1, --bail=false");

    it("runs with base overriding archetype config value", function (done) {
      base.sandbox.spy(Task.prototype, "concurrent");
      base.mockFs({
        ".builderrc": "---\narchetypes:\n  - mock-archetype",
        "package.json": JSON.stringify({
          "config": {
            "_test_message": "from base"
          },
          "scripts": {
            "echo2": "node test/server/fixtures/echo.js TWO >> stdout.log"
          }
        }, null, 2),
        "node_modules": {
          "mock-archetype": {
            "package.json": JSON.stringify({
              "config": {
                "_test_message": "from archetype"
              },
              "scripts": {
                "echo1": "node test/server/fixtures/echo.js ONE >> stdout.log"
              }
            }, null, 2)
          }
        }
      });

      run({
        argv: ["node", "builder", "concurrent", "echo1", "echo2"]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.concurrent).to.have.callCount(1);

        readFile("stdout.log", function (data) {
          expect(data)
            .to.contain("string - from base - ONE").and
            .to.contain("string - from base - TWO");
        }, done);
      });
    });

  });

  describe("builder envs", function () {

    it("runs <root>/package.json multiple env commands", function (done) {
      base.sandbox.spy(Task.prototype, "envs");
      base.mockFs({
        "package.json": JSON.stringify({
          "scripts": {
            "echo": "echo ROOT " + (/^win/.test(process.platform) ? "%MY_VAR%" : "$MY_VAR") +
              " >> stdout.log"
          }
        }, null, 2)
      });

      run({
        argv: ["node", "builder", "envs", "echo", JSON.stringify([
          { MY_VAR: "hi" },
          { MY_VAR: "ho" },
          { MY_VAR: "yo" }
        ])]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.envs).to.be.calledOnce;

        readFile("stdout.log", function (data) {
          expect(data)
            .to.contain("ROOT hi").and
            .to.contain("ROOT ho").and
            .to.contain("ROOT yo");
        }, done);
      });

    });

    it("runs multiple env commands with --buffer, --envs-path", function (done) {
      base.sandbox.spy(Task.prototype, "envs");
      base.mockFs({
        "package.json": JSON.stringify({
          "scripts": {
            "echo": "echo ROOT " + (/^win/.test(process.platform) ? "%MY_VAR%" : "$MY_VAR") +
              " >> stdout.log"
          }
        }, null, 2),
        "envs.json": JSON.stringify([
          { MY_VAR: "hi" },
          { MY_VAR: "ho" },
          { MY_VAR: "yo" }
        ])
      });

      run({
        argv: ["node", "builder", "envs", "--buffer", "echo", "--envs-path=envs.json"]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.envs).to.be.calledOnce;

        readFile("stdout.log", function (data) {
          expect(data)
            .to.contain("ROOT hi").and
            .to.contain("ROOT ho").and
            .to.contain("ROOT yo");
        }, done);
      });

    });

    it("runs <archetype>/package.json multiple env commands", function (done) {
      base.sandbox.spy(Task.prototype, "envs");
      base.mockFs({
        ".builderrc": "---\narchetypes:\n  - mock-archetype",
        "package.json": "{}",
        "node_modules": {
          "mock-archetype": {
            "package.json": JSON.stringify({
              "scripts": {
                "echo": "echo ARCH " + (/^win/.test(process.platform) ? "%MY_VAR%" : "$MY_VAR") +
                  " >> stdout.log"
              }
            }, null, 2)
          }
        }
      });

      run({
        argv: ["node", "builder", "envs", "echo", JSON.stringify([
          { MY_VAR: "hi" },
          { MY_VAR: "ho" },
          { MY_VAR: "yo" }
        ])]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.envs).to.be.calledOnce;

        readFile("stdout.log", function (data) {
          expect(data)
            .to.contain("ARCH hi").and
            .to.contain("ARCH ho").and
            .to.contain("ARCH yo");
        }, done);
      });

    });

    it("overrides <archetype>/package.json multiple env commands", function (done) {
      base.sandbox.spy(Task.prototype, "envs");
      base.mockFs({
        ".builderrc": "---\narchetypes:\n  - mock-archetype",
        "package.json": JSON.stringify({
          "scripts": {
            "echo": "echo ROOT " + (/^win/.test(process.platform) ? "%MY_VAR%" : "$MY_VAR") +
              " >> stdout.log"
          }
        }, null, 2),
        "node_modules": {
          "mock-archetype": {
            "package.json": JSON.stringify({
              "scripts": {
                "echo": "echo ARCH " + (/^win/.test(process.platform) ? "%MY_VAR%" : "$MY_VAR") +
                  " >> stdout.log"
              }
            }, null, 2)
          }
        }
      });

      run({
        argv: ["node", "builder", "envs", "echo", JSON.stringify([
          { MY_VAR: "hi" },
          { MY_VAR: "ho" },
          { MY_VAR: "yo" }
        ])]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.envs).to.be.calledOnce;

        readFile("stdout.log", function (data) {
          expect(data)
            .to.contain("ROOT hi").and
            .to.contain("ROOT ho").and
            .to.contain("ROOT yo");
        }, done);
      });

    });

    it("errors on empty JSON array", function (done) {
      base.sandbox.spy(Task.prototype, "envs");
      base.mockFs({
        "package.json": JSON.stringify({
          "scripts": {
            "echo": "echo ROOT " + (/^win/.test(process.platform) ? "%MY_VAR%" : "$MY_VAR")
          }
        }, null, 2)
      });

      run({
        argv: ["node", "builder", "envs", "echo", JSON.stringify([])]
      }, function (err) {
        expect(Task.prototype.envs).to.be.calledOnce;
        expect(err).to.have.property("message")
          .that.contains("Empty/null JSON environments array");

        done();
      });

    });

    it("errors on empty JSON non-array", function (done) {
      base.sandbox.spy(Task.prototype, "envs");
      base.mockFs({
        "package.json": JSON.stringify({
          "scripts": {
            "echo": "echo ROOT " + (/^win/.test(process.platform) ? "%MY_VAR%" : "$MY_VAR")
          }
        }, null, 2)
      });

      run({
        argv: ["node", "builder", "envs", "echo", JSON.stringify({ not: "array" })]
      }, function (err) {
        expect(Task.prototype.envs).to.be.calledOnce;
        expect(err).to.have.property("message")
          .that.contains("Non-array JSON environments object");

        done();
      });

    });

    it("errors on malformed JSON array", function (done) {
      base.sandbox.spy(Task.prototype, "envs");
      base.mockFs({
        "package.json": JSON.stringify({
          "scripts": {
            "echo": "echo ROOT " + (/^win/.test(process.platform) ? "%MY_VAR%" : "$MY_VAR")
          }
        }, null, 2)
      });

      run({
        argv: ["node", "builder", "envs", "echo", "BAD_JSON"]
      }, function (err) {
        expect(Task.prototype.envs).to.be.calledOnce;
        expect(err).to.have.property("message")
          .that.contains("Unexpected token");

        expect(logStubs.error)
          .to.be.calledWithMatch("Failed to load JSON object");

        done();
      });
    });

    it("errors on nonexistent JSON file", function (done) {
      base.sandbox.spy(Task.prototype, "envs");
      base.mockFs({
        "package.json": JSON.stringify({
          "scripts": {
            "echo": "echo ROOT " + (/^win/.test(process.platform) ? "%MY_VAR%" : "$MY_VAR")
          }
        }, null, 2)
      });

      run({
        argv: ["node", "builder", "envs", "echo", "--envs-path=BAD_JSON"]
      }, function (err) {
        expect(Task.prototype.envs).to.be.calledOnce;
        expect(err).to.have.property("message")
          .that.contains("ENOENT");

        expect(logStubs.error)
          .to.be.calledWithMatch("Failed to load JSON file");

        done();
      });
    });

    // TODO: Finish outlined tests.
    // https://github.com/FormidableLabs/builder/issues/9
    it("runs with --setup");
    it("runs with --tries=2");
    it("runs with --queue=1, --bail=false");

    it("runs with envs overriding base config value", function (done) {
      base.sandbox.spy(Task.prototype, "envs");
      base.mockFs({
        "package.json": JSON.stringify({
          "config": {
            "_test_message": "from base"
          },
          "scripts": {
            "echo": "node test/server/fixtures/echo.js >> stdout.log"
          }
        }, null, 2)
      });

      run({
        argv: ["node", "builder", "envs", "echo", JSON.stringify([
          {},
          { "npm_package_config__test_message": "from array1" },
          { "npm_package_config__test_message": "from array2" }
        ])]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.envs).to.have.callCount(1);

        readFile("stdout.log", function (data) {
          expect(data)
            .to.contain("string - from base").and
            .to.contain("string - from array1").and
            .to.contain("string - from array2");
        }, done);
      });
    });

    it("runs with envs real ENV overriding base + arch config value", function (done) {
      base.sandbox.spy(Task.prototype, "envs");
      base.mockFs({
        ".builderrc": "---\narchetypes:\n  - mock-archetype",
        "package.json": JSON.stringify({
          "config": {
            "_test_message": "from base"
          }
        }, null, 2),
        "node_modules": {
          "mock-archetype": {
            "package.json": JSON.stringify({
              "config": {
                "_test_message": "from archetype"
              },
              "scripts": {
                "echo": "node test/server/fixtures/echo.js >> stdout.log"
              }
            }, null, 2)
          }
        }
      });

      /*eslint-disable camelcase*/
      process.env.npm_package_config__test_message = "from real env";
      /*eslint-enable camelcase*/

      run({
        argv: ["node", "builder", "envs", "echo", JSON.stringify([
          {}, // Now, real env should override this one.
          { "npm_package_config__test_message": "from array1" },
          { "npm_package_config__test_message": "from array2" }
        ])]
      }, function (err) {
        if (err) { return done(err); }

        expect(Task.prototype.envs).to.have.callCount(1);

        readFile("stdout.log", function (data) {
          expect(data)
            .to.contain("string - from real env").and
            .to.contain("string - from array1").and
            .to.contain("string - from array2");
        }, done);
      });
    });

  });

});
