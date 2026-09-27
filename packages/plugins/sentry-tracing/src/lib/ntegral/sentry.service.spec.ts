import * as Sentry from '@sentry/node';
import { SentryService } from './sentry.service';

jest.mock('@sentry/node', () => ({
	init: jest.fn(),
	onUncaughtExceptionIntegration: jest.fn(() => ({ name: 'OnUncaughtException' })),
	onUnhandledRejectionIntegration: jest.fn(() => ({ name: 'OnUnhandledRejection' })),
	captureMessage: jest.fn(),
	addBreadcrumb: jest.fn()
}));

// SentryService only reads the current request's tenant settings from @gauzy/core; with no request
// in flight it falls back to "enabled when a DSN is configured".
jest.mock('@gauzy/core', () => ({ RequestContext: { currentRequest: () => undefined } }));

const DSN = 'https://public@o0.ingest.sentry.io/0';

describe('SentryService', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		// ConsoleLogger would print every call; the console output itself is not under test.
		jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
		jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
	});

	afterEach(() => jest.restoreAllMocks());

	describe("with logLevels ['error'] (what the API configures by default)", () => {
		const service = () => new SentryService({ dsn: DSN, logLevels: ['error'] });

		it('turns log, warn, debug and verbose calls into breadcrumbs, never into events', () => {
			const logger = service();

			logger.log('GET request to /api/employee started.', 'RequestContextMiddleware');
			logger.warn('slow query', 'Database');
			logger.debug('cache miss', 'Cache');
			logger.verbose('details', 'Cache');

			expect(Sentry.captureMessage).not.toHaveBeenCalled();
			expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(4);
			expect((Sentry.addBreadcrumb as jest.Mock).mock.calls.map(([crumb]) => crumb.level)).toEqual([
				'log',
				'warning',
				'debug',
				'info'
			]);
		});

		it('still sends errors to Sentry', () => {
			service().error('Redis connection lost', undefined, 'RedisModule');

			expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
			expect(Sentry.captureMessage).toHaveBeenCalledWith(
				expect.stringContaining('Redis connection lost'),
				'error'
			);
		});
	});

	it('sends fatal logs to Sentry whenever errors are captured', () => {
		new SentryService({ dsn: DSN, logLevels: ['error'] }).fatal('database unreachable', 'Bootstrap');

		expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.stringContaining('database unreachable'), 'fatal');
	});

	it('keeps fatal logs as breadcrumbs when neither fatal nor error is captured', () => {
		new SentryService({ dsn: DSN, logLevels: ['warn'] }).fatal('database unreachable', 'Bootstrap');

		expect(Sentry.captureMessage).not.toHaveBeenCalled();
		expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({ level: 'fatal' }));
	});

	it('captures every level listed, e.g. SENTRY_LOG_LEVELS=error,warn', () => {
		const logger = new SentryService({ dsn: DSN, logLevels: ['error', 'warn'] });

		logger.warn('slow query', 'Database');
		logger.log('request started', 'RequestContextMiddleware');

		expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
		expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.stringContaining('slow query'), 'warning');
		expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(1);
	});

	it('keeps the previous capture-everything behaviour when no levels are configured', () => {
		const logger = new SentryService({ dsn: DSN });

		logger.log('request started', 'RequestContextMiddleware');
		logger.error('boom');

		expect(Sentry.captureMessage).toHaveBeenCalledTimes(2);
	});

	it('honours an explicit breadcrumb request even for a captured level', () => {
		new SentryService({ dsn: DSN, logLevels: ['log'] }).log('noise', 'Ctx', true);

		expect(Sentry.captureMessage).not.toHaveBeenCalled();
		expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(1);
	});

	it('sends nothing at all without a DSN', () => {
		const logger = new SentryService({ logLevels: ['error'] });

		logger.error('boom');
		logger.log('request started');

		expect(Sentry.captureMessage).not.toHaveBeenCalled();
		expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
	});
});
