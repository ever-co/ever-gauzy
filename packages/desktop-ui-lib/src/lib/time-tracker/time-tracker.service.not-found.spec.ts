import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
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

	const failWith = (status: number) =>
		throwError(() => new HttpErrorResponse({ status, statusText: String(status) }));

	describe('getTimeLogById', () => {
		it('answers null for a time log the server no longer has', async () => {
			http.get.mockReturnValue(failWith(404));

			await expect(service.getTimeLogById('gone')).resolves.toBeNull();
		});

		it('answers the time log it has', async () => {
			http.get.mockReturnValue(of({ id: 'tl' }));

			await expect(service.getTimeLogById('tl')).resolves.toEqual({ id: 'tl' });
		});

		it('still fails on any other error, so a real outage is not taken for a deletion', async () => {
			http.get.mockReturnValue(failWith(500));

			await expect(service.getTimeLogById('tl')).rejects.toMatchObject({ status: 500 });
		});
	});

	describe('getTimeSlot', () => {
		it('answers null for a time slot the server no longer has', async () => {
			http.get.mockReturnValue(failWith(404));

			await expect(service.getTimeSlot({ timeSlotId: 'gone' })).resolves.toBeNull();
		});

		it('still fails on any other error', async () => {
			http.get.mockReturnValue(failWith(500));

			await expect(service.getTimeSlot({ timeSlotId: 'slot' })).rejects.toMatchObject({ status: 500 });
		});
	});
});
