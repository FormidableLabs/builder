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
var args = require("./args");
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

  // Array of [name, package.json object] pairs.
  var pkgs = this._loadPkgs(this.archetypes);

  // Array of [name, scripts|config array] pairs.
  this.scripts = this._loadScripts(pkgs);
  this.configs = this._loadConfigs(pkgs);
};

// Expose `require()` for testing.
//
// Tests often have needs to mock `fs` which Node 4+ `require`-ing won't work
// with, defeat the internal `require` cache, etc.
Config.prototype._lazyRequire = function (mod) {
  return require(mod); // eslint-disable-line global-require
};

/**
 * Load configuration.
 *
 * @param   {Object} cfg  Configuration object or JSON/YAML file (Default: `.builderrc`)
 * @returns {Object}      Configuration object
 */
Config.prototype._loadConfig = function (cfg) {
  cfg = cfg || ".builderrc";

  // Override from command line.
  var parsed = args.general();
  if (parsed.builderrc) {
    cfg = parsed.builderrc;
  }

  // Load from builderrc.
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
 * Archetype package.json.
 *
 * @param   {String} name   Archetype name
 * @returns {Object}        Package.json object
 */
Config.prototype._loadArchetypePkg = function (name) {
  var pkg;

  // `npm link` makes the normal `require()` thing break. Give ourselves an
  // environment variable to make imports more permissive.
  if (process.env.LOCAL_DEV) {
    try {
      pkg = this._lazyRequire(path.join(process.cwd(), "node_modules", name, "package.json"));
    } catch (err) {
      /*eslint-disable no-empty*/
      // Pass through error
    }
  }

  try {
    pkg = pkg || this._lazyRequire(name + "/package.json");
  } catch (err) {
    log.error("config:load-archetype-scripts",
      "Error loading package.json for: " + chalk.gray(name) + " " +
      (err.message || err.toString()));
    throw err;
  }

  return pkg || {};
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
 * @returns {Array}             Array of [name, package.json object] pairs
 */
Config.prototype._loadPkgs = function (archetypes) {
  var CWD_PKG = this._lazyRequire(path.join(process.cwd(), "package.json")) || {};

  return [["ROOT", CWD_PKG]].concat(_(archetypes)
    .map(function (name) {
      /*eslint-disable no-invalid-this*/
      return [name, this._loadArchetypePkg(name)];
    }, this)
    .reverse()
    .value());
};

/**
 * Archetype package scripts.
 *
 * _Note_: We filter out any `builder:`-prefaced commands.
 *
 * @param   {Object} pkg    Archetype package.json object
 * @returns {Object}        Package.json scripts object
 */
Config.prototype._loadArchetypeScripts = function (pkg) {
  var scripts = pkg.scripts || {};
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
 * @param   {Array} pkgs  Array of [name, package.json object] pairs.
 * @returns {Array}       Array of script objects
 */
Config.prototype._loadScripts = function (pkgs) {
  return _.map(pkgs, function (pair) {
    /*eslint-disable no-invalid-this*/
    var name = pair[0];
    var pkg = pair[1];
    var scripts = name === "ROOT" ? pkg.scripts || {} : this._loadArchetypeScripts(pkg);

    return [name, scripts];
  }, this);
};

/**
 * Return display-friendly list of package.json fields commands.
 *
 * @param   {Array} objs        Array of package.json data.
 * @param   {Array} archetypes  Archetype names to filter to (Default: all)
 * @returns {String}            Display string.
 */
Config.prototype._displayFields = function (objs, archetypes) {
  // Get filtered list of fields.
  if ((archetypes || []).length) {
    objs = _.filter(objs, function (pair) {
      return _.contains(archetypes, pair[0]);
    });
  }

  // First, get all keys.
  var keys = _(objs)
    .map(function (pair) {
      return _.keys(pair[1]);
    })
    .flatten()
    .sortBy(function (name) {
      // Hack in a low-occuring string to prioritize "special" `:` names
      return (name.indexOf(":") > -1 ? "0000" : "") + name;
    })
    // Filter to unique keys and we're in order (`true`)
    .unique(true)
    .value();

  // Then, map in order.
  return _.map(keys, function (key) {
    var tasks = _(objs)
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
 * Return display-friendly list of script commands.
 *
 * @param   {Array} archetypes  Archetype names to filter to (Default: all)
 * @returns {String}            Display string.
 */
Config.prototype.displayScripts = function (archetypes) {
  return this._displayFields(this.scripts, archetypes);
};

/**
 * Load archetype configs.
 *
 * @param   {Array} pkgs  Array of [name, package.json object] pairs.
 * @returns {Array}       Array of config objects
 */
Config.prototype._loadConfigs = function (pkgs) {
  return _.map(pkgs, function (pair) {
    return [pair[0], pair[1].config || {}];
  });
};

/**
 * Return display-friendly list of configs.
 *
 * @param   {Array} archetypes  Archetype names to filter to (Default: all)
 * @returns {String}            Display string.
 */
Config.prototype.displayConfigs = function (archetypes) {
  return this._displayFields(this.configs, archetypes);
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
  },

  "pkgConfigs": {
    /**
     * Return object of resolved package.json config fields.
     *
     * Resolves in order of "root wins", then in reverse archetype order.
     *
     * @returns {Object} environment object.
     */
    get: function () {
      var configs = this.configs;
      var configNames = _(configs)
        .map(function (pair) { return _.keys(pair[1]); })
        .flatten()
        .uniq()
        .value();

      // Take "first" config value in arrays as "winning" value.
      return _(configNames)
        .map(function (name) {
          return [name, _.find(configs, function (pair) {
            return _.has(pair[1], name);
          })[1][name]];
        })
        .object()
        .value();
    }
  }
});
