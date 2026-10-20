import { HttpException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { SentryInterceptor } from './sentry.interceptor';
import { SentryInterceptorOptions } from './sentry.interfaces';

jest.mock('@sentry/node', () => ({}));
jest.mock('@sentry/core', () => ({ httpRequestToRequestData: jest.fn() }));
// SentryService only reads the current request's tenant settings from @gauzy/core.
jest.mock('@gauzy/core', () => ({ RequestContext: { currentRequest: () => undefined } }));

class EntityNotFoundError extends Error {}

const shouldReport = (options: SentryInterceptorOptions | undefined, exception: any): boolean =>
	(new SentryInterceptor(options) as any).shouldReport(exception);

describe('SentryInterceptor.shouldReport', () => {
	beforeAll(() => {
		// The interceptor creates a SentryService without options, which only prints a hint.
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterAll(() => jest.restoreAllMocks());

	it('reports everything without options or filters', () => {
		expect(shouldReport(undefined, new Error('boom'))).toBe(true);
		expect(shouldReport({}, new Error('boom'))).toBe(true);
	});

	it('reports everything with an empty filter list (what SentryCustomInterceptor passes)', () => {
		expect(shouldReport({ filters: [] }, new Error('boom'))).toBe(true);
		expect(shouldReport({ filters: [] }, new InternalServerErrorException())).toBe(true);
	});

	describe('with several filters', () => {
		const options: SentryInterceptorOptions = {
			filters: [
				{ type: HttpException, filter: (e: HttpException) => e.getStatus() < 500 },
				{ type: EntityNotFoundError }
			]
		};

		it('skips an exception matched by a type-only filter', () => {
			expect(shouldReport(options, new EntityNotFoundError())).toBe(false);
		});

		it('skips an exception matched by a type + predicate filter', () => {
			expect(shouldReport(options, new NotFoundException())).toBe(false);
		});

		it('reports an exception whose predicate does not match', () => {
			expect(shouldReport(options, new InternalServerErrorException())).toBe(true);
		});

		it('reports an exception of an unfiltered type', () => {
			expect(shouldReport(options, new TypeError('boom'))).toBe(true);
		});
	});
});
