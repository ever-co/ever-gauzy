import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import { gzipSync } from 'node:zlib';
import { isPublicAddress } from '../egress/egress-address';
import { fetchPreviewPage, ILinkPreviewFetchOptions, LinkPreviewResolver } from './link-preview-fetcher';

/**
 * The egress guard of the preview fetch, against a real HTTP server on the loopback interface.
 *
 * The server stands in for a public site: the specs narrow the address policy to "public, or this one loopback
 * address" and the ports to the server's, and give the fetch a resolver that answers names chosen per test. Every
 * other address keeps the real rule, so a hop to a private address, an internal name or a name that resolves privately
 * is refused exactly as on a server — and the server's request log shows it was never reached.
 */

const LOOPBACK = '127.0.0.1';
const HEAD = '<html><head><title>Hello</title><meta property="og:title" content="A page"></head>';

let server: Server;
let port = 0;
let base = '';
const sockets = new Set<Socket>();
/** Every request the server received, by path. */
let requests: string[] = [];
/** Whether the huge answer's connection was closed before it was all written. */
let hugeClosedEarly = false;

function route(request: IncomingMessage, response: ServerResponse): void {
	const path = request.url ?? '/';
	requests.push(path);
	if (path === '/page') {
		response.writeHead(200, { 'content-type': 'text/html; charset=ISO-8859-1' });
		response.end(`${HEAD}<body>body</body></html>`);
	} else if (path === '/moved') {
		response.writeHead(301, { location: '/page' });
		response.end();
	} else if (path.startsWith('/to?')) {
		response.writeHead(302, { location: decodeURIComponent(path.slice(4)) });
		response.end();
	} else if (path.startsWith('/loop/')) {
		response.writeHead(302, { location: `/loop/${Number(path.slice(6)) + 1}` });
		response.end();
	} else if (path === '/rebind') {
		response.writeHead(302, { location: '/page' });
		response.end();
	} else if (path === '/huge') {
		// Megabytes of a head that never ends, written as fast as the reader takes them.
		response.writeHead(200, { 'content-type': 'text/html' });
		response.write('<html><head><title>Huge</title>');
		const chunk = Buffer.alloc(64 * 1024, 'a');
		let written = 0;
		const pump = () => {
			while (written < 64) {
				written++;
				if (!response.write(chunk)) return void response.once('drain', pump);
			}
			response.end('</head></html>');
		};
		response.on('close', () => (hugeClosedEarly = !response.writableFinished));
		pump();
	} else if (path === '/bomb') {
		// 32 MB of spaces, a few dozen kilobytes compressed.
		response.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' });
		response.end(bomb);
	} else if (path === '/gzip') {
		response.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' });
		response.end(gzipSync(Buffer.from(`${HEAD}<body></body>`)));
	} else if (path === '/long-body') {
		response.writeHead(200, { 'content-type': 'text/html' });
		response.end(`${HEAD}<body>${'b'.repeat(256 * 1024)}</body></html>`);
	} else if (path === '/script-split') {
		// A `</head>` inside a script arrives first; the real metadata a moment later.
		response.writeHead(200, { 'content-type': 'text/html' });
		response.write('<html><head><script>var a = "</head><body>";</script><!-- <body> -->');
		setTimeout(() => response.end('<meta property="og:title" content="Late"></head><body>body</body></html>'), 100);
	} else if (path === '/quoted-split') {
		// A `</head><body>` inside a quoted attribute value arrives first; the real metadata a moment later.
		response.writeHead(200, { 'content-type': 'text/html' });
		response.write('<html><head><meta name="x" content="</head><body> here">');
		setTimeout(() => response.end('<meta property="og:title" content="Quoted late"></head><body>body</body></html>'), 100);
	} else if (path === '/hang') {
		// Never answers.
	} else if (path === '/drip') {
		response.writeHead(200, { 'content-type': 'text/html' });
		response.write('<html><head>');
		const timer = setInterval(() => response.write('a'), 50);
		response.on('close', () => clearInterval(timer));
	} else if (path === '/image') {
		response.writeHead(200, { 'content-type': 'image/png' });
		response.end(Buffer.alloc(16));
	} else if (path === '/zstd') {
		response.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'zstd' });
		response.end(Buffer.alloc(16));
	} else {
		response.writeHead(404, { 'content-type': 'text/html' });
		response.end('<html><head><title>Not found</title></head></html>');
	}
}

