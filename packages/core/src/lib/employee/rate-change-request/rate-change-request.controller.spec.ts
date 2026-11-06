import '../../core/entities/internal';

import { EmployeeRateChangeRequestController } from './rate-change-request.controller';

/** Each rate change request notifies every admin of the organization, so an employee sends a few a minute at most. */
describe('EmployeeRateChangeRequestController', () => {
	it('limits an employee to 5 rate change requests a minute', () => {
		const handler = EmployeeRateChangeRequestController.prototype.request;

		expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(5);
		expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60000);
	});
});
