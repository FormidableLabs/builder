"use strict";

var path = require("path");
var chalk = require("chalk");
var _ = require("lodash");

// Load local `package.json`.
/*eslint-disable global-require*/
// TODO: Protect on import error.
var CWD_PKG = (require(path.join(process.cwd(), "package.json")) || {}).scripts || {};
// TODO: HACK -- Import archetypes
var ARCH_PKG = (require(path.join(process.cwd(),
  "node_modules/builder-react-component/package.json")) || {}).scripts || {};
/*eslint-enable global-require*/

module.exports = {
  cwd: CWD_PKG,
  archetype: ARCH_PKG,

  // TODO: Resolve passthrough calls to real command.
  display: function () {
    return _.map(_.merge({}, ARCH_PKG, CWD_PKG), function (val, key) {
      return "\n  " + chalk.cyan(key) + "\n    " + val;
    }).join("\n");
  }
};
