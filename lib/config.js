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
 * @returns {Object}        Object of `{ mod: Package, path: FULL_PATH_TO_MOD }`
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
  var self = this;
  var CWD_PKG = this._lazyRequire(path.join(process.cwd(), "package.json")) || {};

  // Load base packages.
  var pkgs = [_.extend({ name: "ROOT" }, CWD_PKG)].concat(_.chain(archetypes)
    .map(function (name) {
      return _.extend({ name: name }, self._loadArchetypePkg(name));
    })
    .reverse()
    .value());

  // Add scripts, config.
  pkgs = _.mapValues(pkgs, function (pkg) {
    var mod = pkg.mod || {};

    return _.extend({
      config: mod.config,
      scripts: pkg.name === "ROOT" ? mod.scripts || {} : self._loadArchetypeScripts(pkg)
    }, pkg);
  });

  return pkgs;
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
  var scripts = (pkg.mod || {}).scripts || {};
  return _.chain(scripts)
    // Pairs.
    .map(function (v, k) { return [k, v]; })
    // Remove `builder:` internal tasks.
    .reject(function (pair) { return pair[0].indexOf("builder:") === 0; })
    // Object.
    .reduce(function (memo, pair) {
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
  var pkgs = this.pkgs;

  // Get filtered list of fields.
  if ((archetypes || []).length) {
    pkgs = _.filter(pkgs, function (pkg) {
      return _.includes(archetypes, pkg.name);
    });
  }

  // First, get all keys.
  var keys = _.chain(pkgs)
    .map(function (pkg) {
      return _.keys(pkg[field]);
    })
    .flatten()
    .sortBy(function (name) {
      // Hack in a low-occuring string to prioritize "special" `:` names
      return (name.indexOf(":") > -1 ? "0000" : "") + name;
    })
    // Filter to unique keys.
    .uniq()
    .value();

  // Then, map in order.
  return _.map(keys, function (key) {
    var tasks = _.chain(pkgs)
      .filter(function (pkg) { return pkg[field][key]; })
      .map(function (pkg) {
        return "\n    " + chalk.gray("[" + pkg.name + "]") + " " + pkg[field][key];
      })
      .value()
      .join("");

    return "\n  " + chalk.cyan(key) + tasks;
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
    .map(function (pkg) {
      return { archetypeName: pkg.name, archetypePath: pkg.path, cmd: pkg.scripts[cmd] };
    })
    .filter(function (obj) { return obj.cmd; })
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
      var pkgs = this.pkgs;
      var configNames = _.chain(pkgs)
        .map(function (pkg) { return _.keys(pkg.config); })
        .flatten()
        .uniq()
        .value();

      // Take "first" config value in arrays as "winning" value.
      return _.chain(configNames)
        .map(function (name) {
          return [name, _.find(pkgs, function (pkg) {
            return _.has(pkg.config, name);
          }).config[name]];
        })
        // Object.
        .reduce(function (memo, pair) {
          memo[pair[0]] = pair[1];
          return memo;
        }, {})
        .value();
    }
  }
});
