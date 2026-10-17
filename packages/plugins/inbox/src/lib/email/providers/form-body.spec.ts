import { EventEmitter } from 'node:events';
import { PayloadTooLargeException } from '@nestjs/common';
import { InboundRawBodyMiddleware } from '../inbound/inbound-raw-body.middleware';
import { parseAddressList, readInboundForm } from './form-body';

/** A multipart body as a provider sends it (the boundary in the content type). */
async function multipart(form: FormData): Promise<{ type: string; raw: Buffer }> {
	const request = new Request('http://localhost/', { method: 'POST', body: form });
	return { type: request.headers.get('content-type') as string, raw: Buffer.from(await request.arrayBuffer()) };
}

describe('provider form webhooks', () => {
	it('reads a multipart form: fields (first value) and files', async () => {
		const form = new FormData();
		form.append('recipient', 'support.ever@inbox.example.test');
		form.append('recipient', 'ignored@example.test');
		form.append('attachment-1', new Blob([Buffer.from('%PDF-1.4')], { type: 'application/pdf' }), 'receipt.pdf');
		const { type, raw } = await multipart(form);
		const read = await readInboundForm({ headers: { 'content-type': type }, body: {}, rawBody: raw });
		expect(read?.fields).toEqual({ recipient: 'support.ever@inbox.example.test' });
		expect(read?.files).toHaveLength(1);
		expect(read?.files[0]).toMatchObject({
			field: 'attachment-1',
			filename: 'receipt.pdf',
			contentType: 'application/pdf'
		});
		expect(read?.files[0]?.content.toString()).toBe('%PDF-1.4');
	});

	it('reads a URL-encoded form the API parsed, and nothing else', async () => {
		const fields = await readInboundForm({
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: { token: 'abc', list: ['first', 'second'], count: 2 }
		});
		expect(fields).toEqual({ fields: { token: 'abc', list: 'first' }, files: [] });
		expect(await readInboundForm({ headers: { 'content-type': 'application/json' }, body: {} })).toBeNull();
		// A multipart type without its bytes, or bytes that are no form.
		expect(
			await readInboundForm({ headers: { 'content-type': 'multipart/form-data; boundary=x' }, body: {} })
		).toBeNull();
		expect(
			await readInboundForm({
				headers: { 'content-type': 'multipart/form-data; boundary=x' },
				body: {},
				rawBody: Buffer.from('not a form')
			})
		).toBeNull();
	});

	it('splits an address list on the commas outside quoted names', () => {
		expect(parseAddressList('"Lovelace, Ada" <ada@acme.test>, bob@acme.test, Undisclosed recipients:;')).toEqual([
			{ address: 'ada@acme.test', name: 'Lovelace, Ada' },
			{ address: 'bob@acme.test' }
		]);
		// An escaped quote stays inside the name, with the comma after it.
		expect(parseAddressList('"Ada \\"Ace, Lovelace" <ada@acme.test>, bob@acme.test')).toEqual([
			{ address: 'ada@acme.test', name: 'Ada "Ace, Lovelace' },
			{ address: 'bob@acme.test' }
		]);
		expect(parseAddressList(undefined)).toEqual([]);
	});

	describe('the webhook route’s raw body', () => {
		function request(type: string) {
			return Object.assign(new EventEmitter(), {
				headers: { 'content-type': type } as Record<string, string>,
				rawBody: undefined as Buffer | undefined
			});
		}

		afterEach(() => {
			delete process.env['GAUZY_INBOX_MAX_MESSAGE_BYTES'];
		});

		it('keeps a multipart or text body as the raw bytes', () => {
			const incoming = request('multipart/form-data; boundary=x');
			const next = jest.fn();
			new InboundRawBodyMiddleware().use(incoming as never, {}, next);
			incoming.emit('data', Buffer.from('ab'));
			incoming.emit('data', Buffer.from('cd'));
			incoming.emit('end');
			expect(incoming.rawBody?.toString()).toBe('abcd');
			expect(next).toHaveBeenCalledWith(undefined);
		});

		it('passes a JSON body untouched, and refuses one over the limit', () => {
			const json = request('application/json');
			const next = jest.fn();
			new InboundRawBodyMiddleware().use(json as never, {}, next);
			expect(next).toHaveBeenCalledWith();
			expect(json.listenerCount('data')).toBe(0);

			process.env['GAUZY_INBOX_MAX_MESSAGE_BYTES'] = '10';
			const big = request('text/plain; charset=UTF-8');
			const refused = jest.fn();
			new InboundRawBodyMiddleware().use(big as never, {}, refused);
			big.emit('data', Buffer.alloc(2 * 1024 * 1024));
			big.emit('end');
			expect(refused).toHaveBeenCalledTimes(1);
			expect(refused.mock.calls[0]?.[0]).toBeInstanceOf(PayloadTooLargeException);
			expect(big.rawBody).toBeUndefined();
		});
	});
});
