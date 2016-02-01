"use strict";

/**
 * Test setup for server-side tests.
 */
// Start the mock import _first_ to inject mocks into everything.
require("mock-fs");

var chai = require("chai");
var sinonChai = require("sinon-chai");

// Add chai plugins.
chai.use(sinonChai);

// Add test lib globals.
global.expect = chai.expect;