/** 32 MB of spaces after the start of a head, a few dozen kilobytes compressed: made once. */
let bomb: Buffer;

beforeAll(async () => {
	bomb = gzipSync(Buffer.concat([Buffer.from('<html><head><title>Bomb</title>'), Buffer.alloc(32 * 1024 * 1024, ' ')]));
	server = createServer(route);
	server.on('connection', (socket) => {
		sockets.add(socket);
		socket.on('close', () => sockets.delete(socket));
	});
	await new Promise<void>((resolve) => server.listen(0, LOOPBACK, resolve));
	port = (server.address() as AddressInfo).port;
	base = `http://site.example.com:${port}`;
});

afterAll(async () => {
	for (const socket of sockets) socket.destroy();
	await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
	requests = [];
	hugeClosedEarly = false;
});

/** A resolver answering from a table (a name's answers in turn, the last one repeated); unknown names do not exist. */
function resolverOf(table: Record<string, string[][]>): jest.Mock<ReturnType<LinkPreviewResolver>, Parameters<LinkPreviewResolver>> {
	const asked: Record<string, number> = {};
	return jest.fn(async (hostname: string) => {
		const answers = table[hostname];
		if (!answers) throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), { code: 'ENOTFOUND' });
		const turn = Math.min(asked[hostname] ?? 0, answers.length - 1);
		asked[hostname] = (asked[hostname] ?? 0) + 1;
		return answers[turn];
	});
}

/** The fetch as the specs run it: the server's loopback address and port stand in for a public site. */
function fetchFrom(link: string, resolver: LinkPreviewResolver, overrides: Partial<ILinkPreviewFetchOptions> = {}) {
	return fetchPreviewPage(link, {
		resolver,
		policy: { isAllowedAddress: (address) => address === LOOPBACK || isPublicAddress(address), allowedPorts: [port], allowedProtocols: ['http:', 'https:'] },
		// Generous: a busy test machine must not turn a spec about something else into a timeout (the timeout specs set their own).
		timeoutMs: 5000,
		...overrides
	});
}

const SITE = { 'site.example.com': [[LOOPBACK]] };

describe('fetchPreviewPage: what it reads', () => {
	it('reads a page through the address it resolved, as the host the link names', async () => {
		const resolver = resolverOf(SITE);
		const outcome = await fetchFrom(`${base}/page#fragment`, resolver);
		expect(outcome).toMatchObject({ ok: true, url: `${base}/page`, contentType: 'text/html', charset: 'iso-8859-1' });
		expect(outcome.ok && outcome.body.toString()).toContain('og:title');
		expect(resolver).toHaveBeenCalledTimes(1);
		expect(resolver).toHaveBeenCalledWith('site.example.com');
		expect(requests).toEqual(['/page']);
	});

	it('follows a relative redirect, judging its target like the first hop', async () => {
		const outcome = await fetchFrom(`${base}/moved`, resolverOf(SITE));
		expect(outcome).toMatchObject({ ok: true, url: `${base}/page` });
		expect(requests).toEqual(['/moved', '/page']);
	});

	it('decompresses a gzip answer', async () => {
		const outcome = await fetchFrom(`${base}/gzip`, resolverOf(SITE));
		expect(outcome.ok && outcome.body.toString()).toContain('<title>Hello</title>');
	});

	it('stops reading at the end of the head', async () => {
		const outcome = await fetchFrom(`${base}/long-body`, resolverOf(SITE));
		expect(outcome.ok).toBe(true);
		expect(outcome.ok && outcome.body.length).toBeLessThan(64 * 1024);
	});

	it('keeps reading past a "</head>" written in a script or a comment, to the real end of the head', async () => {
		const outcome = await fetchFrom(`${base}/script-split`, resolverOf(SITE));
		expect(outcome.ok).toBe(true);
		expect(outcome.ok && outcome.body.toString()).toContain('content="Late"');
		const quoted = await fetchFrom(`${base}/quoted-split`, resolverOf(SITE));
		expect(quoted.ok && quoted.body.toString()).toContain('content="Quoted late"');
	});

	it('refuses an answer that is not HTML, in an encoding it does not read, or not a success', async () => {
		await expect(fetchFrom(`${base}/image`, resolverOf(SITE))).resolves.toEqual({ ok: false, reason: 'type' });
		await expect(fetchFrom(`${base}/zstd`, resolverOf(SITE))).resolves.toEqual({ ok: false, reason: 'type' });
		await expect(fetchFrom(`${base}/missing`, resolverOf(SITE))).resolves.toEqual({ ok: false, reason: 'status', status: 404 });
	});

	it('answers an error for a host that does not exist', async () => {
		await expect(fetchFrom(`http://nowhere.example.com:${port}/`, resolverOf(SITE))).resolves.toEqual({ ok: false, reason: 'error' });
	});
});

