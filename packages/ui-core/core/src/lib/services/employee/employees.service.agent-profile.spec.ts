import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { EmployeesService } from './employees.service';

/**
 * `getAgentProfile` answers `null` only for a missing profile (404). Any other failure — a refused request, a
 * server error, the network — reaches the caller, which reports it instead of hiding the managed-agent notice.
 */
describe('EmployeesService.getAgentProfile', () => {
	const serviceAnswering = (answer: () => ReturnType<HttpClient['get']>) =>
		new EmployeesService({ get: jest.fn(answer) } as unknown as HttpClient);

	it('returns the profile', async () => {
		const profile = { employeeId: 'e-1', externalId: 'agent-1' };
		await expect(serviceAnswering(() => of(profile)).getAgentProfile('e-1')).resolves.toEqual(profile);
	});

	it('returns null for a missing profile (404)', async () => {
		const notFound = new HttpErrorResponse({ status: 404 });
		await expect(serviceAnswering(() => throwError(() => notFound)).getAgentProfile('e-1')).resolves.toBeNull();
	});

	it.each([403, 500, 0])('rethrows any other failure (%s)', async (status) => {
		const failure = new HttpErrorResponse({ status });
		await expect(serviceAnswering(() => throwError(() => failure)).getAgentProfile('e-1')).rejects.toBe(failure);
	});
});
