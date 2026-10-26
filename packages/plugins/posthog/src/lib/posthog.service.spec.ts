const mockCaptureException = jest.fn();

jest.mock('posthog-node', () => ({
	PostHog: jest.fn().mockImplementation(() => ({
		capture: jest.fn(),
		captureException: mockCaptureException,
		identify: jest.fn(),
		shutdown: jest.fn().mockResolvedValue(undefined)
	}))
}));

jest.mock('@gauzy/core', () => ({
	RequestContext: { currentRequest: jest.fn().mockReturnValue(null) }
}));

import { PosthogService } from './posthog.service';

/**
 * PosthogService.captureException passed posthog-node one object (`{ exception, distinctId, properties }`), but the
 * SDK signature is positional: `captureException(error, distinctId?, additionalProperties?)`. Every server error the
 * PostHog interceptor reported therefore arrived as a plain object, with no user and none of the request context.
 */
describe('PosthogService.captureException', () => {
	beforeEach(() => mockCaptureException.mockClear());

	it('forwards the error, the distinct id and the properties as positional arguments', () => {
		const service = new PosthogService({ apiKey: 'phc_test_key' });
		const error = new Error('boom');
		const properties = { method: 'GET', url: '/api/health' };

		service.captureException(error, 'user-1', properties);

		expect(mockCaptureException).toHaveBeenCalledTimes(1);
		expect(mockCaptureException).toHaveBeenCalledWith(error, 'user-1', properties);
	});
});
