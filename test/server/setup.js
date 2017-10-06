"use strict";

/**
 * Test setup for server-side tests.
 */
// Polyfills (for early node).
Object.assign = Object.assign || require("object-assign"); // eslint-disable-line global-require

// Start the mock import _first_ to inject mocks into everything.
require("mock-fs");

var chai = require("chai");
var sinonChai = require("sinon-chai");

// Add chai plugins.
chai.use(sinonChai);

// Add test lib globals.
global.expect = chai.expect;
