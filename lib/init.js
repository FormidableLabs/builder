"use strict";

var fs = require("fs");
var path = require("path");
var _ = require("lodash");
var prompt = require("prompt");
var async = require("async");
var runner = require("./runner");
var log = require("./log");

/* explicitly set so ${} isn't unintentionally interpolated in files, such as docs */
_.templateSettings.interpolate = /<%=([\s\S]+?)%>/g;

var archetype = {};

/**
 * Installation of builder archetype and archetype-dev dependencies
 *
 * @returns {void}
 */
var installDeps = function (callback) {
  log.info("init", "Installing dependency for " + archetype.name);

  //var initInstallCmd = "npm install " + archetype.name + " --save" +
    //" && npm install " + archetype.name + "-dev --save-dev";
  var initInstallCmd = "echo 'hello'";

  runner.run(initInstallCmd, {}, function () {
    try {
      archetype.meta = require(path.join(process.cwd(), "node_modules", archetype.name, "meta.js"));
    } catch (e) {
      log.error(e);
      log.error("init", e);
    }

    try {
      fs.readdirSync(archetype.templatePath);
      callback();
    } catch (e) {
      log.warn("init", e);
    }
  }.bind(this));
};

/**
 * Prompt for builder variables used in lodash compilation
 *
 * @returns {void}
 */
var builderPrompt = function (callback) {

  prompt.message = "";
  prompt.delimiter = "";

  prompt.get(archetype.meta.prompts, function (err, manifest) {

    archetype.manifest = _.merge({}, archetype.meta.defaults, manifest);

    /* set aliases to manifest values */
    var aliases = archetype.meta.aliases;
    for (var k in aliases) {

      if (Array.isArray(aliases[k])) {
        aliases[k].forEach(function (alias){
          archetype.manifest[alias] = manifest[k];
        });
      } else {
        archetype.manifest[aliases[k]] = manifest[k];
      }
    }

    callback();
  });
};

var pathWalker = function (callback) {
  walker(archetype.templatePath, function (filePath) {
    generateFile(filePath);
  });
};

var generateFile = function (filePath) {
  fs.readFile(filePath, function (err, contents) {
    if (err) {
      log.error(err);
    }

    var compiled = _.template(contents.toString());
    contents = compiled(archetype.manifest);

    var matched = filePath.match(/template_(.*)\./);

    if (matched) {
      filePath = filePath.replace(matched[0], archetype.manifest[matched[1]] + ".");
    }

    writeFile(filePath, contents);
  }.bind(this));
};

var writeFile = function (filePath, contents) {
  var fileName = filePath.replace(archetype.templatePath, "");
  filePath = path.join(process.cwd(), fileName);

  fs.writeFile(filePath, contents, function (err) {
    if (err) {
      log.error(err);
    }

    log.info("init", "Generated file " + filePath.replace(process.cwd() + "/", ""));
  });
};

var walker = function (dirPath, callback) {

  fs.readdir(dirPath, function (err, files) {
    if (err) {
      log.error(err);
    }

    files.forEach(function (file) {
      var filePath = path.join(dirPath, file);
      var stat = fs.statSync(filePath);
      if (stat.isFile()) {
        return callback(filePath);
      } else if (stat.isDirectory()) {

        var mkdirPath = path.join(process.cwd(), filePath.replace(archetype.templatePath, ""));
        fs.mkdir(mkdirPath, function (_err) {
          if (_err) {
            log.error(_err);
          }

          walker(filePath, callback);
        }.bind(this));
      }
    }.bind(this));
  }.bind(this));
};

/**
 * Init
 * @param {String} archetypeName  The name of the archetype in npm to install
 * @param {Function} callback The function to run after its all said and done
 * @returns {void}
 */
module.exports = function (archetypeName, callback) {
  archetype.templatePath = path.join(process.cwd(), "node_modules", archetypeName, "templates");
  archetype.name = archetypeName;

  async.series([
    installDeps,
    builderPrompt,
    pathWalker
  ]);
};

