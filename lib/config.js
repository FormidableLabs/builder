"use strict";

/**
 * Configuration.
 *
 * **Note**: Currently very naive. Reads a `.builderrc` file if present and
 * nothing else.
 */
var fs = require("fs");
var path = require("path");
var _ = require("lodash");
var yaml = require("js-yaml");
var chalk = require("chalk");
var log = require("./log");

/**
 * Configuration wrapper.
 *
 * @param {Object} cfg  Configuration object or JSON/YAML file (Default: `.builderrc`)
 * @returns {void}
 */
var Config = module.exports = function (cfg) {
  log.info("config:environment", JSON.stringify({
    cwd: process.cwd(),
    dir: __dirname
  }));

  this.cfg = this._loadConfig(cfg);
  this.archetypes = this.cfg.archetypes || [];

  // Include the `-dev` packages.
  this.allArchetypes = this.archetypes.reduce(function (memo, name) {
    return memo.concat([name, name + "-dev"]);
  }, []);

  // State: Information about the installation environment.
  // (State is set on `_loadScripts`)
  this._isFromNpm = false;

  // Array of [name, scripts array] pairs.
  this.scripts = this._loadScripts(this.archetypes);
};

/**
 * Load configuration.
 *
 * @param   {Object} cfg  Configuration object or JSON/YAML file (Default: `.builderrc`)
 * @returns {Object}      Configuration object
 */
Config.prototype._loadConfig = function (cfg) {
  cfg = cfg || ".builderrc";

  if (typeof cfg === "string") {
    try {
      cfg = yaml.safeLoad(fs.readFileSync(cfg, "utf8"));
    } catch (err) {
      if (err.code === "ENOENT") {
        log.warn("config", "Unable to load config file: " + cfg);
      } else {
        log.error("config", err.toString());
        throw err;
      }
    }

    cfg = cfg || {};
  }

  return cfg;
};

/**
 * Load a single archetype's package.json.
 *
 * @param   {String} name   Archetype name
 * @returns {Object}        Package.json object
 */
Config.prototype._loadArchetypePackage = function (name) {
  /*eslint-disable global-require*/
  var pkgPath;

  // Scripts can be contained (npm v2) or siblings (npm v3).
  //
  // If a package is installed from NPM **and** we're using NPM v3, then the
  // archetype is a **sibling** not contained in `ROOT/node_modules`.
  //
  // Accordingly, we use information from loading `ROOT/package.json` to
  // heursitically (hackily) determine if these conditions are true.
  //
  // https://github.com/FormidableLabs/builder/issues/25
  try {
    // Contained in the "usual place"
    pkgPath = path.join(process.cwd(), "node_modules", name, "package.json");
    return require(pkgPath);
  } catch (err) {
    /*eslint-disable no-empty*/
  }

  if (this._isFromNpm) {
    try {
      // NPM-installed (sometimes on v2, always on v3)
      pkgPath = path.join(process.cwd(), "..", name, "package.json");
      return require(pkgPath);
    } catch (err) {
      /*eslint-disable no-empty*/
    }
  }

  try {
    // Require resolve it
    var modPath = require.resolve(name);
    pkgPath = path.join(modPath, "package.json");
    return require(pkgPath);
  } catch (err) {
    /*eslint-disable no-empty*/
  }

  return undefined;
};

/**
 * Archetype scripts.
 *
 * @param   {String} name   Archetype name
 * @returns {Object}        Package.json scripts object
 */
Config.prototype._loadArchetypeScripts = function (name) {
  var pkg = this._loadArchetypePackage(name);
  if (!pkg) {
    throw new Error("Unable to find package.json for: " + name);
  }

  var scripts = (pkg || {}).scripts || {};
  return _(scripts)
    .pairs()
    // Remove `builder:` internal tasks.
    .reject(function (pair) { return pair[0].indexOf("builder:") === 0; })
    .object()
    .value();
};

/**
 * Load archetype scripts.
 *
 * **Note**: We load scripts into an _array_ because order of operation matters
 * and is as follows:
 * - CWD
 * - Archetypes in _reverse_ order in `.builderrc`
 *
 * @param   {Array} archetypes  Archetype names
 * @returns {Array}             Array of script objects
 */
Config.prototype._loadScripts = function (archetypes) {
  var CWD_PKG = require(path.join(process.cwd(), "package.json")) || {};
  var CWD_SCRIPTS = CWD_PKG.scripts || {};

  // HACK: Detect if potential sibling with heuristic if "from npm";
  this._isFromNpm = !!CWD_PKG._resolved;

  return [["ROOT", CWD_SCRIPTS]].concat(_(archetypes)
    .map(function (name) {
      /*eslint-disable no-invalid-this*/
      return [name, this._loadArchetypeScripts(name)];
    }, this)
    .reverse()
    .value());
};

/**
 * Return display-friendly list of script commands.
 *
 * @param   {Array} archetypes  Archetype names to filter to (Default: all)
 * @returns {String}            Display string.
 */
Config.prototype.displayScripts = function (archetypes) {
  // Get filtered list of scripts.
  var scripts = this.scripts;
  if ((archetypes || []).length) {
    scripts = _.filter(scripts, function (pair) {
      return _.contains(archetypes, pair[0]);
    });
  }

  // First, get all keys.
  var keys = _(scripts)
    .map(function (pair) {
      return _.keys(pair[1]);
    })
    .flatten()
    .sortBy(function (name) {
      // Hack in a low-occuring string to prioritize "special" `:` names
      return (name.indexOf(":") > -1 ? "0000" : "") + name;
    })
    .value();

  // Then, map in order to scripts.
  return _.map(keys, function (key) {
    var tasks = _(scripts)
      .filter(function (pair) { return pair[1][key]; })
      .map(function (pair) {
        return "\n    " + chalk.gray("[" + pair[0] + "]") + " " + pair[1][key];
      })
      .value()
      .join("");

    return "\n  " + chalk.cyan(key) + tasks;
  }, this).join("\n");
};

/**
 * Get list of tasks in preferred execution order.
 *
 * @param   {String} cmd  Script command
 * @returns {Array}       List of ordered matches
 */
Config.prototype.getCommands = function (cmd) {
  return _(this.scripts)
    .map(function (pair) { return pair[1]; })
    .pluck(cmd)
    .filter(_.identity)
    .value();
};

Object.defineProperties(Config.prototype, {
  "archetypePaths": {
    /**
     * Return `.bin` paths for archetypes in configured order.
     *
     * @returns {Array} Archetype bin paths
     */
    get: function () {
      return _.map(this.allArchetypes, function (name) {
        return path.join(process.cwd(), "node_modules", name, "node_modules/.bin");
      });
    }
  },

  "archetypeNodePaths": {
    /**
     * Return path in `node_modules` for archetypes in configured order.
     *
     * @returns {Array} Archetype `node_modules` paths
     */
    get: function () {
      return _.map(this.allArchetypes, function (name) {
        return path.join(process.cwd(), "node_modules", name, "node_modules");
      });
    }
  }
});

