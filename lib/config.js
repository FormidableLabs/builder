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
  this.cfg = this._loadConfig(cfg);
  this.archetypes = this.cfg.archetypes || [];
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
 * Archetype scripts.
 *
 * @param   {String} name   Archetype name
 * @returns {Object}        Package.json object
 */
Config.prototype._loadArchetypeScripts = function (name) {
  /*eslint-disable global-require*/
  var scripts = (require(path.join(
    process.cwd(), "node_modules", name, "package.json")) || {}).scripts || {};

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
  var CWD_SCRIPTS = (require(path.join(process.cwd(), "package.json")) || {}).scripts || {};

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
 * @returns {String} Display string.
 */
Config.prototype.displayScripts = function () {
  // First, get all keys.
  var keys = _(this.scripts)
    .map(function (pair) {
      return _.keys(pair[1]);
    })
    .flatten()
    .sortBy(function (name) {
      // Hack in a low-occuring string to priority "special" `:` names
      return (name.indexOf(":") > -1 ? "0000" : "") + name;
    })
    .value();

  // Then, map in order to scripts.
  return _.map(keys, function (key) {
    var scripts = _(this.scripts)
      .filter(function (pair) { return pair[1][key]; })
      .map(function (pair) {
        return "\n    " + chalk.gray("[" + pair[0] + "]") + " " + pair[1][key];
      })
      .value()
      .join("");

    return "\n  " + chalk.cyan(key) + scripts;
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
      return _.map(this.archetypes, function (name) {
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
      return _.map(this.archetypes, function (name) {
        return path.join(process.cwd(), "node_modules", name);
      });
    }
  }
});

