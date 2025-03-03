const { createTestContext, assert } = require('../setup');

describe('Basic JSON Parsing', () => {
	let context;

	beforeEach(() => {
		context = createTestContext();
	});

	afterEach(() => {
		if (context.parser) {
			context.parser.end();
		}
	});

	it('should parse text before the json', async function () {
		const { parser, results, waitForEvents } = context;

		const TEXT = 'hola ';
		const _JSON = '{"name": "John", "age": 30}';

		parser.write(TEXT);
		parser.write(_JSON);
		parser.end({ reset: false });
		await parser.waitForEvents();

		const result = results[0];
		assert.ok(result, 'No result received');
		assert.ok(result.entities, 'No entities in result');
		assert.ok(result.entities.length >= 2, 'Not enough entities');

		const [firstEntity, secondEntity] = result.entities;

		assert.strictEqual(firstEntity.finished, true, 'First entity not finished');
		assert.strictEqual(secondEntity.finished, true, 'Second entity not finished');
		assert.strictEqual(firstEntity.value, TEXT, 'Text mismatch');
		assert.deepStrictEqual(secondEntity.value, JSON.parse(_JSON), 'JSON mismatch');
		// assert.strictEqual(result.complete, true, 'Parse not complete');
	});

	it('should parse chunked JSON data', async () => {
		try {
			const { parser, results } = context;
			parser.reset();
			// Write chunks with small delays to simulate streaming
			await parser.write('{"hubeetArtifactId": "1234567890",');
			await parser.write('"status": "processing",');
			await parser.write('"progress": "45.0",');
			await parser.write('"details": {"stage": {"name": "validation"}}}');
			// Ensure we end and flush before assertions
			parser.end({ reset: false });
			await parser.waitForEvents();
			// Verify the final result
			const finalResult = results[results.length - 1];
			assert.ok(finalResult, 'No results received');
			assert.ok(finalResult.entities, 'No entities in result');
			assert.ok(finalResult.entities[0], 'No first entity');
			assert.deepStrictEqual(finalResult.entities[0].value, {
				hubeetArtifactId: "1234567890",
				status: "processing",
				progress: "45.0",
				details: {
					stage: {
						name: "validation"
					}
				}
			});
			assert.strictEqual(finalResult.complete, true, 'Parsing not marked as complete');
			assert.strictEqual(finalResult.entities[0].finished, true, 'Entity not marked as finished');
		} catch (error) {
			throw error;
		}
	});


	it('should parse complex json structures sent in random chunks', async () => {
		try {
			const { parser, results } = context;

			let complexObject = {
				"hubeetArtifactId": "1234567890",
				"status": "processing",
				"progress": "45.0",
				"details": { "stage": { "name": "validation" } }
			}

			let chunks = JSON.stringify(complexObject).split('');
			for (let i = 0; i < chunks.length; i++) {
				await parser.write(chunks[i]);
				await new Promise(resolve => { setTimeout(resolve, 10) });
			}
			parser.end({ reset: false });
			await parser.waitForEvents();

			assert.deepStrictEqual(results[results.length - 1].entities[0].value, complexObject);
			assert.deepStrictEqual(results[results.length - 1].complete, true);
			assert.deepStrictEqual(results[results.length - 1].entities[0].finished, true);

		} catch (error) {
			throw error;
		}
	});
}); 