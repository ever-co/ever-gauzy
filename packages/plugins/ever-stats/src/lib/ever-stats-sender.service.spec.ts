import { createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo, Socket } from 'node:net';
import { statsKeyId } from '@ever-co/connect-sdk';
import { EverStatsSender, readCappedBody } from './ever-stats-sender.service';
import { contractsFile } from './fixtures/contracts-file';

/** A report Ever Platform accepts: the golden of the SDK's contracts package, as its bytes. */
const GOLDEN = readFileSync(contractsFile('fixtures', 'stats', 'valid', 'gauzy.json'));

/** A statistics signer over a throwaway key, as `EverInstanceService.statsSigner()` returns it. */
function testSigner() {
	const { publicKey, privateKey } = generateKeyPairSync('ed25519');
	const x = publicKey.export({ format: 'jwk' }).x as string;
	return { publicKey: x, keyId: statsKeyId(x), sign: (bytes: Uint8Array) => sign(null, bytes, privateKey), dispose: () => undefined };
}

interface Seen {
	method: string;
	url: string;
	headers: IncomingMessage['headers'];
	body: Buffer;
}

describe('EverStatsSender', () => {
	let server: Server;
	let base: string;
	let reply: (req: IncomingMessage, res: ServerResponse) => void;
	const seen: Seen[] = [];
	const sockets = new Set<Socket>();

	beforeAll(async () => {
		server = createServer((req, res) => {
			const chunks: Buffer[] = [];
			req.on('data', (c) => chunks.push(c));
			req.on('end', () => {
				seen.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body: Buffer.concat(chunks) });
				reply(req, res);
			});
		});
		server.on('connection', (s) => {
			sockets.add(s);
			s.on('close', () => sockets.delete(s));
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	});

	afterAll(async () => {
		sockets.forEach((s) => s.destroy());
		await new Promise((resolve) => server.close(resolve));
	});

	beforeEach(() => {
		seen.length = 0;
	});

	const answer = (status: number, body?: unknown, headers: Record<string, string> = {}) => (_req: IncomingMessage, res: ServerResponse) => {
		res.writeHead(status, { 'content-type': 'application/problem+json', ...headers });
		res.end(body === undefined ? '' : JSON.stringify(body));
	};

	it('posts exactly the bytes, signed over those bytes, with the statistics key and nothing else', async () => {
		reply = answer(202, { accepted: true });
		const signer = testSigner();
		const bytes = GOLDEN;
		const outcome = await new EverStatsSender().send(base, bytes, signer, '111.47.0');
		expect(outcome).toEqual({ kind: 'accepted', status: 202 });
		expect(seen).toHaveLength(1);
		const [request] = seen;
		expect(request.method).toBe('POST');
		expect(request.url).toBe('/v1/stats/reports');
		expect(request.body.equals(bytes)).toBe(true);
		expect(request.headers['content-type']).toBe('application/json');
		expect(request.headers['ever-stats-key']).toBe(signer.publicKey);
		expect(request.headers['ever-stats-key-id']).toBe(signer.keyId);
		expect(request.headers['user-agent']).toBe('gauzy-ever-stats/0.1.0 (gauzy/111.47.0)');
		expect(request.headers['authorization']).toBeUndefined();
		expect(request.headers['cookie']).toBeUndefined();
		const signature = String(request.headers['ever-stats-signature']);
		expect(signature).toMatch(/^ed25519=[A-Za-z0-9_-]{86}$/);
		const key = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: signer.publicKey }, format: 'jwk' });
		expect(verify(null, request.body, key, Buffer.from(signature.slice('ed25519='.length), 'base64url'))).toBe(true);
	});

	it.each([
		[422, { code: 'schema_violation', errors: [{ path: '/counts/acme corp', code: 'unknown_field' }] }, 'dropped', 'http_422:schema_violation:/counts/*:unknown_field'],
		[409, { code: 'key_mismatch' }, 'reset_identity', 'http_409:key_mismatch'],
		[429, { code: 'rate_limited' }, 'retry', 'http_429:rate_limited'],
		[503, { code: 'database_unreachable' }, 'retry', 'http_503:database_unreachable'],
		[404, { code: 'not_found' }, 'later', 'http_404:not_found'],
		[400, { code: 'signature_invalid' }, 'dropped', 'http_400:signature_invalid'],
		[301, undefined, 'later', 'http_301']
	])('maps %i to %s, recording only codes and field names', async (status, body, kind, error) => {
		reply = answer(status as number, body, status === 301 ? { location: 'http://127.0.0.1:9/elsewhere' } : {});
		const outcome = await new EverStatsSender().send(base, GOLDEN, testSigner(), '1.0.0');
		expect(outcome.kind).toBe(kind);
		expect((outcome as { error?: string }).error).toBe(error);
		expect(seen).toHaveLength(1);
	});

	it('honours Retry-After on 429', async () => {
		reply = answer(429, { code: 'rate_limited' }, { 'retry-after': '120' });
		const outcome = await new EverStatsSender().send(base, GOLDEN, testSigner(), '1.0.0');
		expect(outcome).toMatchObject({ kind: 'retry', status: 429, retryAfterS: 120 });
	});

	it('retries on a reset connection', async () => {
		reply = (req) => req.socket.destroy();
		const outcome = await new EverStatsSender().send(base, GOLDEN, testSigner(), '1.0.0');
		expect(outcome).toEqual({ kind: 'retry', status: null, error: 'connection_error', retryAfterS: 0 });
	});

	it('reads at most 64 KiB of an answer, whatever the endpoint streams', async () => {
		reply = (_req, res) => {
			res.writeHead(422, { 'content-type': 'application/json' });
			// About 1 MiB without a content-length: the reader must stop on its own.
			for (let i = 0; i < 64; i += 1) res.write(Buffer.alloc(16 * 1024, 32));
			res.end('{"code":"schema_violation"}');
		};
		const outcome = await new EverStatsSender().send(base, GOLDEN, testSigner(), '1.0.0');
		expect(outcome).toEqual({ kind: 'dropped', status: 422, error: 'http_422' });

		let pulled = 0;
		const endless = new ReadableStream<Uint8Array>({
			pull(controller) {
				pulled += 1;
				controller.enqueue(new Uint8Array(16 * 1024));
			}
		});
		expect(await readCappedBody(new Response(endless))).toBeNull();
		expect(pulled).toBeLessThan(10);
		expect(await readCappedBody(new Response('x'.repeat(10), { headers: { 'content-length': String(10 * 1024 * 1024) } }))).toBeNull();
		expect(await readCappedBody(new Response('{"code":"ok"}'))).toBe('{"code":"ok"}');
	});

	it('never sends a report Ever Platform would refuse (the SDK signs only what its checks accept)', async () => {
		reply = answer(202, { accepted: true });
		const outcome = await new EverStatsSender().send(base, Buffer.from('{"schema":"ever.stats.v1","a":1}'), testSigner(), '1.0.0');
		expect(outcome).toMatchObject({ kind: 'dropped', status: 422 });
		expect(seen).toHaveLength(0);
	});

	it('never sends more than 16 KiB', async () => {
		reply = answer(202, { accepted: true });
		const outcome = await new EverStatsSender().send(base, Buffer.alloc(16 * 1024 + 1, 32), testSigner(), '1.0.0');
		expect(outcome.kind).toBe('dropped');
		expect(seen).toHaveLength(0);
	});
});
