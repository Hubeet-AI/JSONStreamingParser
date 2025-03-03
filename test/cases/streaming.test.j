const { createTestContext, assert } = require('../setup');

describe('Streaming Features', () => {
	let context;

	beforeEach(() => {
		context = createTestContext();
	});

	afterEach(() => {
		context.parser.end();
	});

	it('should emit partial objects during streaming', async () => {
		try {
			const { parser, results } = context;

			parser.write('{"id": 1,');
			assert.deepStrictEqual(results[0].value, { id: 1 });

			parser.write('"name": "John"}');
			assert.deepStrictEqual(results[1].value, {
				id: 1,
				name: "John"
			});
		} catch (error) {
			throw error;
		}
	});

	it('should handle nested objects in streaming mode', async () => {
		try {
			const { parser, results } = context;

			parser.write('{"user": {');
			parser.write('"id": 1,');
			parser.write('"details": {');
			parser.write('"age": 30');
			parser.write('}}}');

			assert.deepStrictEqual(results[results.length - 1].value, {
				user: {
					id: 1,
					details: {
						age: 30
					}
				}
			});
		} catch (error) {
			throw error;
		}
	});
}); 