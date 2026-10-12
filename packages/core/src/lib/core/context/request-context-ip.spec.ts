import { environment } from '@gauzy/config';
import { RequestContext } from './request-context';

/**
 * GHSA-86mw-2crg-vmhc — `currentIp()` used to return the LEFTMOST `X-Forwarded-For` entry, the one
 * the client itself appends, so the address written into every access token (and from there into the
 * sign-in audit trail) was whatever the caller claimed. It now resolves the client the same way the
 * rate limiter does.
 */
describe('RequestContext.currentIp (GHSA-86mw-2crg-vmhc)', () => {
	const originalTrustCf = environment.THROTTLE_TRUST_CF_CONNECTING_IP;

	/** The pre-fix implementation, kept verbatim as the control arm. */
	function legacyCurrentIp(req: any): string {
		return (
			(req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
			req.connection?.remoteAddress ||
			req.socket?.remoteAddress ||
			'unknown-ip'
		);
	}

	/** Installs a request context around one request-shaped object. */
	function setContext(req: any): void {
		const store = new Map<string, unknown>();
		RequestContext.setClsService({
			get: (key: string) => store.get(key),
			set: (key: string, value: unknown) => store.set(key, value)
		} as any);
		store.set(RequestContext.name, new RequestContext({ req: req as any }));
	}

	/** A request as Express presents it: `ip` comes from the socket and `trust proxy`, headers do not. */
	const request = (
		ip: string | undefined,
		headers: Record<string, unknown> = {},
		remoteAddress = '203.0.113.10'
	) => ({
		ip,
		headers,
		socket: { remoteAddress },
		connection: { remoteAddress }
	});

	beforeEach(() => {
		environment.THROTTLE_TRUST_CF_CONNECTING_IP = false;
	});

	afterEach(() => {
		environment.THROTTLE_TRUST_CF_CONNECTING_IP = originalTrustCf;
		RequestContext.setClsService(undefined as any);
	});

	it('records the address Express resolved, not the one the client wrote', () => {
		const req = request('203.0.113.10', { 'x-forwarded-for': '198.51.100.7, 203.0.113.10' });

		// CONTROL: the pre-fix reader returned the client's own header value.
		expect(legacyCurrentIp(req)).toBe('198.51.100.7');

		setContext(req);
		expect(RequestContext.currentIp()).toBe('203.0.113.10');
	});

	it('cannot be varied per request by rotating headers', () => {
		const seen = new Set<string>();

		for (let attempt = 0; attempt < 10; attempt++) {
			const req = request('203.0.113.10', {
				'x-forwarded-for': `198.51.100.${attempt}`,
				'cf-connecting-ip': `192.0.2.${attempt}`
			});
			setContext(req);
			seen.add(RequestContext.currentIp());
		}

		expect(seen).toEqual(new Set(['203.0.113.10']));
	});

	it('believes CF-Connecting-IP only where the deployment declares it is behind Cloudflare', () => {
		const req = request('203.0.113.10', { 'cf-connecting-ip': '198.51.100.7' });

		setContext(req);
		expect(RequestContext.currentIp()).toBe('203.0.113.10');

		environment.THROTTLE_TRUST_CF_CONNECTING_IP = true;
		setContext(req);
		expect(RequestContext.currentIp()).toBe('198.51.100.7');
	});

	it('falls back to the socket peer when no address can be attributed', () => {
		setContext(request(undefined, { 'x-forwarded-for': 'not-an-ip' }));
		expect(RequestContext.currentIp()).toBe('203.0.113.10');
	});

	it('still returns unknown-ip without a request context', () => {
		RequestContext.setClsService(undefined as any);
		expect(RequestContext.currentIp()).toBe('unknown-ip');
	});
});
