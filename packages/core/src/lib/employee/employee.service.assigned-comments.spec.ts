/**
 * Importing `EmployeeService` reaches `core/entities/internal` and the decorator graph. Loading that graph FIRST
 * matches the application boot order and avoids the "IsEmployeeBelongsToOrganization is not a function" cycle.
 */
import '../core/entities/internal';

import { TenantAwareCrudService } from '../core/crud';
import { EmployeeService } from './employee.service';

/**
 * Every employee write from a request body goes through `EmployeeService.create` (`POST /employee`, the bulk import,
 * the update handler's upsert, a hired candidate, the expense and income totals). The comments an employee is assigned
 * are written through the comment API only, where the comment's record policy decides, so this write never links one.
 */
describe('EmployeeService.create — the comments an employee is assigned', () => {
	let create: jest.SpyInstance;
	let service: EmployeeService;

	beforeEach(() => {
		create = jest
			.spyOn(TenantAwareCrudService.prototype, 'create')
			.mockImplementation(async (entity: any) => entity);
		service = Object.create(EmployeeService.prototype);
	});

	afterEach(() => jest.restoreAllMocks());

	it('writes the employee without the comments the input assigns it', async () => {
		const input = { id: 'employee-1', description: '<p>Hello</p>', assignedComments: [{ id: 'note' }] } as any;

		await service.create(input);

		expect(create).toHaveBeenCalledWith({ id: 'employee-1', description: '<p>Hello</p>' });
		expect(input.assignedComments).toEqual([{ id: 'note' }]);
	});

	it('writes every other field as before, the description sanitized', async () => {
		await service.create({ id: 'employee-1', description: '<p>Hi</p><script>x()</script>', isActive: true } as any);

		expect(create).toHaveBeenCalledWith({
			id: 'employee-1',
			description: expect.not.stringContaining('<script'),
			isActive: true
		});
	});
});
