import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { SKIP_NOT_FOUND_NOTIFICATION } from '../interceptors/skip-not-found-notification.token';
import { TimeTrackerService } from './time-tracker.service';

/**
 * Deleted data is not an error: the lookups answer "not there" (null), and anything else the server says still fails.
 */
describe('TimeTrackerService, data deleted on the server', () => {
	const http = { get: jest.fn() };
	const logger = { log: { warn: jest.fn(), info: jest.fn() } };
	const cache = { getValue: jest.fn().mockReturnValue(null), setValue: jest.fn() };
	let service: TimeTrackerService;

	beforeEach(() => {
		jest.clearAllMocks();
		service = Object.create(TimeTrackerService.prototype);
		Object.assign(service, {
			http,
			_loggerService: logger,
			_timeSlotCacheService: cache,
			_store: { tenantId: 't', organizationId: 'o' }
		});
	});

	const failWith = (status: number, error: unknown = { statusCode: status, message: String(status) }) =>
		throwError(() => new HttpErrorResponse({ status, statusText: String(status), error }));

	/** The API's own answer for a record it does not have (NotFoundException). */
	const notFound = () => failWith(404, { statusCode: 404, message: 'The requested record was not found' });

	/** A 404 from something in front of the API (a proxy answering for a route it cannot reach), not from the API. */
	const proxyNotFound = () => failWith(404, '<html><body>404 Not Found</body></html>');

	const requestContext = () => http.get.mock.calls[0][1].context;

	describe('getTimeLogById', () => {
		it('answers null for a time log the server no longer has', async () => {
			http.get.mockReturnValue(notFound());

			await expect(service.getTimeLogById('gone')).resolves.toBeNull();
		});

		it('answers the time log it has', async () => {
			http.get.mockReturnValue(of({ id: 'tl' }));

			await expect(service.getTimeLogById('tl')).resolves.toEqual({ id: 'tl' });
		});

		it('asks for no error toast on a 404, which it answers itself', async () => {
			http.get.mockReturnValue(of({ id: 'tl' }));

			await service.getTimeLogById('tl');

			expect(requestContext().get(SKIP_NOT_FOUND_NOTIFICATION)).toBe(true);
		});

		it('still fails on any other error, so a real outage is not taken for a deletion', async () => {
			http.get.mockReturnValue(failWith(500));

			await expect(service.getTimeLogById('tl')).rejects.toMatchObject({ status: 500 });
		});

		it('still fails on a 404 that is not the API answering, so a proxy is not taken for a deletion', async () => {
			http.get.mockReturnValue(proxyNotFound());

			await expect(service.getTimeLogById('tl')).rejects.toMatchObject({ status: 404 });
		});
	});

	describe('getTimeSlot', () => {
		it('answers null for a time slot the server no longer has', async () => {
			http.get.mockReturnValue(notFound());

			await expect(service.getTimeSlot({ timeSlotId: 'gone' })).resolves.toBeNull();
		});

		it('asks for no error toast on a 404, which it answers itself', async () => {
			http.get.mockReturnValue(of({ id: 'slot' }));

			await service.getTimeSlot({ timeSlotId: 'slot' });

			expect(requestContext().get(SKIP_NOT_FOUND_NOTIFICATION)).toBe(true);
		});

		it('still fails on any other error', async () => {
			http.get.mockReturnValue(failWith(500));

			await expect(service.getTimeSlot({ timeSlotId: 'slot' })).rejects.toMatchObject({ status: 500 });
		});

		it('still fails on a 404 that is not the API answering', async () => {
			http.get.mockReturnValue(proxyNotFound());

			await expect(service.getTimeSlot({ timeSlotId: 'slot' })).rejects.toMatchObject({ status: 404 });
		});
	});
});
