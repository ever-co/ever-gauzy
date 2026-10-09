import { createHmac, randomBytes } from 'crypto';
import { ForbiddenException } from '@nestjs/common';
import { ProbotDiscovery, IGithubWebhookRequest } from './probot.discovery';
import { verifyGithubWebhookSignature } from './webhook-signature';
import { ProbotConfig } from './probot.types';

/**
 * `POST /api/integration/github/webhook` is `@Public()`, runs outside any `RequestContext`, and its
 * handlers hard-delete a tenant's GitHub integration (`installation.deleted`) or create/overwrite
 * that tenant's Tasks and Tags (`issues.*`) purely on the strength of an `installation.id` in the
 * body. The HMAC signature is the only thing standing between the open internet and that, so these
 * tests pin the receiver's fail-closed behaviour (GHSA-mggh-g9p3-hwrm).
 *
 * `receiveHook` is exercised directly with a stub Probot rather than through the Nest module: the
 * decision it makes is entirely local, and building the module would drag in the whole entity graph.
 */
describe('ProbotDiscovery.receiveHook — GitHub webhook signature verification', () => {
	// Generated per run rather than written down: the value is irrelevant to what is tested, and a
	// literal high-entropy fixture is exactly what secret scanners are right to flag.
	const SECRET = randomBytes(24).toString('hex');

	/** A realistic `installation.deleted` delivery — the destructive one. */
	const rawBody = Buffer.from(JSON.stringify({ action: 'deleted', installation: { id: 42_000_001 } }), 'utf8');

	const signatureFor = (payload: Buffer, secret = SECRET): string =>
		`sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;

	/**
	 * Build a discovery instance with its Probot replaced by a recording stub.
	 *
	 * `probot` is private, so it is assigned through the instance — the alternative is booting the
	 * real Probot, which needs a GitHub App private key.
	 */
	const buildDiscovery = (config: Partial<ProbotConfig> = {}, withProbot = true) => {
		const receive = jest.fn().mockResolvedValue(undefined);
		const discovery = new ProbotDiscovery(
			{ getControllers: () => [], getProviders: () => [] } as any,
			{ getWebhookEvents: () => undefined } as any,
			{ getAllMethodNames: () => [] } as any,
			{
				appId: '1',
				privateKey: 'key',
				clientId: 'client',
				clientSecret: 'secret',
				webhookSecret: SECRET,
				...config
			} as ProbotConfig
		);
		if (withProbot) {
			(discovery as any).probot = { receive };
		}
		return { discovery, receive };
	};

	/**
	 * An incoming request as `receiveHook` receives it.
	 *
	 * `body` is what Express's JSON parser leaves on a real request next to `rawBody`. It is not part of
	 * {@link IGithubWebhookRequest}, but carrying it here is what lets a test tell "hashes the raw bytes"
	 * apart from "hashes a re-serialization of the parsed body".
	 */
	const request = (
		overrides: Partial<IGithubWebhookRequest> & { body?: unknown } = {}
	): IGithubWebhookRequest & { body?: unknown } => ({
		headers: {
			'x-github-delivery': 'd3adbeef-0000-4000-8000-000000000000',
			'x-github-event': 'installation',
			'x-hub-signature-256': signatureFor(rawBody)
		},
		rawBody,
		...overrides
	});

	it('accepts a correctly signed delivery and forwards the parsed payload to Probot', async () => {
		const { discovery, receive } = buildDiscovery();

		await expect(discovery.receiveHook(request())).resolves.toBeUndefined();

		expect(receive).toHaveBeenCalledTimes(1);
		expect(receive).toHaveBeenCalledWith({
			id: 'd3adbeef-0000-4000-8000-000000000000',
			name: 'installation',
			payload: { action: 'deleted', installation: { id: 42_000_001 } }
		});
	});

	it('refuses an UNSIGNED delivery — the advisory PoC — without dispatching anything', async () => {
		const { discovery, receive } = buildDiscovery();
		const unsigned = request();
		delete unsigned.headers['x-hub-signature-256'];

		await expect(discovery.receiveHook(unsigned)).rejects.toBeInstanceOf(ForbiddenException);
		expect(receive).not.toHaveBeenCalled();
	});

	it('refuses a delivery signed with the wrong secret', async () => {
		const { discovery, receive } = buildDiscovery();

		await expect(
			discovery.receiveHook(
				request({
					headers: {
						'x-github-delivery': 'id',
						'x-github-event': 'installation',
						'x-hub-signature-256': signatureFor(rawBody, 'not-the-secret')
					}
				})
			)
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(receive).not.toHaveBeenCalled();
	});

	it("refuses a delivery signed with Probot's default secret ('development')", async () => {
		// Guards the other half of the fix: `createProbot` used to pass `webhookSecret` where Probot
		// reads `secret`, so its internal webhooks instance was keyed with this public constant.
		const { discovery, receive } = buildDiscovery();

		await expect(
			discovery.receiveHook(
				request({
					headers: {
						'x-github-delivery': 'id',
						'x-github-event': 'installation',
						'x-hub-signature-256': signatureFor(rawBody, 'development')
					}
				})
			)
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(receive).not.toHaveBeenCalled();
	});

	it('refuses a tampered body carrying a signature minted for a different body', async () => {
		const { discovery, receive } = buildDiscovery();
		const tampered = Buffer.from(JSON.stringify({ action: 'deleted', installation: { id: 999 } }), 'utf8');

		await expect(discovery.receiveHook(request({ rawBody: tampered }))).rejects.toBeInstanceOf(ForbiddenException);
		expect(receive).not.toHaveBeenCalled();
	});

	describe('hashes the RAW bytes, never a re-serialization of the parsed body', () => {
		// GitHub signs the bytes it sent — here pretty-printed with its own key order, which
		// `JSON.stringify(request.body)` does not reproduce.
		const wireBytes = Buffer.from(
			JSON.stringify({ installation: { id: 42_000_001 }, action: 'deleted' }, null, 2),
			'utf8'
		);
		const parsedBody = JSON.parse(wireBytes.toString('utf8'));
		const headersSignedOver = (payload: Buffer) => ({
			'x-github-delivery': 'id',
			'x-github-event': 'installation',
			'x-hub-signature-256': signatureFor(payload)
		});

		it('accepts a signature over the exact wire bytes even though a re-serialization would differ', async () => {
			// Precondition that makes this test discriminating: the parsed body re-serializes differently.
			expect(Buffer.from(JSON.stringify(parsedBody), 'utf8').equals(wireBytes)).toBe(false);
			const { discovery, receive } = buildDiscovery();

			await expect(
				discovery.receiveHook(
					request({ rawBody: wireBytes, body: parsedBody, headers: headersSignedOver(wireBytes) })
				)
			).resolves.toBeUndefined();
			expect(receive).toHaveBeenCalledWith(expect.objectContaining({ payload: parsedBody }));
		});

		it('refuses a signature minted over the re-serialized parsed body', async () => {
			const { discovery, receive } = buildDiscovery();
			const reSerialized = Buffer.from(JSON.stringify(parsedBody), 'utf8');

			await expect(
				discovery.receiveHook(
					request({ rawBody: wireBytes, body: parsedBody, headers: headersSignedOver(reSerialized) })
				)
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(receive).not.toHaveBeenCalled();
		});
	});

	it('keys the HMAC with the configured secret VERBATIM, surrounding whitespace included', async () => {
		// GitHub signs with exactly what was entered in the App settings, and Probot is handed the same
		// untrimmed value; trimming it here would 403 every genuine delivery.
		const padded = ` ${SECRET}
`;
		const { discovery, receive } = buildDiscovery({ webhookSecret: padded });

		await expect(
			discovery.receiveHook(
				request({
					headers: {
						'x-github-delivery': 'id',
						'x-github-event': 'installation',
						'x-hub-signature-256': signatureFor(rawBody, padded)
					}
				})
			)
		).resolves.toBeUndefined();
		expect(receive).toHaveBeenCalledTimes(1);

		// ...and the trimmed value is therefore NOT the key.
		const { discovery: second, receive: secondReceive } = buildDiscovery({ webhookSecret: padded });
		await expect(second.receiveHook(request())).rejects.toBeInstanceOf(ForbiddenException);
		expect(secondReceive).not.toHaveBeenCalled();
	});

	it('refuses when the body parser stashed no raw body (non-JSON content type)', async () => {
		const { discovery, receive } = buildDiscovery();

		await expect(discovery.receiveHook(request({ rawBody: undefined }))).rejects.toBeInstanceOf(ForbiddenException);
		expect(receive).not.toHaveBeenCalled();
	});

	it('refuses when the delivery id or event name is missing', async () => {
		const { discovery, receive } = buildDiscovery();
		const noEvent = request();
		delete noEvent.headers['x-github-event'];

		await expect(discovery.receiveHook(noEvent)).rejects.toBeInstanceOf(ForbiddenException);
		expect(receive).not.toHaveBeenCalled();
	});

	it('refuses every delivery when no webhook secret is configured, rather than accepting them', async () => {
		const { discovery, receive } = buildDiscovery({ webhookSecret: '   ' });

		// Correctly signed for the EMPTY secret: still refused, because an unconfigured receiver has
		// nothing to authenticate against.
		await expect(
			discovery.receiveHook(
				request({
					headers: {
						'x-github-delivery': 'id',
						'x-github-event': 'installation',
						'x-hub-signature-256': signatureFor(rawBody, '')
					}
				})
			)
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(receive).not.toHaveBeenCalled();
	});

	it('refuses when Probot never initialised (no appId/privateKey) instead of silently answering 2xx', async () => {
		const { discovery } = buildDiscovery({}, false);

		await expect(discovery.receiveHook(request())).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('refuses a correctly signed body that is not JSON', async () => {
		const { discovery, receive } = buildDiscovery();
		const notJson = Buffer.from('payload=%7B%22action%22%3A%22deleted%22%7D', 'utf8');

		await expect(
			discovery.receiveHook(
				request({
					rawBody: notJson,
					headers: {
						'x-github-delivery': 'id',
						'x-github-event': 'installation',
						'x-hub-signature-256': signatureFor(notJson)
					}
				})
			)
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(receive).not.toHaveBeenCalled();
	});
});

describe('verifyGithubWebhookSignature', () => {
	const SECRET = randomBytes(16).toString('hex');
	const payload = Buffer.from('{"a":1}', 'utf8');
	const expected = createHmac('sha256', SECRET).update(payload).digest('hex');

	it('accepts a well-formed sha256= signature, in either hex case', () => {
		expect(verifyGithubWebhookSignature(payload, `sha256=${expected}`, SECRET)).toBe(true);
		expect(verifyGithubWebhookSignature(payload, `sha256=${expected.toUpperCase()}`, SECRET)).toBe(true);
	});

	it('rejects the sha1 scheme, a bare digest and a truncated digest', () => {
		expect(verifyGithubWebhookSignature(payload, `sha1=${expected}`, SECRET)).toBe(false);
		expect(verifyGithubWebhookSignature(payload, expected, SECRET)).toBe(false);
		expect(verifyGithubWebhookSignature(payload, `sha256=${expected.slice(0, 32)}`, SECRET)).toBe(false);
	});

	it('rejects an empty secret, an empty header and an empty payload', () => {
		expect(verifyGithubWebhookSignature(payload, `sha256=${expected}`, '')).toBe(false);
		expect(verifyGithubWebhookSignature(payload, '', SECRET)).toBe(false);
		expect(verifyGithubWebhookSignature(Buffer.alloc(0), `sha256=${expected}`, SECRET)).toBe(false);
	});

	it('rejects a non-hex digest of the right length rather than throwing', () => {
		expect(verifyGithubWebhookSignature(payload, `sha256=${'z'.repeat(64)}`, SECRET)).toBe(false);
	});
});
