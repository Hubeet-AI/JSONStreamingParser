const { createTestContext, assert } = require('../setup');

describe('Edge Cases', () => {
	let context;

	beforeEach(() => {
		context = createTestContext();
	});

	afterEach(() => {
		if (context.parser) {
			context.parser.end();
		}
	});


	it('should handle empty input correctly', async () => {
		try {
			const { parser, results } = context;

			parser.write('');
			parser.end({ reset: false });
			await parser.waitForEvents();
			assert.strictEqual(results[0].entities.length, 0);
		} catch (error) {
			throw error;
		}
	});

	it('should handle very large numbers as strings', async () => {
		try {
			const { parser, results } = context;

			parser.write('{"bigNumber": "12345678901234567890"}');
			parser.end({ reset: false });
			await parser.waitForEvents();

			assert.deepStrictEqual(results[0].entities[0].value, {
				bigNumber: "12345678901234567890"
			});
		} catch (error) {
			throw error;
		}
	});

	it('should handle unicode characters correctly', async () => {
		try {
			const { parser, results } = context;

			parser.write('{"text": "Hello 🌍"}');
			parser.end({ reset: false });
			await parser.waitForEvents();
			let entity_1 = results[0].entities[0];
			assert.deepStrictEqual(entity_1.value, {
				text: "Hello 🌍"
			});
			assert.deepStrictEqual(entity_1.finished, true);
			assert.deepStrictEqual(entity_1.id, 0);
		} catch (error) {
			throw error;
		}
	});


}); 