describe('fetchPreviewPage: private address literals', () => {
	it.each([
		'http://10.0.0.1:PORT/',
		'http://169.254.169.254:PORT/latest/meta-data/',
		'http://[::1]:PORT/',
		'http://[::ffff:10.0.0.1]:PORT/',
		'http://[fd00:ec2::254]:PORT/',
		'http://[fe80::1]:PORT/',
		'http://192.168.1.1:PORT/',
		'http://0.0.0.0:PORT/'
	])('refuses %s before resolving or connecting', async (link) => {
		const resolver = resolverOf(SITE);
		await expect(fetchFrom(link.replace('PORT', String(port)), resolver)).resolves.toEqual({ ok: false, reason: 'blocked' });
		expect(resolver).not.toHaveBeenCalled();
		expect(requests).toEqual([]);
	});

	it('refuses the loopback address itself under the server policy', async () => {
		// The real policy (only the port widened): the server below is on 127.0.0.1, so a fetch that got through would show in its log.
		const outcome = await fetchPreviewPage(`http://${LOOPBACK}:${port}/page`, {
			resolver: resolverOf(SITE),
			policy: { isAllowedAddress: isPublicAddress, allowedPorts: [port], allowedProtocols: ['http:', 'https:'] }
		});
		expect(outcome).toEqual({ ok: false, reason: 'blocked' });
		expect(requests).toEqual([]);
	});

	it('refuses internal names and other ports without resolving them', async () => {
		const resolver = resolverOf({ localhost: [[LOOPBACK]], intranet: [[LOOPBACK]] });
		await expect(fetchFrom(`http://localhost:${port}/page`, resolver)).resolves.toEqual({ ok: false, reason: 'blocked' });
		await expect(fetchFrom(`http://intranet:${port}/page`, resolver)).resolves.toEqual({ ok: false, reason: 'blocked' });
		await expect(fetchFrom(`http://site.example.com:${port + 1}/page`, resolverOf(SITE))).resolves.toEqual({ ok: false, reason: 'blocked' });
		await expect(fetchFrom(`ftp://site.example.com:${port}/page`, resolverOf(SITE))).resolves.toEqual({ ok: false, reason: 'blocked' });
		expect(resolver).not.toHaveBeenCalled();
		expect(requests).toEqual([]);
	});
});

describe('fetchPreviewPage: names that resolve privately (DNS rebinding)', () => {
	it.each([
		[['10.0.0.7']],
		[['192.168.0.10']],
		[['169.254.169.254']],
		[['::1']],
		[['fd12:3456::1']],
		[['::ffff:127.0.0.2']],
		// One private answer among public ones refuses the host: the connection could pick it.
		[[LOOPBACK, '10.0.0.7']],
		[['not-an-address']]
	])('refuses a host that resolves to %p without connecting', async (answer) => {
		const resolver = resolverOf({ 'inside.example.com': [answer] });
		await expect(fetchFrom(`http://inside.example.com:${port}/page`, resolver)).resolves.toEqual({ ok: false, reason: 'blocked' });
		expect(requests).toEqual([]);
	});

	it('connects to the address it judged, and never asks the name again for that connection', async () => {
		// Public to the check, private on any later lookup: a client that resolved again when it connects would go inward.
		const resolver = resolverOf({ 'flip.example.com': [[LOOPBACK], ['10.0.0.7']] });
		const outcome = await fetchFrom(`http://flip.example.com:${port}/page`, resolver);
		expect(outcome.ok).toBe(true);
		expect(resolver).toHaveBeenCalledTimes(1);
		expect(requests).toEqual(['/page']);
	});

	it('judges the name again on every redirect hop, and refuses the hop where it turned private', async () => {
		const resolver = resolverOf({ 'flip.example.com': [[LOOPBACK], ['10.0.0.7']] });
		const outcome = await fetchFrom(`http://flip.example.com:${port}/rebind`, resolver);
		expect(outcome).toEqual({ ok: false, reason: 'blocked' });
		expect(resolver).toHaveBeenCalledTimes(2);
		expect(requests).toEqual(['/rebind']);
	});
});

