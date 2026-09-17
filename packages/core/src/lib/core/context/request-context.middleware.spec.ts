import { AsyncLocalStorage } from 'async_hooks';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContext } from './request-context';

/**
 * TASK 9 (improvement roadmap) — Unified Observability and Correlation IDs.
 *
 * Proves the two behaviors the roadmap's "propagate a correlation id across API requests... and
 * logs" actually depends on: an inbound `x-correlation-id` header is trusted (not overwritten), a
 * missing one gets a generated id instead, and — the one genuinely NEW behavior added here — that
 * id is always echoed back on the response, so a caller that did NOT send its own id can still
 * learn the one the server used to correlate its own logs/support requests against server-side
 * ones. Also proves the log/header-injection guard: an inbound value is only trusted when it matches
 * a safe, bounded character set — anything else (a literal `\n`, an oversized value) is treated as
 * absent instead of being echoed/logged verbatim.
 */
describe('RequestContextMiddleware — correlation id propagation', () => {
	const originalClsService = RequestContext['clsService'];

	// A real `AsyncLocalStorage`-backed double, not one shared `Map` that `run()` never actually
	// scopes: the real `ClsService` gives each `run()` call its
	// own store, so `get()` outside of any `run()` — including AFTER one has returned — sees
	// nothing, exactly like a queue worker thread that never had a `RequestContext` at all. A
	// bare shared `Map` would keep "leaking" the last request's values there too, silently masking
	// the exact class of bug (`RequestContext` state bleeding across requests) this middleware
	// exists to prevent.
	function buildClsService() {
		const als = new AsyncLocalStorage<Map<string, unknown>>();
		return {
			run: (callback: () => void) => als.run(new Map<string, unknown>(), callback),
			set: (key: string, value: unknown) => als.getStore()?.set(key, value),
			get: (key: string) => als.getStore()?.get(key)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any;
	}

	function buildReqRes(headers: Record<string, string> = {}) {
		const responseHeaders: Record<string, string> = {};
		const req = {
			headers,
			method: 'GET',
			protocol: 'http',
			originalUrl: '/api/employee',
			get: () => 'localhost'
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any;
		const res = {
			statusCode: 200,
			end: jest.fn(),
			setHeader: (name: string, value: string) => {
				responseHeaders[name] = value;
			}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any;
		return { req, res, responseHeaders };
	}

	afterEach(() => {
		RequestContext['clsService'] = originalClsService;
	});

	it('trusts an inbound x-correlation-id header and echoes the SAME value back on the response', () => {
		const cls = buildClsService();
		RequestContext.setClsService(cls);
		const middleware = new RequestContextMiddleware(cls);
		const { req, res, responseHeaders } = buildReqRes({ 'x-correlation-id': 'from-caller-123' });
		// With a real AsyncLocalStorage-backed `cls` (see `buildClsService`), the store is only
		// live for code running INSIDE `clsService.run()`'s continuation — the same place the real
		// downstream route handler would read it — not after `middleware.use()` has returned to this
		// test. Assert it from inside `next()`, exactly where `next()`'s real caller (Nest's router)
		// would.
		const next = jest.fn(() => {
			expect(RequestContext.currentCorrelationId()).toBe('from-caller-123');
		});

		middleware.use(req, res, next);

		expect(responseHeaders['x-correlation-id']).toBe('from-caller-123');
		expect(next).toHaveBeenCalledTimes(1);
	});

	it('generates a correlation id when none is provided, and echoes THAT one back', () => {
		const cls = buildClsService();
		RequestContext.setClsService(cls);
		const middleware = new RequestContextMiddleware(cls);
		const { req, res, responseHeaders } = buildReqRes({});
		let seenDuringRequest: unknown;

		middleware.use(req, res, () => {
			seenDuringRequest = RequestContext.currentCorrelationId();
		});

		const generated = responseHeaders['x-correlation-id'];
		expect(generated).toBeTruthy();
		// uuidv4 shape — proves it wasn't left as the literal `undefined`/an empty string.
		expect(generated).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
		expect(seenDuringRequest).toBe(generated);
	});

	it('gives two requests with no inbound header two DIFFERENT correlation ids', () => {
		const cls = buildClsService();
		RequestContext.setClsService(cls);
		const middleware = new RequestContextMiddleware(cls);

		const first = buildReqRes({});
		middleware.use(first.req, first.res, jest.fn());
		const second = buildReqRes({});
		middleware.use(second.req, second.res, jest.fn());

		expect(first.responseHeaders['x-correlation-id']).not.toBe(second.responseHeaders['x-correlation-id']);
	});

	it('rejects an inbound value containing a newline (log/header-injection attempt) and generates one instead', () => {
		const cls = buildClsService();
		RequestContext.setClsService(cls);
		const middleware = new RequestContextMiddleware(cls);
		const { req, res, responseHeaders } = buildReqRes({
			'x-correlation-id': 'legit-looking\r\nX-Injected-Header: evil'
		});

		middleware.use(req, res, jest.fn());

		expect(responseHeaders['x-correlation-id']).not.toContain('\r');
		expect(responseHeaders['x-correlation-id']).not.toContain('\n');
		expect(responseHeaders['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/i);
	});

	it('rejects an oversized inbound value and generates one instead', () => {
		const cls = buildClsService();
		RequestContext.setClsService(cls);
		const middleware = new RequestContextMiddleware(cls);
		const { req, res, responseHeaders } = buildReqRes({ 'x-correlation-id': 'a'.repeat(200) });

		middleware.use(req, res, jest.fn());

		expect(responseHeaders['x-correlation-id']).toHaveLength(36); // a generated uuidv4, not the 200-char input
	});

	it('still accepts a plain, safely-shaped inbound value (not overly strict)', () => {
		const cls = buildClsService();
		RequestContext.setClsService(cls);
		const middleware = new RequestContextMiddleware(cls);
		const { req, res, responseHeaders } = buildReqRes({ 'x-correlation-id': 'load-balancer-req-id_123' });

		middleware.use(req, res, jest.fn());

		expect(responseHeaders['x-correlation-id']).toBe('load-balancer-req-id_123');
	});

	it.each(['svc:orders.42', '{3F2504E0-4F89-11D3-9A0C-0305E82C3301}', 'YWJjZGVm+/==', 'uuid#7'])(
		'keeps upstream ids with visible punctuation (%s)',
		(inbound) => {
			const cls = buildClsService();
			RequestContext.setClsService(cls);
			const middleware = new RequestContextMiddleware(cls);
			const { req, res, responseHeaders } = buildReqRes({ 'x-correlation-id': inbound });

			middleware.use(req, res, jest.fn());

			expect(responseHeaders['x-correlation-id']).toBe(inbound);
		}
	);

	it('still replaces ids containing a space or tab', () => {
		const cls = buildClsService();
		RequestContext.setClsService(cls);
		const middleware = new RequestContextMiddleware(cls);
		const { req, res, responseHeaders } = buildReqRes({ 'x-correlation-id': 'a b	c' });

		middleware.use(req, res, jest.fn());

		expect(responseHeaders['x-correlation-id']).toHaveLength(36);
	});

	it("does not leak the correlation id outside the request's own run() scope", () => {
		const cls = buildClsService();
		RequestContext.setClsService(cls);
		const middleware = new RequestContextMiddleware(cls);
		const { req, res } = buildReqRes({ 'x-correlation-id': 'request-1-id' });

		middleware.use(req, res, jest.fn());
		// `use()`'s `next()` runs synchronously inside `clsService.run()` here, so by the time
		// `use()` returns, that AsyncLocalStorage scope has already exited — the same state a queue
		// worker thread (never inside any `run()` at all) would see.
		expect(RequestContext.currentCorrelationId()).toBeNull();
	});
});
