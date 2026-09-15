import { RequestContext } from './request-context';

/**
 * TASK 9 (improvement roadmap) — Unified Observability and Correlation IDs.
 *
 * `currentCorrelationId()` is a thin, better-named wrapper over the EXISTING `getContextId()`/
 * `setContextId()` machinery (already populated by `RequestContextMiddleware` — see
 * `request-context.middleware.spec.ts` for that side), so this asserts they really are the same
 * value, not just structurally similar.
 */
describe('RequestContext.currentCorrelationId', () => {
	const originalClsService = RequestContext['clsService'];
	const store = new Map<string, unknown>();

	beforeEach(() => {
		store.clear();
		RequestContext['clsService'] = {
			get: (key: string) => store.get(key),
			set: (key: string, value: unknown) => store.set(key, value)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any;
	});

	afterEach(() => {
		RequestContext['clsService'] = originalClsService;
	});

	it('returns null when no request context has been established', () => {
		expect(RequestContext.currentCorrelationId()).toBeNull();
	});

	it('returns the id a RequestContext was constructed with, identically to getContextId()', () => {
		new RequestContext({ id: 'correlation-abc' });

		expect(RequestContext.currentCorrelationId()).toBe('correlation-abc');
		expect(RequestContext.currentCorrelationId()).toBe(RequestContext.getContextId());
	});

	it('reflects a later setContextId() call (both accessors read the same underlying store)', () => {
		RequestContext.setContextId('correlation-xyz');

		expect(RequestContext.currentCorrelationId()).toBe('correlation-xyz');
	});
});
