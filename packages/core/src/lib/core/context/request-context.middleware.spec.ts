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
 * ones.
 */
describe('RequestContextMiddleware — correlation id propagation', () => {
	const originalClsService = RequestContext['clsService'];

	function buildClsService() {
		const store = new Map<string, unknown>();
		return {
			run: (callback: () => void) => callback(),
			set: (key: string, value: unknown) => store.set(key, value),
			get: (key: string) => store.get(key)
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
		const next = jest.fn();

		middleware.use(req, res, next);

		expect(responseHeaders['x-correlation-id']).toBe('from-caller-123');
		expect(RequestContext.currentCorrelationId()).toBe('from-caller-123');
		expect(next).toHaveBeenCalledTimes(1);
	});

	it('generates a correlation id when none is provided, and echoes THAT one back', () => {
		const cls = buildClsService();
		RequestContext.setClsService(cls);
		const middleware = new RequestContextMiddleware(cls);
		const { req, res, responseHeaders } = buildReqRes({});

		middleware.use(req, res, jest.fn());

		const generated = responseHeaders['x-correlation-id'];
		expect(generated).toBeTruthy();
		// uuidv4 shape — proves it wasn't left as the literal `undefined`/an empty string.
		expect(generated).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
		expect(RequestContext.currentCorrelationId()).toBe(generated);
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
});
