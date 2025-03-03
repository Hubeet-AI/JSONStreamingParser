const { createTestContext, assert } = require('../setup');

describe('Performance Tests', () => {
	let context;

	beforeEach(() => {
		context = createTestContext();
	});

	afterEach(() => {
		context.parser.end();
	});

	it('should handle large objects within acceptable time', async () => {
		try {
			const { parser, results } = context;
			const start = process.hrtime();

			// Generate large test object
			const largeObject = { items: [] };
			for (let i = 0; i < 10000; i++) {
				largeObject.items.push({ id: i, value: `test${i}` });
			}

			parser.write(JSON.stringify(largeObject));
			parser.end({ reset: false });
			await parser.waitForEvents();

			const [seconds, nanoseconds] = process.hrtime(start);
			const totalTime = seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds

			assert.ok(totalTime < 1000, `Parsing took too long: ${totalTime}ms`);
			assert.strictEqual(results[0].entities[0].value.items.length, 10000);
			console.log('Ended on', totalTime);
		} catch (error) {
			throw error;
		}
	});
}); 