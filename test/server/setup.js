"use strict";

/**
 * Test setup for server-side tests.
 */
var chai = require("chai");
var sinonChai = require("sinon-chai");

// Add chai plugins.
chai.use(sinonChai);

// Add test lib globals.
global.expect = chai.expect;