describe('fetchPreviewPage: redirects to private hosts', () => {
	const to = (target: string) => `${base}/to?${encodeURIComponent(target)}`;

	it.each([
		'http://10.0.0.1:PORT/',
		'http://169.254.169.254:PORT/latest/meta-data/iam/security-credentials/',
		'http://[::1]:PORT/',
		'http://[fd00:ec2::254]:PORT/latest/meta-data/',
		'http://metadata.google.internal:PORT/computeMetadata/v1/',
		'http://10.0.0.1/',
		'http://localhost:PORT/page',
		'http://inside.example.com:PORT/page',
		'file:///etc/passwd',
		'gopher://site.example.com:PORT/'
	])('refuses a redirect to %s', async (target) => {
		const resolver = resolverOf({ ...SITE, 'inside.example.com': [['10.1.2.3']] });
		await expect(fetchFrom(to(target.replace('PORT', String(port))), resolver)).resolves.toEqual({ ok: false, reason: 'blocked' });
		// The redirect was read; its target never was.
		expect(requests).toHaveLength(1);
	});

	it('follows at most the redirects it is allowed', async () => {
		const outcome = await fetchFrom(`${base}/loop/0`, resolverOf(SITE), { maxRedirects: 3 });
		expect(outcome).toEqual({ ok: false, reason: 'redirects' });
		expect(requests).toEqual(['/loop/0', '/loop/1', '/loop/2', '/loop/3']);
	});
});

describe('fetchPreviewPage: size and time', () => {
	it('reads no more than its byte limit of an answer that does not end, and closes the connection', async () => {
		const outcome = await fetchFrom(`${base}/huge`, resolverOf(SITE), { maxBytes: 64 * 1024 });
		expect(outcome.ok).toBe(true);
		expect(outcome.ok && outcome.body.length).toBe(64 * 1024);
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(hugeClosedEarly).toBe(true);
	});

	it('reads no more than its byte limit of a compressed answer, however far it would grow', async () => {
		// A generous deadline: this is about the byte limit, and a busy test machine must not turn it into a timeout.
		const outcome = await fetchFrom(`${base}/bomb`, resolverOf(SITE), { maxBytes: 64 * 1024, timeoutMs: 10_000 });
		expect(outcome.ok).toBe(true);
		expect(outcome.ok && outcome.body.length).toBeLessThanOrEqual(64 * 1024);
	});

	it('gives up on a server that never answers, within its deadline', async () => {
		const started = Date.now();
		await expect(fetchFrom(`${base}/hang`, resolverOf(SITE), { timeoutMs: 300 })).resolves.toEqual({ ok: false, reason: 'timeout' });
		expect(Date.now() - started).toBeLessThan(2000);
	});

	it('gives up on a server that drips its head byte by byte', async () => {
		const started = Date.now();
		await expect(fetchFrom(`${base}/drip`, resolverOf(SITE), { timeoutMs: 400 })).resolves.toEqual({ ok: false, reason: 'timeout' });
		expect(Date.now() - started).toBeLessThan(2000);
	});

	it('gives up on a resolver that never answers, within its deadline', async () => {
		const stalled: LinkPreviewResolver = () => new Promise<string[]>(() => undefined);
		await expect(fetchFrom(`${base}/page`, stalled, { timeoutMs: 200 })).resolves.toEqual({ ok: false, reason: 'timeout' });
	});
});
