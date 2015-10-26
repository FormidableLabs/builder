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
 * Archetype package path.
 *
 * @param   {String} name   Archetype name
 * @returns {Object}        Package.json object
 */
Config.prototype._loadArchetypePackage = function (name) {
  /*eslint-disable global-require*/
  return require(path.join(process.cwd(), "node_modules", name, "package.json"));
};

/**
 * Load archetype scripts.
 *
 * @param   {Array} archetypes  Archetype names
 * @returns {Object}            Object of merged `scripts`
 */
Config.prototype._loadScripts = function (archetypes) {
  // Merge archetype scripts.
  return _.reduce(archetypes, function (memo, name) {
    /*eslint-disable no-invalid-this*/
    var archetype = this._loadArchetypePackage(name);
    return _.extend(memo, archetype.scripts);
  }, {}, this);
};

Object.defineProperties(Config.prototype, {
  "archetypePaths": {
    /**
     * Return `.bin` paths for archetypes.
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
     * Return path in `node_modules` for archetypes.
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

