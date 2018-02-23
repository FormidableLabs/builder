"use strict";
/*eslint max-statements:[2, 30]*/

var path = require("path");
var _ = require("lodash");
var async = require("async");
var chalk = require("chalk");
var args = require("./args");
var Environment = require("./environment");
var log = require("./log");
var clone = require("./utils/clone");
var jsonParse = require("./utils/json").parse;
var Tracker = require("./utils/tracker");
var runner = require("./utils/runner");

// Paths for inference of "is builder task?"
var BUILDER_NODE_MODULES = path.normalize("node_modules/builder/bin/builder.js");
var BUILDER_BIN = path.normalize("node_modules/.bin/builder");

/**
 * Task wrapper.
 *
 * @param {Object} opts         Options object
 * @param {Object} opts.config  Configuration object
 * @param {Object} opts.env     Environment object to mutate (Default `Environment`)
 * @param {Array}  opts.argv    Arguments array (Default: `process.argv`)
 * @param {Object} opts.runner  Runner object.
 * @returns {void}
 */
var Task = module.exports = function (opts) {
  opts = opts || {};

  // Options.
  this._config = opts.config;
  this._env = opts.env || new Environment();

  // Infer parts.
  this.argv = opts.argv || process.argv;
  var parsed = args.general(this.argv);
  var remain = parsed.argv.remain;
  this._script = this.argv[1];
  this._action = remain[0];
  this._command = remain[1];
  this._commands = remain.slice(1);

  // State
  this._tracker = new Tracker();
  this._setupKilled = false;
  this._errors = [];

  // Validation.
  if (!this._config) {
    throw new Error("Configuration object required");
  }

  // Special flags that short circuit.
  if (parsed.help === true) {
    this._action = "help";
  } else if (parsed.version === true) {
    this._action = "version";
  } else if (remain.length === 0) {
    this._action = "help";
  }

  // Infer action.
  if (!_.includes(this.ACTIONS.concat(["version"]), this._action)) {
    throw new Error("Invalid action: " + this._action +
      " - Valid actions: " + this.ACTIONS.join(", "));
  }
};

Task.prototype.ACTIONS = ["run", "concurrent", "envs", "help"];

Task.prototype.toString = function () {
  var cmd = this._command;
  if (this._action === "concurrent") {
    cmd = this._commands.join(", ");
  } else if (_.includes(["help", "version"], this._action)) {
    cmd = null;
  }

  return this._action + (cmd ? " " + cmd : "");
};

/**
 * Is this task another builder command?
 *
 * Checks either `builder` or `node PATH/TO/BUILDER`.
 *
 * _Note_: Naive. Only captures `builder` at start of command.
 * See: https://github.com/FormidableLabs/builder/issues/93
 *
 * @param   {String} task   Task
 * @returns {Boolean}       Is this task a passthrough?
 */
Task.prototype.isBuilderTask = function (task) {
  // mac: '/PATH/TO/node_modules/.bin/builder'
  // win: 'X:\\PATH\\TO\\node_modules\\builder\\bin\\builder.js',
  var builder = path.basename(this._script, ".js");
  var taskParts = (task || "").trim().split(/\s+/);
  var taskBin = taskParts[0] || "";

  // Case: `builder run foo`
  // Compare directly if not a `node` script execution.
  if (taskBin.toLowerCase() !== "node") {
    return taskBin === builder;
  }

  // We know we're now in `node PATH/TO/BUILDER`.
  taskBin = path.resolve(taskParts[1] || "");

  // Case: `node CURRENT_BUILDER_PATH`
  return taskBin === path.resolve(this._script) ||

    // Case: `node node_modules/builder/bin/builder.js`
    taskBin.substr(taskBin.length - BUILDER_NODE_MODULES.length) === BUILDER_NODE_MODULES ||

    // Case: `node node_modules/.bin/builder`
    taskBin.substr(taskBin.length - BUILDER_BIN.length) === BUILDER_BIN;
};

/**
 * Is this task a simple passthrough to another builder command?
 *
 * @param   {String} task   Task
 * @returns {Boolean}       Is this task a passthrough?
 */
Task.prototype.isPassthrough = function (task) {
  var taskParts = task.split(/\s+/);
  var taskAction = taskParts[1];
  var taskCommand = taskParts[2];

  return this.isBuilderTask(task) &&
    this._action === taskAction &&
    this._command === taskCommand;
};

Task.prototype._findCommand = function (cmd) {
  var self = this;

  // Select first non-passthrough command.
  return _.find(this._config.getCommands(cmd), function (obj) {
    return !self.isPassthrough(obj.cmd);
  });
};

/**
 * Get execution parameters, options, etc.
 *
 * @param   {String} cmd    Script command
 * @param   {String} action Action name (default `general`)
 * @returns {Object}        Commands obj `{ main: { archetype, cmd, opts }, pre, post }`
 */
