import { jsonHeadersWithin, jsonListWithin, MYSQL_TEXT_BYTES } from './text-budget';

/** The `text` budgets of an inbound message's lists and headers (review F109). */
describe('text budgets', () => {
	const addresses = (count: number) =>
		Array.from({ length: count }, (_, n) => ({ address: `member-${n}@lists.example.test`, name: `Member ${n}` }));

	it('keeps a list whole without a budget, or when it fits', () => {
		const list = addresses(3);
		expect(jsonListWithin(list, null)).toBe(JSON.stringify(list));
		expect(jsonListWithin(list, MYSQL_TEXT_BYTES)).toBe(JSON.stringify(list));
		expect(jsonListWithin([], MYSQL_TEXT_BYTES)).toBeNull();
		expect(jsonListWithin(null, null)).toBeNull();
	});

	it('keeps the first addresses that fit a MySQL text column, and the last references', () => {
		const list = addresses(1500);
		expect(Buffer.byteLength(JSON.stringify(list))).toBeGreaterThan(MYSQL_TEXT_BYTES);
		const kept = JSON.parse(jsonListWithin(list, MYSQL_TEXT_BYTES) as string) as typeof list;
		expect(Buffer.byteLength(JSON.stringify(kept))).toBeLessThanOrEqual(MYSQL_TEXT_BYTES);
		expect(kept[0]).toEqual(list[0]);
		// As many as fit: one more would not.
		expect(Buffer.byteLength(JSON.stringify(list.slice(0, kept.length + 1)))).toBeGreaterThan(MYSQL_TEXT_BYTES);

		const references = Array.from({ length: 2000 }, (_, n) => `<message-${n}@mail.example.test>`);
		const tail = JSON.parse(jsonListWithin(references, MYSQL_TEXT_BYTES, 'tail') as string) as string[];
		expect(tail[tail.length - 1]).toBe(references[references.length - 1]);
		expect(Buffer.byteLength(JSON.stringify(tail))).toBeLessThanOrEqual(MYSQL_TEXT_BYTES);
	});

	it('counts bytes, not characters (4-byte characters in names)', () => {
		const list = Array.from({ length: 100 }, (_, n) => ({ address: `a${n}@example.test`, name: '😀'.repeat(50) }));
		const kept = jsonListWithin(list, 5_000) as string;
		expect(Buffer.byteLength(kept)).toBeLessThanOrEqual(5_000);
	});

	it('drops headers from the last one until they fit, never the hold and the tag', () => {
		const headers: Record<string, string> = { subject: 'Hello' };
		for (let n = 0; n < 24; n++) headers[`x-long-${n}`] = 'é'.repeat(1000);
		headers['x-gauzy-inbox-tag'] = 'invoices';
		headers['x-gauzy-inbox-hold'] = 'virus';
		expect(jsonHeadersWithin(headers, null)).toBe(JSON.stringify(headers));
		const kept = JSON.parse(
			jsonHeadersWithin(headers, 10_000, ['x-gauzy-inbox-tag', 'x-gauzy-inbox-hold']) as string
		);
		expect(Buffer.byteLength(JSON.stringify(kept))).toBeLessThanOrEqual(10_000);
		expect(kept).toMatchObject({
			subject: 'Hello',
			'x-gauzy-inbox-tag': 'invoices',
			'x-gauzy-inbox-hold': 'virus'
		});
		expect(jsonHeadersWithin({}, 10)).toBeNull();
	});
});
