const { createTestContext, assert } = require('../setup');

describe('Error Handling', () => {
	let context;

	beforeEach(() => {
		context = createTestContext();
	});

	afterEach(() => {
		if (context.parser) {
			context.parser.end();
		}
	});


	it('should handle malformed JSON with text prefix', async () => {
		try {
			const { parser, results } = context;

			parser.write('hola {id: 123} chau');
			parser.end({ reset: false });
			await parser.waitForEvents();

			let ent1 = results[0].entities[0];
			let ent2 = results[0].entities[1];
			let ent3 = results[0].entities[2];

			// We expect two entities: the text prefix and the JSON object
			assert.strictEqual(ent1.finished, true);
			assert.strictEqual(ent2.finished, true);
			assert.strictEqual(ent3.finished, true);
			assert.strictEqual(ent1.value, 'hola ');
			assert.deepStrictEqual(ent2.value, { id: 123 });
			assert.strictEqual(ent3.value, ' chau');

		} catch (error) {
			throw error;
		}
	});

	it('should handle missing commas in JSON', async () => {
		try {
			const { parser, results } = context;

			parser.write('{"name": "John" "age": 30}');
			parser.end({ reset: false });
			await parser.waitForEvents();
			let ent1 = results[0].entities[0];

			assert.deepStrictEqual(ent1.value, {
				name: "John"
			});
			assert.strictEqual(ent1.finished, true);

		} catch (error) {
			throw error;
		}
	});

	it('should handle extra commas in JSON', async () => {
		try {
			const { parser, results } = context;

			parser.write('{"name": "John",, "age": 30}');
			parser.end({ reset: false });
			await parser.waitForEvents();
			let ent1 = results[0].entities[0];

			assert.deepStrictEqual(ent1.value, {
				name: "John",
				age: 30
			});
			assert.strictEqual(ent1.finished, true);
		} catch (error) {
			throw error;
		}
	});
}); 