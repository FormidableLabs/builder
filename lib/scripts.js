"use strict";

var path = require("path");
var _ = require("lodash");

// Load local `package.json`.
// TODO: Protect on import error.
var CWD_PKG = (require(path.join(process.cwd(), "package.json")) || {}).scripts || {};
// TODO: HACK -- Import archetypes
var ARCH_PKG = (require(path.join(process.cwd(), "node_modules/builder-react-component/package.json")) || {}).scripts || {};

var scripts = module.exports = {
  cwd: CWD_PKG,
  archetype: ARCH_PKG,

  // TODO: Resolve passthrough calls to real command.
  display: function () {
    return _.map(_.merge({}, ARCH_PKG, CWD_PKG), function (val, key) {
      return "\n  " + key + "\n    " + val;
    }).join("\n");
  }
};