Task.prototype.getRunParams = function (cmd, action) {
  // For external use:
  cmd = cmd || this._command;
  action = action || "general";

  // Require a `main` task.
  var main = this._findCommand(cmd);
  if (!main) {
    if (_.isUndefined(cmd)) {
      throw new Error("No task specified");
    }

    throw new Error("Unable to find task for: " + cmd);
  }

  // Gather pre|post tasks, if they aren't already pre|post-prefixed.
  // **Note**: This follows `npm` behavior. `yarn` would run `prepre<task>`
  // when executing `yarn run pre<task>`.
  var pre = null;
  var post = null;
  if (!/^(pre|post)/.test(cmd)) {
    pre = this._findCommand("pre" + cmd) || null;
    post = this._findCommand("post" + cmd) || null;
  }

  // Infer execution options and enhance objects.
  var taskArgs = args[action](this.argv);
  if (pre) {
    _.extend(pre, { opts: this.getPrePostOpts(pre, taskArgs, action) });
  }
  _.extend(main, { opts: this.getMainOpts(main, taskArgs) });
  if (post) {
    _.extend(post, { opts: this.getPrePostOpts(post, taskArgs, action) });
  }

  return {
    pre: pre,
    main: main,
    post: post
  };
};

/**
 * Merge base options with custom options.
 *
 * @param   {Object} task   Task object `{ archetype, cmd }`
 * @param   {Object} opts   Custom options
 * @returns {Object}        Combined options
 */
Task.prototype.getMainOpts = function (task, opts) {
  return _.extend({
    _isBuilderTask: this.isBuilderTask(task.cmd),
    _archetypeName: task.archetypeName,
    _archetypePath: task.archetypePath
  }, opts);
};

/**
 * Merge base options with custom options and filter out non-pre|post things.
 *
 * @param   {Object} task   Task object `{ archetype, cmd }`
 * @param   {Object} opts   Custom options
 * @param   {String} action Action type to take.
 * @returns {Object}        Combined options
 */
Task.prototype.getPrePostOpts = function (task, opts, action) {
  if (!task) { return null; }

  // Action specific overrides.
  var overrides = {
    "envs": {
      buffer: false
    }
  };

  // Generally applicable options.
  return _.extend({}, this.getMainOpts(task, opts), {
    tries: 1,
    setup: false,
    _customFlags: null
  }, overrides[action]);
};

// Expose require because with mock-fs and node 0.10, 0.12, the `require` itself
// is mocked.
Task.prototype._lazyRequire = require; // eslint-disable-line global-require

/**
 *
 * @param {String}    taskName  Setup task name
 * @param {Object}    shOpts    Shell options
 * @param {Function}  callback  Function `(err)` called on process end.
 * @returns {Object}            Process object or `null` if no setup.
 */
Task.prototype.setup = function (taskName, shOpts, callback) {
  // Lazy require because `task` is a dependency.
  var setup = this._lazyRequire("./utils/setup");

  // Short-circuit empty task.
  if (!taskName) { return null; }

  // Add, invoke, and hook to final callback if setup dies early.
  var self = this;
  var proc = this._tracker.add(setup.create(taskName, shOpts));
  if (proc) {
    // If setup exit happens before normal termination, kill everything.
    proc.on("exit", function (code) {
      self._setupKilled = true;
      callback(new Error("Setup exited with code: " + code));
    });
  }

  return proc;
};

Task.prototype.trackAndRun = function () {
  return this._tracker.add(runner.run.apply(null, arguments));
};


// Wrap all callbacks to noop if the tracker or setup are already killed.
Task.prototype._skipIfKilled = function (fn) {
  var self = this;
  return function (cb) {
    return self._tracker.killed || self._setupKilled ? cb() : fn(cb);
  };
};

// Convenience wrapper for processing errors with `opts.bail`.
Task.prototype._errOrBail = function (opts, callback) {
  var self = this;
  return function (err) {
    if (err) {
      self._errors.push(err);
    }
    callback(opts.bail ? err : null); // Decide if failure ends the run.
  };
};

/**
 * Help.
 *
 * ```sh
 * $ builder help <action>
 * $ builder help <archetype1> <archetype2>
 * $ builder --help
 * $ builder -h
 * ```
 *
 * @param   {Function} callback   Callback function `(err)`
 * @returns {void}
 */
