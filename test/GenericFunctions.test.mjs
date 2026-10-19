// Run after `npm run build`: npm test
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { checkResponse, contentsToItems, urlsToItems } = require('../dist/nodes/ContextFetch/GenericFunctions.js');

const ctx = { getNode: () => ({ name: 'ContextFetch', type: 'n8n-nodes-contextfetch.contextFetch' }), getItemIndex: () => 0 };
const BUY = 'https://api.contextfetch.dev/buy/instant';

test('2xx passes items through', async () => {
	const items = [{ json: { a: 1 } }];
	assert.equal(await checkResponse.call(ctx, items, { statusCode: 200, headers: {}, body: {} }), items);
});

test('402 puts the payment link in the message and the packs in the description', async () => {
	const body = {
		error: 'insufficient_credits',
		message: 'This request needs 1 credit(s), more than the key has left. Reload 15,000 searches for $15.',
		action: { type: 'payment_link', url: BUY, prompt_to_user: `ContextFetch credits ran out. Reload 15,000 searches for $15: ${BUY}` },
		packs: [{ name: 'Builder', credits: 60000, price_usd: 50, checkout_url: 'https://api.contextfetch.dev/buy/builder' }],
	};
	await assert.rejects(checkResponse.call(ctx, [], { statusCode: 402, headers: { 'x-payment-url': BUY }, body }), (e) => {
		assert.match(e.message, /Buy credits: https:\/\/api\.contextfetch\.dev\/buy\/instant$/);
		assert.match(e.description, /Builder: \$50 for 60,000 credits/);
		assert.equal(e.httpCode, '402');
		return true;
	});
});

test('402 without a body still links the X-Payment-URL header', async () => {
	const url = 'https://api.contextfetch.dev/buy/scale';
	await assert.rejects(checkResponse.call(ctx, [], { statusCode: 402, headers: { 'x-payment-url': url }, body: '' }), (e) =>
		e.message.endsWith(url),
	);
});

test('401 and 422 explain what to change', async () => {
	await assert.rejects(checkResponse.call(ctx, [], { statusCode: 401, headers: {}, body: { error: 'invalid_api_key' } }), (e) =>
		/API key/.test(e.message),
	);
	const detail = [{ loc: ['body', 'maxDepth'], msg: 'Input should be less than or equal to 3' }];
	await assert.rejects(checkResponse.call(ctx, [], { statusCode: 422, headers: {}, body: { detail } }), (e) =>
		e.message.includes('maxDepth: Input should be less than or equal to 3'),
	);
});

test('Get Contents returns loaded pages and failed URLs as items', async () => {
	const body = {
		results: [{ url: 'https://example.com/', text: '# Example' }],
		statuses: [
			{ id: 'https://example.com/', status: 'success' },
			{ id: 'https://example.com/404', status: 'error', error: { tag: 'CRAWL_NOT_FOUND', message: 'HTTP 404' } },
		],
	};
	const items = await contentsToItems.call(ctx, [], { statusCode: 200, headers: {}, body });
	assert.deepEqual(
		items.map((i) => i.json),
		[{ url: 'https://example.com/', text: '# Example' }, { url: 'https://example.com/404', error: 'HTTP 404', errorTag: 'CRAWL_NOT_FOUND' }],
	);
});

test('Map returns one item per URL', async () => {
	const items = await urlsToItems.call(ctx, [], { statusCode: 200, headers: {}, body: { results: ['https://a.dev/1', 'https://a.dev/2'] } });
	assert.deepEqual(items, [{ json: { url: 'https://a.dev/1' } }, { json: { url: 'https://a.dev/2' } }]);
});
