import { BadRequestException, ExecutionContext, InternalServerErrorException } from '@nestjs/common';

jest.mock('@sentry/node', () => ({}));
// The interceptors and SentryService read the current request's tenant settings from @gauzy/core.
jest.mock('@gauzy/core', () => ({ RequestContext: { currentRequest: () => undefined } }));
// The GraphQL interceptor reads the operation's context through `GqlExecutionContext`.
jest.mock('@nestjs/graphql', () => ({ GqlExecutionContext: { create: (context: any) => context.gql } }), {
	virtual: true
});

import { GraphqlInterceptor, SentryInterceptor } from './ntegral';
import { SENTRY_INTERCEPTOR_OPTIONS } from './sentry-custom.interceptor';
import { redactedRequestOf, sentryUserOf } from './sentry-request-redaction';

/**
 * The interceptors attached the request to every reported error as it was — the bearer token, the cookies,
 * `X-API-KEY` and (over GraphQL) the body — and the whole `User` row, password hash, refresh token and pending
 * sign-in code included, past the redaction the request middleware applies and the `dataCollection` baseline
 * `SentryService` sets. The GraphQL interceptor, registered with no filter, did so for every client error too.
 */
describe('what an error event carries', () => {
	const user = {
		id: 'user-1',
		email: 'ada@example.com',
		hash: '$2b$12$hash',
		refreshToken: 'refresh-1',
		emailToken: 'email-token-1',
		code: '12345678'
	};
	const request = {
		method: 'POST',
		url: '/api/auth/signin.email/confirm?token=t-1&page=2',
		headers: {
			authorization: 'Bearer jwt-1',
			cookie: 'session=s-1',
			'x-api-key': 'key-1',
			'content-type': 'application/json'
		},
		query: { token: 't-1', page: '2' },
		body: { email: 'ada@example.com', password: 'secret-1', code: '12345678' },
		user
	};
	const leaks = (value: unknown) =>
		['jwt-1', 's-1', 'key-1', 't-1', 'secret-1', '12345678', '$2b$12$hash', 'refresh-1', 'email-token-1'].filter(
			(secret) => JSON.stringify(value).includes(secret)
		);

	beforeAll(() => {
		// The interceptors create a SentryService without options, which only prints a hint.
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterAll(() => jest.restoreAllMocks());

	it('describes the request without its credentials or its body', () => {
		const described = redactedRequestOf(request);

		expect(described).toEqual({
			method: 'POST',
			url: '/api/auth/signin.email/confirm?token=%5BFiltered%5D&page=2',
			headers: {
				authorization: '[Filtered]',
				cookie: '[Filtered]',
				'x-api-key': '[Filtered]',
				'content-type': 'application/json'
			},
			query: { token: '[Filtered]', page: '2' }
		});
		expect(leaks(described)).toEqual([]);
	});

	it('names the user by id alone', () => {
		expect(sentryUserOf(user)).toEqual({ id: 'user-1' });
		expect(sentryUserOf(undefined)).toBeNull();
	});

	describe.each([
		[
			'an HTTP route',
			() => new SentryInterceptor(),
			{ getType: () => 'http', switchToHttp: () => ({ getRequest: () => request }) }
		],
		[
			'a GraphQL operation',
			() => new GraphqlInterceptor(),
			{
				getType: () => 'graphql',
				gql: { getInfo: () => ({ parentType: { name: 'Mutation' } }), getContext: () => ({ req: request }) }
			}
		]
	])('an error raised by %s', (_, interceptorOf, context) => {
		it('is reported with the redacted request and the user id, and no credential', () => {
			const interceptor = interceptorOf();
			const captureException = jest.fn();
			jest.spyOn((interceptor as any).client, 'instance').mockReturnValue({ captureException });
			const scope = {
				extra: {} as Record<string, unknown>,
				tags: {} as Record<string, unknown>,
				user: undefined
			};
			const fake = {
				setExtra: (key: string, value: unknown) => (scope.extra[key] = value),
				setTag: (key: string, value: unknown) => (scope.tags[key] = value),
				setUser: (value: any) => (scope.user = value)
			};

			(interceptor as any).captureException(context as unknown as ExecutionContext, fake, new Error('boom'));

			expect(captureException).toHaveBeenCalledTimes(1);
			expect(scope.extra['req']).toEqual(redactedRequestOf(request));
			expect(scope.user).toEqual({ id: 'user-1' });
			expect(leaks(scope)).toEqual([]);
		});
	});

	it('reports a server error and skips a client error over GraphQL, as over HTTP', () => {
		const interceptor = new GraphqlInterceptor(SENTRY_INTERCEPTOR_OPTIONS) as any;

		expect(interceptor.shouldReport(new InternalServerErrorException())).toBe(true);
		expect(interceptor.shouldReport(new BadRequestException())).toBe(false);
	});
});