Task.prototype.help = function (callback) {
  // Arguments after `help` are action OR archetypes.
  var cmd = this._command;
  var flagsDisplay = chalk.green.bold("Flags");

  // One matching command is an action: `builder help run`
  var action = _.includes(this.ACTIONS, cmd) ? cmd : null;
  var actionDisplay = action ? chalk.red(action) : "<action>";
  var actions = this.ACTIONS.map(function (val) {
    return val === action ? chalk.red(action) : val;
  }).join(", ");
  var actionFlags = action ?
    "\n\n" + flagsDisplay + ": " + actionDisplay + "\n\n  " + args.help(cmd) :
    "";

  // No matched action means all string are archetypes: `builder help <arch1> <arch2>`
  var archetypes = action ? null : this._commands;

  // Display task configs if we have _some_.
  var taskConfigs = this._config.displayConfigs(archetypes);

  // Use raw stdout instead of logger so we can disable logger on "help".
  process.stdout.write(
    chalk.green.bold("Usage") + ": \n\n  builder " + actionDisplay + " <task(s)>" +
    "\n\n" + chalk.green.bold("Actions") + ": \n\n  " + actions +
    "\n\n" + flagsDisplay + ": General\n\n  " + args.help() +
    actionFlags +
    (taskConfigs ? "\n\n" + chalk.green.bold("Task Configs") + ": \n" + taskConfigs : "") +
    "\n\n" + chalk.green.bold("Tasks") + ": \n" + this._config.displayScripts(archetypes) + "\n");

  callback();
};

/**
 * Version.
 *
 * ```sh
 * $ builder --version
 * $ builder -v
 * ```
 *
 * @param   {Function} callback   Callback function `(err)`
 * @returns {void}
 */
Task.prototype.version = function (callback) {
  process.stdout.write(args.version() + "\n");
  callback();
};

/**
 * Run.
 *
 * @param   {Function} callback   Callback function `(err)`
 * @returns {void}
 */
Task.prototype.run = function (callback) {
  // `builder run` -> `builder help`
  if (!this._command) {
    return this.help(callback);
  }

  // Ensure only one call, so `--setup` process can call early for error.
  callback = _.once(callback);

  // Aliases
  var self = this;
  var shOpts = { env: this._env.env };

  // Get execution parameters.
  var params = this.getRunParams(this._command, "run");
  log.info(this._action, this._command + chalk.gray(" - " + params.main.cmd));

  // Task execution sequence
  async.series([
    // Execute `pre<task>`
    params.pre && self.trackAndRun.bind(self, params.pre.cmd, shOpts, params.pre.opts),

    // Execute `--setup=<setup-task>` (spawned for lifetime of <task>)
    function (cb) {
      self.setup(params.main.opts.setup, shOpts, callback);
      cb();
    },

    // Execute `<task>`
    function (cb) {
      var opts = _.extend({ tracker: self._tracker }, params.main.opts);

      return opts.tries === 1 ?
        self.trackAndRun(params.main.cmd, shOpts, opts, cb) :
        runner.retry(params.main.cmd, shOpts, opts, cb);
    },

    // Execute `post<task>`
    params.post && self.trackAndRun.bind(self, params.post.cmd, shOpts, params.post.opts)
  ].filter(Boolean).map(self._skipIfKilled.bind(self)), callback);
};

/**
 * Concurrent.
 *
 * @param   {Function} callback   Callback function `(err)`
 * @returns {void}
 */
Task.prototype.concurrent = function (callback) {
  // Ensure only one call, so `--setup` process can call early for error.
  callback = _.once(callback);

  // Aliases
  var self = this;
  var shOpts = { env: this._env.env };

  // Get execution parameters (list).
  var cmds = this._commands;
  var paramsList = cmds.map(function (cmd) {
    return self.getRunParams(cmd, "concurrent");
  });
  var firstParams = paramsList[0];
  if (!firstParams) {
    log.warn(this._action, "No tasks found");
    return callback();
  }
  log.info(this._action, cmds.join(", ") + paramsList.map(function (t, i) {
    return "\n * " + cmds[i] + chalk.gray(" - " + t.main.cmd);
  }).join(""));

  // Use first task options to slice off general concurrent information.
  var queue = firstParams.main.opts.queue;

  // Start setup on first of **any** main tasks.
  var startSetup = _.once(function (opts) {
    return opts.setup ? self.setup(opts.setup, shOpts, callback) : null;
  });

  log.debug("concurrent", "Starting with queue size: " + chalk.magenta(queue || "unlimited"));
  async.mapLimit(paramsList, queue || Infinity, function (params, concCb) {
    // Task execution sequence
    async.series([
      // Execute `pre<task>`
      params.pre && self.trackAndRun.bind(self, params.pre.cmd, shOpts, params.pre.opts),

      // (ONLY FIRST ONE) Execute `--setup=<setup-task>` (spawned for lifetime of <task>)
      function (cb) {
        startSetup(params.main.opts, shOpts, callback);
        cb();
      },

      // Execute `<task1>`, `<task2>`, `...`
      function (cb) {
        var opts = _.extend({ tracker: self._tracker }, params.main.opts);

        return opts.tries === 1 ?
          self.trackAndRun(params.main.cmd, shOpts, opts, cb) :
          runner.retry(params.main.cmd, shOpts, opts, cb);
      },

      // Execute `post<task>`
      params.post && self.trackAndRun.bind(self, params.post.cmd, shOpts, params.post.opts)

      // Apply --bail to **all** of this sequence by wrapping .series final callback.
    ].filter(Boolean).map(self._skipIfKilled.bind(self)),
    self._errOrBail(params.main.opts, concCb));
  }, callback);
};

