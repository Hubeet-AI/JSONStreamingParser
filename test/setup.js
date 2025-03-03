const JSONStreamingParser = require('../src/index.js');
const assert = require('assert');

/**
 * Creates a test context with parser and results array
 * @returns {Object} Test context with parser and results
 */
function createTestContext() {
	const parser = new JSONStreamingParser();
	const results = [];
	parser.on('updateObject', (obj) => {
		results[0] = obj;
	});

	const done = () => {
		parser.end();
	}

	return { parser, results, done };
}

module.exports = {
	createTestContext,
	assert
}; 