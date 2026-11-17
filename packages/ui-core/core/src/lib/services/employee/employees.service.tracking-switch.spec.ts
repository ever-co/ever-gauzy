import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { EmployeesService } from './employees.service';

/**
 * The tracking button turned the switch to the inverse of the row it had read, so a stale row could act on a state
 * that was gone (ever-co/ever-gauzy#11830). The save now names the state the row showed, and the API refuses it when
 * someone changed it since.
 */
describe('EmployeesService.setEmployeeTimeTrackingStatus', () => {
	const scope = { organizationId: 'organization-1', tenantId: 'tenant-1' };

	it('sends the state it turns tracking to and the state the screen showed', async () => {
		const put = jest.fn(() => of({ id: 'employee-1' }));
		const service = new EmployeesService({ put } as unknown as HttpClient);

		await service.setEmployeeTimeTrackingStatus('employee-1', false, scope, true);

		expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/employee\/employee-1$/), {
			isTrackingEnabled: false,
			expectedIsTrackingEnabled: true,
			...scope
		});
	});
});
