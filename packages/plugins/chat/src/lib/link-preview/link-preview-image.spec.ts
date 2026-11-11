// cspell:ignore ftypavif ftypavis WEBPVP miaf
import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import { isPublicAddress } from '../egress/egress-address';
import { fetchPreviewImage, sniffImageType } from './link-preview-image';

/** The first bytes of each picture type taken, padded to a picture's minimum length. */
const pad = (head: number[] | string) => Buffer.concat([typeof head === 'string' ? Buffer.from(head, 'latin1') : Buffer.from(head), Buffer.alloc(32)]);
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = pad([0xff, 0xd8, 0xff, 0xe0]);
const GIF = pad('GIF89a');
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(32)]);
const AVIF = Buffer.concat([Buffer.from([0, 0, 0, 0x1c]), Buffer.from('ftypavif'), Buffer.alloc(32)]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="10" height="10"/></svg>');

describe('sniffImageType', () => {
	it('names the raster types by their bytes', () => {
		expect([PNG, JPEG, GIF, WEBP, AVIF].map(sniffImageType)).toEqual(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif']);
	});

	it('names AVIF by a compatible brand too, within its file-type box', () => {
		const box = (major: string, compatible: string[]) => {
			const size = 16 + compatible.length * 4;
			const head = Buffer.alloc(4);
			head.writeUInt32BE(size, 0);
			return Buffer.concat([head, Buffer.from(`ftyp${major}`), Buffer.alloc(4), Buffer.from(compatible.join('')), Buffer.alloc(32)]);
		};
		expect(sniffImageType(box('mif1', ['mif1', 'avif', 'miaf']))).toBe('image/avif');
		expect(sniffImageType(box('mif1', ['mif1', 'miaf']))).toBeNull();
		// A brand after the end of the box is not one of its brands.
		const short = box('mif1', ['mif1']);
		short.write('avif', 20, 'latin1');
		expect(sniffImageType(short)).toBeNull();
	});

	it('names nothing else: SVG, HTML, text, too short', () => {
		expect(sniffImageType(SVG)).toBeNull();
		expect(sniffImageType(Buffer.from('<html><head></head></html>'))).toBeNull();
		expect(sniffImageType(Buffer.from([0x89, 0x50, 0x4e]))).toBeNull();
		expect(sniffImageType(Buffer.alloc(0))).toBeNull();
	});
});

describe('fetchPreviewImage', () => {
	const LOOPBACK = '127.0.0.1';
	let server: Server;
	let port = 0;
	const sockets = new Set<Socket>();
	let requests: string[] = [];

	function route(request: IncomingMessage, response: ServerResponse): void {
		requests.push(request.url ?? '/');
		const send = (type: string, body: Buffer) => {
			response.writeHead(200, { 'content-type': type });
			response.end(body);
		};
		if (request.url === '/a.png') send('image/png', PNG);
		else if (request.url === '/untyped') send('application/octet-stream', JPEG);
		else if (request.url === '/lying.png') send('image/png', Buffer.from('<html><script>alert(1)</script></html>'.padEnd(64, ' ')));
		else if (request.url === '/a.svg') send('image/svg+xml', SVG);
		else if (request.url === '/page') send('text/html', Buffer.from('<html></html>'));
		else if (request.url === '/large.png') send('image/png', Buffer.concat([PNG, Buffer.alloc(2048)]));
		else if (request.url === '/broken.png') {
			// A picture that promises more than it sends: the connection breaks after its first bytes.
			response.writeHead(200, { 'content-type': 'image/png', 'content-length': '4096' });
			response.write(PNG);
			setTimeout(() => response.socket?.destroy(), 50);
		}
		else if (request.url === '/inward') {
			// On the server's own port, so it is the address that is refused, not the port.
			const own = (request.headers.host ?? '').split(':')[1];
			response.writeHead(302, { location: `http://169.254.169.254:${own}/latest/meta-data/` });
			response.end();
		} else {
			response.writeHead(404);
			response.end();
		}
	}

	beforeAll(async () => {
		server = createServer(route);
		server.on('connection', (socket) => {
			sockets.add(socket);
			socket.on('close', () => sockets.delete(socket));
		});
		await new Promise<void>((resolve) => server.listen(0, LOOPBACK, resolve));
		port = (server.address() as AddressInfo).port;
	});

	afterAll(async () => {
		for (const socket of sockets) socket.destroy();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	});

	beforeEach(() => {
		requests = [];
	});

	const fetchImage = (path: string, maxBytes?: number) =>
		fetchPreviewImage(`http://cdn.example.com:${port}${path}`, {
			resolver: async (hostname) => (hostname === 'cdn.example.com' ? [LOOPBACK] : []),
			policy: { isAllowedAddress: (address) => address === LOOPBACK || isPublicAddress(address), allowedPorts: [port], allowedProtocols: ['http:', 'https:'] },
			timeoutMs: 5000,
			...(maxBytes ? { maxBytes } : {})
		});

	it('takes a picture by its bytes, whatever type the answer named', async () => {
		await expect(fetchImage('/a.png')).resolves.toEqual({ ok: true, type: 'image/png', body: PNG });
		await expect(fetchImage('/untyped')).resolves.toMatchObject({ ok: true, type: 'image/jpeg' });
	});

	it('refuses SVG, HTML, and bytes that are not the picture the answer claims', async () => {
		await expect(fetchImage('/a.svg')).resolves.toEqual({ ok: false, reason: 'type' });
		await expect(fetchImage('/page')).resolves.toEqual({ ok: false, reason: 'type' });
		await expect(fetchImage('/lying.png')).resolves.toEqual({ ok: false, reason: 'type' });
	});

	it('refuses a picture whose download broke off, never serving what came of it', async () => {
		await expect(fetchImage('/broken.png')).resolves.toEqual({ ok: false, reason: 'error' });
	});

	it('refuses a picture larger than its limit', async () => {
		await expect(fetchImage('/large.png', 1024)).resolves.toEqual({ ok: false, reason: 'size' });
		await expect(fetchImage('/large.png')).resolves.toMatchObject({ ok: true, type: 'image/png' });
	});

	it('goes through the egress guard: a redirect inward is refused, and so is a private address', async () => {
		await expect(fetchImage('/inward')).resolves.toEqual({ ok: false, reason: 'blocked' });
		await expect(fetchPreviewImage('http://10.0.0.1/a.png')).resolves.toEqual({ ok: false, reason: 'blocked' });
		expect(requests).toEqual(['/inward']);
	});
});
