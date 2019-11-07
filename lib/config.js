"use strict";

/**
 * Configuration.
 *
 * **Note**: Currently very naive. Reads a `.builderrc` file if present and
 * nothing else.
 */
const fs = require("fs");
const path = require("path");
const _ = require("lodash");
const yaml = require("js-yaml");
const chalk = require("chalk");
const args = require("./args");
const log = require("./log");
const expandFlag = require("./utils/archetype").expandFlag;

/**
 * Configuration wrapper.
 *
 * @param {Object} opts         Options object
 * @param {Object} opts.env     Raw environment (Default `process.env`)
 * @param {Array}  opts.argv    Raw arguments array (Default: `process.argv`)
 * @returns {void}
 */
const Config = module.exports = function (opts) {
  log.debug("config:environment", JSON.stringify({
    cwd: process.cwd(),
    dir: __dirname
  }));

  // Internal global state.
  opts = opts || {};
  this._args = args.general(opts.argv || process.argv);
  this.expandArchetype = expandFlag(opts);

  this.cfg = this._loadConfig();
  this.archetypes = this.cfg.archetypes || [];

  // Array of `{ name, path }`
  this.devPkgs = this._loadDevPkgs(this.archetypes);
  // Array of `{ name, mod, path, scripts, config }`
  this.pkgs = this._loadPkgs(this.archetypes);
};

/**
 * Return imported module and full path to installed directory.
 *
 * Also to expose `require()` for testing.
 *
 * Tests often have needs to mock `fs` which Node 4+ `require`-ing won't work
 * with, defeat the internal `require` cache, etc.
 *
 * @param {String} mod  Module name or path.
 * @returns {Object}    `{ mod: MODULE, path: FULL_PATH_TO_MODULE }` object
 */
Config.prototype._lazyRequire = function (mod) {
  return {
    mod: require(mod), // eslint-disable-line global-require
    path: path.dirname(require.resolve(mod))
  };
};

/**
 * Load configuration.
 *
 * @returns {Object} Configuration object
 */
Config.prototype._loadConfig = function () {
  // Override from command line.
  const cfgObj = this._args.builderrc || ".builderrc";
  let cfg = {};

  // Load from builderrc.
  if (typeof cfgObj === "string") {
    try {
      cfg = yaml.safeLoad(fs.readFileSync(cfgObj, "utf8"));
    } catch (err) {
      log.info("config", `Unable to load config file: ${cfgObj}`);

      if (err.code !== "ENOENT") {
        log.error("config", err.toString());
        throw err;
      }
    }
  }

  return cfg;
};

/**
 * Archetype package.json.
 *
 * @param   {String} name   Archetype name
 * @returns {Object}        Object of `{ mod: Package, path: FULL_PATH_TO_MOD }`
 */
Config.prototype._loadArchetypePkg = function (name) {
  let pkg;

  // `npm link` makes the normal `require()` thing break. Give ourselves an
  // environment variable to make imports more permissive.
  if (process.env.LOCAL_DEV) {
    try {
      pkg = this._lazyRequire(path.join(process.cwd(), "node_modules", name, "package.json"));
    } catch (err) {
      /* eslint-disable no-empty*/
      // Pass through error
    }

    // Allow a lower directory peek if expanding archetype.
    if (this.expandArchetype) {
      try {
        pkg = pkg || this._lazyRequire(
          path.join(process.cwd(), "../../node_modules", name, "package.json"));
      } catch (err) {
        /* eslint-disable no-empty*/
        // Pass through error
      }
    }
  }

  try {
    pkg = pkg || this._lazyRequire(`${name}/package.json`);
  } catch (err) {
    log.info("config:load-archetype-scripts",
      `Error loading package.json for: ${chalk.gray(name)} ${
        err.message || err.toString()}`);
    throw err;
  }

  return pkg;
};

/**
 * Load packages.
 *
 * **Note**: We load packages into an _array_ because order of operation matters
 * and is as follows:
 * - CWD
 * - Archetypes in _reverse_ order in `.builderrc`
 *
 * @param   {Array} archetypes  Archetype names
 * @returns {Array}             Array of `{ name, mod, path, scripts, config }`
 */
Config.prototype._loadPkgs = function (archetypes) {
  const self = this;
  const CWD_PKG = this._lazyRequire(path.resolve("package.json")) || {};

  // Load base packages.
  const pkgs = [_.extend({ name: "ROOT" }, CWD_PKG)].concat(_.chain(archetypes)
    .map((name) => _.extend({ name }, self._loadArchetypePkg(name)))
    .reverse()
    .value());

  // Add scripts, config.
  return _.chain(pkgs)
    .mapValues((pkg) => {
      const mod = pkg.mod || {};

      return _.extend({
        config: mod.config,
        scripts: pkg.name === "ROOT" ? mod.scripts || {} : self._loadArchetypeScripts(pkg)
      }, pkg);
    })
    .toArray()
    .value();
};

/**
 * Load dev packages (if available).
 *
 * @param   {Array} archetypes  Archetype names
 * @returns {Array}             Array of `{ name, path }`
 */
