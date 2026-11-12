import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import { isPublicAddress } from './egress-address';
import { EgressBlockedError, EgressEncodingError, guardedRequest, IEgressPolicy, pinnedLookup, readLimitedBody, resolveAllowedAddresses } from './egress-guard';

/**
 * The reusable half of the guard, as a caller other than the link previews uses it (an integration's callback: a POST
 * with a body, one hop, a small answer). The server on the loopback interface stands in for a public host: the policy
 * lets that one address and port through, and keeps the real rule for every other address.
 */

const LOOPBACK = '127.0.0.1';
let server: Server;
let port = 0;
const sockets = new Set<Socket>();
let received: Array<{ method?: string; path?: string; body: string }> = [];

function route(request: IncomingMessage, response: ServerResponse): void {
	const chunks: Buffer[] = [];
	request.on('data', (chunk: Buffer) => chunks.push(chunk));
	request.on('end', () => {
		received.push({ method: request.method, path: request.url, body: Buffer.concat(chunks).toString() });
		if (request.url === '/redirect') {
			response.writeHead(302, { location: 'http://10.0.0.1/' });
			response.end();
		} else if (request.url === '/odd-encoding') {
			response.writeHead(200, { 'content-encoding': 'compress' });
			response.end('x');
		} else if (request.url === '/hang') {
			// Never answers.
		} else {
			response.writeHead(200, { 'content-type': 'application/json' });
			response.end(JSON.stringify({ ok: true, padding: 'p'.repeat(4096) }));
		}
	});
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
	received = [];
});

const policy = (): IEgressPolicy => ({
	isAllowedAddress: (address) => address === LOOPBACK || isPublicAddress(address),
	allowedPorts: [port],
	allowedProtocols: ['http:']
});
const resolver = jest.fn(async (hostname: string) => (hostname === 'hooks.example.com' ? [LOOPBACK] : hostname === 'inside.example.com' ? ['10.9.8.7'] : []));

describe('guardedRequest', () => {
	it('sends a POST with its body to the judged address, and the answer reads within its limit', async () => {
		resolver.mockClear();
		const response = await guardedRequest(new URL(`http://hooks.example.com:${port}/callback?x=1`), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{"action":"approve"}',
			resolver,
			policy: policy()
		});
		expect(response.statusCode).toBe(200);
		const body = await readLimitedBody(response, { maxBytes: 64 });
		expect(body.length).toBe(64);
		expect(received).toEqual([{ method: 'POST', path: '/callback?x=1', body: '{"action":"approve"}' }]);
		expect(resolver).toHaveBeenCalledTimes(1);
	});

	it('answers a redirect as it is: never follows it', async () => {
		const response = await guardedRequest(new URL(`http://hooks.example.com:${port}/redirect`), { resolver, policy: policy() });
		expect(response.statusCode).toBe(302);
		expect(response.headers.location).toBe('http://10.0.0.1/');
		response.destroy();
		expect(received).toHaveLength(1);
	});

	it('refuses a private target before connecting, naming why but no address', async () => {
		for (const [link, reason] of [
			[`http://10.0.0.1:${port}/`, 'address'],
			[`http://inside.example.com:${port}/`, 'address'],
			[`http://localhost:${port}/`, 'hostname'],
			[`https://hooks.example.com:${port}/`, 'scheme'],
			[`http://hooks.example.com:${port + 1}/`, 'port'],
			[`http://user:pass@hooks.example.com:${port}/`, 'credentials']
		] as const) {
			const refused = guardedRequest(new URL(link), { resolver, policy: policy() });
			await expect(refused).rejects.toBeInstanceOf(EgressBlockedError);
			await expect(refused).rejects.toMatchObject({ reason });
			await expect(refused).rejects.not.toThrow(/10\.0\.0\.1|10\.9\.8\.7|inside/);
		}
		expect(received).toEqual([]);
	});

	it('gives up when the caller aborts', async () => {
		const controller = new AbortController();
		const pending = guardedRequest(new URL(`http://hooks.example.com:${port}/hang`), { resolver, policy: policy(), signal: controller.signal });
		setTimeout(() => controller.abort(), 100);
		await expect(pending).rejects.toThrow();
	});
});

describe('the guard pieces', () => {
	it('refuses a host with no address, and one whose answer is not an address', async () => {
		await expect(resolveAllowedAddresses(new URL(`http://nowhere.example.com:${port}/`), { resolver, policy: policy() })).rejects.toMatchObject({ code: 'ENOTFOUND' });
		await expect(
			resolveAllowedAddresses(new URL(`http://odd.example.com:${port}/`), { resolver: async () => ['not-an-address'], policy: policy() })
		).rejects.toBeInstanceOf(EgressBlockedError);
	});

	it('answers only the pinned addresses, of the family asked for', async () => {
		const lookup = pinnedLookup([
			{ address: '93.184.215.14', family: 4 },
			{ address: '2606:4700:4700::1111', family: 6 }
		]);
		const ask = (options: object) =>
			new Promise<unknown[]>((resolve) => lookup('anything.example.com', options as never, (...args: unknown[]) => resolve(args)));
		await expect(ask({ family: 6 })).resolves.toEqual([null, '2606:4700:4700::1111', 6]);
		await expect(ask({ all: true })).resolves.toEqual([null, [{ address: '93.184.215.14', family: 4 }, { address: '2606:4700:4700::1111', family: 6 }]]);
		const only4 = pinnedLookup([{ address: '93.184.215.14', family: 4 }]);
		const [error] = await new Promise<unknown[]>((resolve) => only4('x', { family: 6 } as never, (...args: unknown[]) => resolve(args)));
		expect(error).toMatchObject({ code: 'ENOTFOUND' });
	});

	it('refuses to read an encoding it does not know', async () => {
		const response = await guardedRequest(new URL(`http://hooks.example.com:${port}/odd-encoding`), { resolver, policy: policy() });
		await expect(readLimitedBody(response, { maxBytes: 1024 })).rejects.toBeInstanceOf(EgressEncodingError);
	});
});