// Return validated environment object from CLI or file.
Task.prototype._getEnvsList = function (parseObj) {
  // Parse envs.
  var envsList;
  var err;
  try {
    envsList = jsonParse(parseObj);
  } catch (parseErr) {
    err = parseErr;
  }

  // Validation
  if (!err && _.isEmpty(envsList)) {
    err = new Error("Empty/null JSON environments array.");
  } else if (!err && !_.isArray(envsList)) {
    err = new Error("Non-array JSON environments object: " + JSON.stringify(envsList));
  }

  if (err) {
    log.error(this._action + ":json-error",
      "Failed to load environments string / path with error: " + err);
    throw err;
  }

  return envsList;
};

/**
 * Run multiple environments.
 *
 * @param   {Function} callback   Callback function `(err)`
 * @returns {void}
 */
Task.prototype.envs = function (callback) {
  // Ensure only one call, so `--setup` process can call early for error.
  callback = _.once(callback);

  // Aliases
  var self = this;
  var shOpts = { env: this._env.env };

  // Get execution parameters.
  var params = this.getRunParams(this._command, "envs");
  log.info(this._action, this._command + chalk.gray(" - " + params.main.cmd));

  // Get list of environment variable objects.
  var envsList;
  try {
    envsList = this._getEnvsList({
      str: this._commands[1],         // from CLI arguments
      path: params.main.opts.envsPath // from `--envs-path`
    });
  } catch (err) {
    return void callback(err);
  }

  // Task execution sequence
  async.series([
    // Execute `pre<task>`
    params.pre && self.trackAndRun.bind(self, params.pre.cmd, shOpts, params.pre.opts),

    // Execute `--setup=<setup-task>` (spawned for lifetime of <task>)
    function (cb) {
      self.setup(params.main.opts.setup, shOpts, callback);
      cb();
    },

    // Execute `<task>` w/ each env var.
    function (cb) {
      var cmd = params.main.cmd;
      var cmdStr = runner.cmdStr;
      var opts = _.extend({ tracker: self._tracker }, params.main.opts);
      var taskEnvs = clone(envsList);
      var queue = opts.queue;

      log.debug("envs", "Starting with queue size: " + chalk.magenta(queue || "unlimited"));
      async.mapLimit(taskEnvs, queue || Infinity, function (taskEnv, envCb) {
        // Add each specific set of environment variables.
        // Clone `shOpts` to turn `env` into a plain object: in Node 4+
        // `process.env` is a special object which changes merge behavior.
        var taskShOpts = _.merge(clone(shOpts), { env: taskEnv });
        var taskOpts = _.extend({ taskEnv: taskEnv }, opts);

        log.info("envs", "Starting " + cmdStr(cmd, taskOpts));
        runner.retry(cmd, taskShOpts, taskOpts, self._errOrBail(taskOpts, envCb));
      }, cb);
    },

    // Execute `post<task>`
    params.post && self.trackAndRun.bind(self, params.post.cmd, shOpts, params.post.opts)
  ].filter(Boolean).map(self._skipIfKilled.bind(self)), callback);
};

/**
 * Clean up task state.
 *
 * - Terminate all existing processes.
 * - Drain and log all accumulated errors.
 *
 * @param {Function}  callback  Callback `(err)`
 * @returns {Function}          Wrapped callback
 */
Task.prototype.finish = function (callback) {
  var errors = this._errors;

  this._tracker.kill(function () {
    if (errors.length > 1) {
      log.error("finish", "Hit " + chalk.red(errors.length) + " errors: \n" +
        errors.map(function (errItem) {
          return "  * " + chalk.gray(errItem.name) + ": " + chalk.red(errItem.message);
        }).join("\n"));
    }

    callback(errors[0]);
  });
};

/**
 * Execute action and cleanup.
 *
 * **Note**: All tasks (e.g., `run`, `concurrent`) through this gate.
 *
 * @param   {Function} callback   Callback function `(err)`
 * @returns {Object}              Process object for `run` or `null` otherwise / for errors
 */
Task.prototype.execute = function (callback) {
  var self = this;
  var action = this._action;

  // Check task action method exists.
  if (!this[action]) {
    return void callback(new Error("Unrecognized action: " + action));
  }

  // Call action.
  this[action](function (err) {
    // Add errors, if any.
    if (err) {
      self._errors.push(err);
    }

    // Unconditionally cleanup.
    self.finish(callback);
  });
};
