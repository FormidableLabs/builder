"use strict";
/*eslint max-statements:[2, 30]*/

var path = require("path");
var _ = require("lodash");
var async = require("async");
var chalk = require("chalk");
var args = require("./args");
var Environment = require("./environment");
var log = require("./log");
// TODOvar jsonParse = require("./utils/json").parse;
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
    _.extend(pre, { opts: this.getPrePostOpts(pre, taskArgs) });
  }
  _.extend(main, { opts: this.getMainOpts(main, taskArgs) });
  if (post) {
    _.extend(post, { opts: this.getPrePostOpts(post, taskArgs) });
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
 * @returns {Object}        Combined options
 */
Task.prototype.getPrePostOpts = function (task, opts) {
  if (!task) { return null; }

  return _.extend({}, this.getMainOpts(task, opts), {
    "tries": 1,
    "setup": false
  });
};

/**
 *
 * @param {String}    taskName  Setup task name
 * @param {Object}    shOpts    Shell options
 * @param {Function}  callback  Function `(err)` called on process end.
 * @returns {Object}            Process object or `null` if no setup.
 */
Task.prototype.setup = function (taskName, shOpts, callback) {
  // Lazy require because `task` is a dependency.
  var setup = require("./utils/setup"); // eslint-disable-line global-require

  // Add, invoke, and hook to final callback if setup dies early.
  var proc = this._tracker.add(setup.create(taskName, shOpts));
  if (proc) {
    // If setup exit happens before normal termination, kill everything.
    proc.on("exit", function (code) {
      callback(new Error("Setup exited with code: " + code));
    });
  }

  return proc;
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
  var run = runner.run;
  var tracker = this._tracker;
  var shOpts = { env: this._env.env };

  // Get execution parameters.
  var params = this.getRunParams(this._command, "run");
  log.info(this._action, this._command + chalk.gray(" - " + params.main.cmd));

  // Task execution sequence
  async.series([
    // 1. `pre<task>`
    params.pre && run.bind(null, params.pre.cmd, shOpts, params.pre.opts),

    function (cb) {
      var opts = params.main.opts;

      // 2. `--setup=<setup-task>` (spawned for lifetime of <task>)
      // Add and invoke setup.
      if (opts.setup) {
        self.setup(opts.setup, shOpts, callback);
      }

      // 3. `<task>`
      // If no retries, actually track and return child process object.
      if (opts.tries === 1) {
        return tracker.add(runner.run(params.main.cmd, shOpts, opts, cb));
      }

      // Otherwise retry without returning process object.
      runner.retry(params.main.cmd, shOpts, _.extend({ tracker: tracker }, opts), cb);
    },

    params.post && run.bind(null, params.post.cmd, shOpts, params.post.opts)
  ].filter(Boolean), callback);
};

/**
 * Concurrent.
 *
 * @param   {Function} callback   Callback function `(err)`
 * @returns {void}
 */
Task.prototype.concurrent = function (callback) {
  throw new Error("TODO IMPLEMENT" + callback);

  // var env = this._env.env; // Raw environment object.
  // var cmds = this._commands;
  // var tasks = cmds.map(this.getCommands.bind(this));
  // var mainCmds = tasks.map(function (task) { return task.main.cmd; });
  // var flags = args.concurrent(this.argv);

  // // TODO: HERE -- Need to figure out behavior.
  // // TODO: DECIDE -- probably run each pre + post for each (ugh).
  // // TODO: OR.... -- run them all concurrently!!!
  // // TODO: DOCUMENT
  // // TODO: BROKEN BROKEN BROKEN -- right now only first pre/post applies...

  // // Choose first task for options.
  // var task = tasks[0] || {};
  // //var preOpts = this.getPrePostOpts(task.pre, flags);
  // var mainOpts = this.getMainOpts(task.main, flags);
  // //var postOpts = this.getPrePostOpts(task.post, flags);

  // log.info(this._action, cmds.join(", ") + tasks.map(function (t, i) {
  //   return "\n * " + cmds[i] + chalk.gray(" - " + t.main.cmd);
  // }).join(""));

  // var concurrent = runner.concurrent;
  // async.series([
  //   null, // TODO: task.pre && run.bind(null, task.pre.cmd, { env: env }, preOpts),
  //   concurrent.bind(null, mainCmds, { env: env }, mainOpts),
  //   null // TODO: task.post && run.bind(null, task.post.cmd, { env: env }, postOpts)
  // ].filter(Boolean), callback);
};

/**
 * Run multiple environments.
 *
 * @param   {Function} callback   Callback function `(err)`
 * @returns {void}
 */
Task.prototype.envs = function (callback) {
  throw new Error("TODO IMPLEMENT" + callback);

  // /*eslint max-statements: [2, 20]*/
  // // Core setup.
  // var env = this._env.env;
  // var task = this.getCommands(this._command);
  // var flags = args.envs(this.argv);
  // var mainOpts = this.getMainOpts(task.main, flags);

  // // Parse envs.
  // var envsObj;
  // var err;
  // try {
  //   envsObj = jsonParse({
  //     str: this._commands[1], // Get task environment array.
  //     path: mainOpts.envsPath
  //   });
  // } catch (parseErr) {
  //   err = parseErr;
  // }

  // // Validation
  // if (!err && _.isEmpty(envsObj)) {
  //   err = new Error("Empty/null JSON environments array.");
  // } else if (!err && !_.isArray(envsObj)) {
  //   err = new Error("Non-array JSON environments object: " + JSON.stringify(envsObj));
  // }

  // if (err) {
  //   log.error(this._action + ":json-error",
  //     "Failed to load environments string / path with error: " + err);
  //   return callback(err);
  // }

  // // Stash for use in runner options.
  // mainOpts._envs = envsObj;

  // // Run.
  // runner.envs(task.main.cmd, { env: env }, mainOpts, callback);
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
