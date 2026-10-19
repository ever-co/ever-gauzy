import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, throwError } from 'rxjs';

const captureException = jest.fn();
let resolvedSettings: Record<string, unknown> | undefined;

jest.mock('@sentry/node', () => ({ captureException: (...args: unknown[]) => captureException(...args) }));
jest.mock('@sentry/core', () => ({ httpRequestToRequestData: jest.fn() }));
// The interceptor and SentryService read the current request's tenant settings from @gauzy/core.
jest.mock('@gauzy/core', () => ({
	RequestContext: { currentRequest: () => (resolvedSettings ? { resolvedSettings } : undefined) }
}));

import { SentryCustomInterceptor } from './sentry-custom.interceptor';

/**
 * The custom interceptor captures exceptions itself, bypassing `SentryService.isEnabled`: once its empty filter
 * list let everything through, a tenant that turned Sentry off (`sentryEnabled: false`) still had its errors sent.
 */
describe('SentryCustomInterceptor and the tenant switch', () => {
	const fail = async () => {
		const interceptor = new SentryCustomInterceptor();
		const next: CallHandler = { handle: () => throwError(() => new Error('boom')) };
		await expect(lastValueFrom(interceptor.intercept({} as ExecutionContext, next))).rejects.toThrow('boom');
	};

	beforeAll(() => {
		// The interceptor creates a SentryService without options, which only prints a hint.
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => {
		captureException.mockClear();
		resolvedSettings = undefined;
	});

	afterAll(() => jest.restoreAllMocks());

	it.each([false, 'false'])('sends nothing for a tenant with sentryEnabled = %p', async (sentryEnabled) => {
		resolvedSettings = { sentryEnabled };
		await fail();
		expect(captureException).not.toHaveBeenCalled();
	});

	it.each([true, 'true'])('reports for a tenant with sentryEnabled = %p', async (sentryEnabled) => {
		resolvedSettings = { sentryEnabled };
		await fail();
		expect(captureException).toHaveBeenCalledTimes(1);
	});

	it('reports when the tenant has no setting', async () => {
		await fail();
		expect(captureException).toHaveBeenCalledTimes(1);
	});
});
