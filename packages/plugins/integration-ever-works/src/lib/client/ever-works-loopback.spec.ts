// cspell:ignore EINSECURE
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { EverWorksClientFactory } from './ever-works-client.factory';
import { isEverWorksLoopbackUrl, readEverWorksAllowLoopback } from './ever-works-loopback';
import { AxiosEverWorksTransport } from './ever-works-transport';

/** A made-up key, assembled at run time so secret scanners do not take it for a real one. */
const FAKE_KEY = ['ew_int', 'TEST_FIXTURE', 'not', 'a', 'real', 'key'].join('_');

describe('readEverWorksAllowLoopback', () => {
	it.each([
		[{}, false],
		[{ EVER_WORKS_ALLOW_LOOPBACK: 'false', NODE_ENV: 'development' }, false],
		[{ EVER_WORKS_ALLOW_LOOPBACK: 'true', NODE_ENV: 'development' }, true],
		[{ EVER_WORKS_ALLOW_LOOPBACK: 'true', NODE_ENV: 'test' }, true],
		[{ EVER_WORKS_ALLOW_LOOPBACK: 'true', NODE_ENV: 'production' }, false],
		[{ EVER_WORKS_ALLOW_LOOPBACK: 'true' }, false],
		[{ EVER_WORKS_ALLOW_LOOPBACK: 'TRUE', NODE_ENV: 'development' }, false]
	])('%j → %s', (env, expected) => expect(readEverWorksAllowLoopback(env as Record<string, string>)).toBe(expected));
});

describe('isEverWorksLoopbackUrl', () => {
	it.each(['http://127.0.0.1:3100/api', 'http://localhost:3100', 'https://LOCALHOST/api', 'http://[::1]:3100/api'])(
		'admits %s',
		(url) => expect(isEverWorksLoopbackUrl(url)).toBe(true)
	);
	it.each([
		'http://127.0.0.2/api',
		'http://10.0.0.1/api',
		'http://169.254.169.254/',
		'http://localhost.example.test/api',
		'http://user:pass@127.0.0.1/api',
		'ftp://127.0.0.1/',
		'not a url'
	])('refuses %s', (url) => expect(isEverWorksLoopbackUrl(url)).toBe(false));
});

describe('the loopback transport (EVER_WORKS_ALLOW_LOOPBACK)', () => {
	let server: Server;
	let base: string;
	const seen: Array<{ url: string; auth: string | undefined }> = [];

	beforeAll(async () => {
		server = createServer((req, res) => {
			seen.push({ url: req.url ?? '', auth: req.headers.authorization });
			res.setHeader('content-type', 'application/json');
			res.end(JSON.stringify({ keyId: 'k', tenant: { id: 't' }, apiVersion: '1' }));
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	});
	afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

	it('refuses plain HTTP when the switch is off (the default)', async () => {
		await expect(
			new AxiosEverWorksTransport().send({
				method: 'GET',
				url: `${base}/api/integrations/v1/whoami`,
				headers: {},
				timeoutMs: 2000
			})
		).rejects.toMatchObject({ code: 'EINSECURE' });
		expect(() => new EverWorksClientFactory().create({ apiBaseUrl: `${base}/api`, apiKey: FAKE_KEY })).toThrow(
			/Invalid Ever Works API URL/
		);
	});

	it('reaches a loopback Ever Works over HTTP when the config switches it on', async () => {
		const client = new EverWorksClientFactory({ allowLoopback: true }).create({
			apiBaseUrl: `${base}/api`,
			apiKey: FAKE_KEY
		});
		await expect(client.whoami()).resolves.toMatchObject({ keyId: 'k' });
		expect(seen.at(-1)).toEqual({ url: '/api/integrations/v1/whoami', auth: `Bearer ${FAKE_KEY}` });
	});

	it('still sends any non-loopback HTTP URL nowhere with the switch on', async () => {
		await expect(
			new AxiosEverWorksTransport({ allowLoopback: true }).send({
				method: 'GET',
				url: 'http://10.0.0.1/api',
				headers: {},
				timeoutMs: 2000
			})
		).rejects.toMatchObject({ code: 'EINSECURE' });
		expect(() =>
			new EverWorksClientFactory({ allowLoopback: true }).create({
				apiBaseUrl: 'http://10.0.0.1/api',
				apiKey: FAKE_KEY
			})
		).toThrow(/Invalid Ever Works API URL/);
	});
});