Config.prototype._loadDevPkgs = function (archetypes) {
  const self = this;

  return _.chain(archetypes)
    .map((baseName) => {
      const name = `${baseName}-dev`;

      try {
        return _.extend({ name }, self._loadArchetypePkg(name));
      } catch (err) {
        // Pass through error
        return null;
      }
    })
    .filter(_.identity)
    .reverse()
    .value();
};


/**
 * Archetype package scripts.
 *
 * _Note_: We filter out any `builder:`-prefaced commands.
 *
 * @param   {Object} pkg    Archetype `{ name, mod, path }` object
 * @returns {Object}        Package.json scripts object
 */
Config.prototype._loadArchetypeScripts = function (pkg) {
  const scripts = (pkg.mod || {}).scripts || {};
  return _.chain(scripts)
    // Pairs.
    .map((v, k) => [k, v])
    // Remove `builder:` internal tasks.
    .reject((pair) => pair[0].indexOf("builder:") === 0)
    // Object.
    .reduce((memo, pair) => {
      memo[pair[0]] = pair[1];
      return memo;
    }, {})
    .value();
};

/**
 * Return display-friendly list of package.json fields commands.
 *
 * @param   {String}  field       Field name to extract
 * @param   {Array}   archetypes  Archetype names to filter to (Default: all)
 * @returns {String}              Display string.
 */
Config.prototype._displayFields = function (field, archetypes) {
  let pkgs = this.pkgs;

  // Get filtered list of fields.
  if ((archetypes || []).length) {
    pkgs = _.filter(pkgs, (pkg) => _.includes(archetypes, pkg.name));
  }

  // First, get all keys.
  const keys = _.chain(pkgs)
    .map((pkg) => _.keys(pkg[field]))
    .flatten()
    .sortBy((name) =>
      // Hack in a low-occuring string to prioritize "special" `:` names
      (name.indexOf(":") > -1 ? "0000" : "") + name
    )
    // Filter to unique keys.
    .uniq()
    .value();

  // Then, map in order.
  return _.map(keys, (key) => {
    const tasks = _.chain(pkgs)
      .filter((pkg) => _.get(pkg, [field, key]))
      .map((pkg) => `\n    ${chalk.gray(`[${pkg.name}]`)} ${_.get(pkg, [field, key])}`)
      .value()
      .join("");

    return `\n  ${chalk.cyan(key)}${tasks}`;
  }).join("\n");
};

/**
 * Return display-friendly list of script commands.
 *
 * @param   {Array} archetypes  Archetype names to filter to (Default: all)
 * @returns {String}            Display string.
 */
Config.prototype.displayScripts = function (archetypes) {
  return this._displayFields("scripts", archetypes);
};

/**
 * Return display-friendly list of configs.
 *
 * @param   {Array} archetypes  Archetype names to filter to (Default: all)
 * @returns {String}            Display string.
 */
Config.prototype.displayConfigs = function (archetypes) {
  return this._displayFields("config", archetypes);
};

/**
 * Get list of tasks in preferred execution order.
 *
 * @param   {String} cmd  Script command
 * @returns {Array}       List of ordered matches of `{ archetypeName, archetypePath, cmd }`
 */
Config.prototype.getCommands = function (cmd) {
  return _.chain(this.pkgs)
    .map((pkg) => ({ archetypeName: pkg.name,
      archetypePath: pkg.path,
      cmd: pkg.scripts[cmd] }))
    .filter((obj) => obj.cmd)
    .value();
};

Object.defineProperties(Config.prototype, {
  archetypePaths: {
    /**
     * Return `.bin` paths for archetypes in configured order.
     *
     * @returns {Array} Archetype bin paths
     */
    get() {
      return _.map(
        [].concat(this.pkgs, this.devPkgs),
        (pkg) => path.join(pkg.path, "node_modules/.bin")
      );
    }
  },

  archetypeNodePaths: {
    /**
     * Return path in `node_modules` for archetypes in configured order.
     *
     * @returns {Array} Archetype `node_modules` paths
     */
    get() {
      return _.map(
        [].concat(this.pkgs, this.devPkgs),
        (pkg) => path.join(pkg.path, "node_modules")
      );
    }
  },

  pkgConfigs: {
    /**
     * Return object of resolved package.json config fields.
     *
     * Resolves in order of "root wins", then in reverse archetype order.
     *
     * @returns {Object} environment object.
     */
    get() {
      const pkgs = this.pkgs;
      const configNames = _.chain(pkgs)
        .map((pkg) => _.keys(pkg.config))
        .flatten()
        .uniq()
        .value();

      // Take "first" config value in arrays as "winning" value.
      return _.chain(configNames)
        .map((name) => [name, _.find(pkgs, (pkg) => _.has(pkg.config, name)).config[name]])
        // Object.
        .reduce((memo, pair) => {
          memo[pair[0]] = pair[1];
          return memo;
        }, {})
        .value();
    }
  }
});
