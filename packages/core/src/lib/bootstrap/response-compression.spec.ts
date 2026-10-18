import * as express from 'express';
import * as http from 'http';
import { AddressInfo } from 'net';
import { gunzipSync } from 'zlib';
import {
	DEFAULT_COMPRESSION_LEVEL,
	DEFAULT_COMPRESSION_THRESHOLD,
	createResponseCompression,
	resolveResponseCompression,
	shouldCompressResponse
} from './response-compression';

describe('resolveResponseCompression', () => {
	const silent = { warn: jest.fn() };

	beforeEach(() => silent.warn.mockClear());

	it('is on by default, at zlib level 6, from 1 KB', () => {
		expect(resolveResponseCompression({}, silent)).toEqual({
			enabled: true,
			level: DEFAULT_COMPRESSION_LEVEL,
			threshold: DEFAULT_COMPRESSION_THRESHOLD
		});
		expect(silent.warn).not.toHaveBeenCalled();
	});

	it.each(['false', '0', 'no', 'off', ' OFF '])('API_COMPRESSION=%j turns it off', (value) => {
		expect(resolveResponseCompression({ API_COMPRESSION: value }, silent).enabled).toBe(false);
	});

	it.each(['true', '1', 'yes', 'anything-else'])('API_COMPRESSION=%j keeps it on', (value) => {
		expect(resolveResponseCompression({ API_COMPRESSION: value }, silent).enabled).toBe(true);
	});

	it('reads the level and the threshold', () => {
		expect(
			resolveResponseCompression({ API_COMPRESSION_LEVEL: '9', API_COMPRESSION_THRESHOLD: '0' }, silent)
		).toEqual({
			enabled: true,
			level: 9,
			threshold: 0
		});
	});

	it.each(['10', '-1', '6.5', 'fast'])('falls back to the default level for %j, with a warning', (value) => {
		expect(resolveResponseCompression({ API_COMPRESSION_LEVEL: value }, silent).level).toBe(
			DEFAULT_COMPRESSION_LEVEL
		);
		expect(silent.warn).toHaveBeenCalledTimes(1);
	});

	it('falls back to the default threshold for a value with a unit, with a warning', () => {
		expect(resolveResponseCompression({ API_COMPRESSION_THRESHOLD: '2kb' }, silent).threshold).toBe(
			DEFAULT_COMPRESSION_THRESHOLD
		);
		expect(silent.warn).toHaveBeenCalledTimes(1);
	});
});

describe('shouldCompressResponse', () => {
	const response = (contentType: string) =>
		({ getHeader: (name: string) => (name === 'Content-Type' ? contentType : undefined) }) as any;

	it('compresses JSON', () => {
		expect(shouldCompressResponse({ headers: {} } as any, response('application/json; charset=utf-8'))).toBe(true);
	});

	it('never compresses a server-sent event stream', () => {
		expect(shouldCompressResponse({ headers: {} } as any, response('text/event-stream'))).toBe(false);
		expect(shouldCompressResponse({ headers: {} } as any, response('Text/Event-Stream; charset=utf-8'))).toBe(
			false
		);
	});

	it('honours X-No-Compression', () => {
		expect(
			shouldCompressResponse({ headers: { 'x-no-compression': '1' } } as any, response('application/json'))
		).toBe(false);
	});

	it('leaves already compressed content alone, as the middleware itself does', () => {
		expect(shouldCompressResponse({ headers: {} } as any, response('image/png'))).toBe(false);
	});
});

describe('createResponseCompression', () => {
	it('returns no middleware when compression is off', () => {
		expect(createResponseCompression({ enabled: false, level: 6, threshold: 1024 })).toBeNull();
	});

	describe('on an Express app', () => {
		let server: http.Server;
		let base: string;
		const bigBody = { data: 'x'.repeat(5000) };

		beforeAll(async () => {
			const app = express();
			app.use(createResponseCompression({ enabled: true, level: 6, threshold: 1024 }) as express.RequestHandler);
			app.get('/big', (_req, res) => res.json(bigBody));
			app.get('/small', (_req, res) => res.json({ ok: true }));
			app.get('/events', (_req, res) => {
				res.setHeader('Content-Type', 'text/event-stream');
				res.end('data: a\n\n'.repeat(400));
			});
			server = app.listen(0);
			await new Promise((resolve) => server.once('listening', resolve));
			base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
		});

		afterAll(async () => {
			await new Promise((resolve) => server.close(resolve));
		});

		const get = (path: string, headers: Record<string, string> = {}) =>
			new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
				http.get(`${base}${path}`, { headers }, (res) => {
					const chunks: Buffer[] = [];
					res.on('data', (chunk) => chunks.push(chunk));
					res.on('end', () =>
						resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) })
					);
					res.on('error', reject);
				}).on('error', reject);
			});

		it('gzips a large JSON response for a client that accepts gzip, and the body round-trips', async () => {
			const res = await get('/big', { 'accept-encoding': 'gzip' });

			expect(res.status).toBe(200);
			expect(res.headers['content-encoding']).toBe('gzip');
			expect(res.headers['vary']).toMatch(/Accept-Encoding/i);
			expect(res.body.length).toBeLessThan(1000);
			expect(JSON.parse(gunzipSync(res.body).toString('utf8'))).toEqual(bigBody);
		});

		it('sends a response below the threshold as it is', async () => {
			const res = await get('/small', { 'accept-encoding': 'gzip' });

			expect(res.headers['content-encoding']).toBeUndefined();
			expect(JSON.parse(res.body.toString('utf8'))).toEqual({ ok: true });
		});

		it('sends the identity encoding to a client that accepts none', async () => {
			const res = await get('/big', { 'accept-encoding': 'identity' });

			expect(res.headers['content-encoding']).toBeUndefined();
			expect(JSON.parse(res.body.toString('utf8'))).toEqual(bigBody);
		});

		it('never compresses an event stream', async () => {
			const res = await get('/events', { 'accept-encoding': 'gzip' });

			expect(res.headers['content-encoding']).toBeUndefined();
			expect(res.body.toString('utf8').startsWith('data: a')).toBe(true);
		});

		it('honours X-No-Compression', async () => {
			const res = await get('/big', { 'accept-encoding': 'gzip', 'x-no-compression': '1' });

			expect(res.headers['content-encoding']).toBeUndefined();
			expect(JSON.parse(res.body.toString('utf8'))).toEqual(bigBody);
		});
	});
});
