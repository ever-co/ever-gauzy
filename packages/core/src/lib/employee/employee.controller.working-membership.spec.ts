/**
 * Load the entity graph FIRST, as the application does (see employee.resolver.spec.ts): importing the
 * controller through the validators otherwise leaves an entity decorator undefined.
 */
import '../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { EmployeeController } from './employee.controller';
import { WorkingEmployeeGetCommand } from './commands';

/**
 * #10686: `GET /employee/working` and `GET /employee/working/count` read the organization from the
 * `data` query JSON, which no DTO validates, and never checked that the caller belongs to it. Both now
 * run the membership check the other employee lists get from `@IsOrganizationBelongsToUser()`.
 */
describe('EmployeeController — working routes check organization membership', () => {
	const MINE = '11111111-1111-4111-8111-111111111111';
	const THEIRS = '22222222-2222-4222-8222-222222222222';
	const forRange = { startDate: '2026-10-01', endDate: '2026-10-31' };

	let execute: jest.Mock;
	let findWorkingEmployeesCount: jest.Mock;
	let checkOrganizationExistence: jest.Mock;
	let controller: EmployeeController;

	beforeEach(() => {
		execute = jest.fn().mockResolvedValue({ items: [], total: 0 });
		findWorkingEmployeesCount = jest.fn().mockResolvedValue({ total: 0 });
		checkOrganizationExistence = jest.fn(async (id: string) => id === MINE);
		const membership = {
			checkOrganizationExistence,
			defaultMessage: () => 'The user is not associated with the specified organization.'
		};
		controller = new EmployeeController(
			{ findWorkingEmployeesCount } as any,
			{ execute } as any,
			{} as any,
			membership as any
		);
	});

	describe('GET /employee/working', () => {
		const list = (findInput: Record<string, unknown>) => controller.findAllWorkingEmployees({ findInput });

		it('refuses an organization the caller does not belong to, before reading', async () => {
			await expect(list({ organizationId: THEIRS, forRange })).rejects.toBeInstanceOf(BadRequestException);
			expect(checkOrganizationExistence).toHaveBeenCalledWith(THEIRS);
			expect(execute).not.toHaveBeenCalled();
		});

		it.each([[[MINE, THEIRS]], [{ $ne: MINE }], [{ $in: [MINE, THEIRS] }]])(
			'refuses a non-string organization %j without looking it up',
			async (organizationId) => {
				await expect(list({ organizationId, forRange })).rejects.toBeInstanceOf(BadRequestException);
				expect(checkOrganizationExistence).not.toHaveBeenCalled();
				expect(execute).not.toHaveBeenCalled();
			}
		);

		it("lists one of the caller's own organizations", async () => {
			await list({ organizationId: MINE, forRange });

			expect(execute).toHaveBeenCalledWith(new WorkingEmployeeGetCommand({ organizationId: MINE, forRange }));
		});

		it('passes a call without an organization through, as before', async () => {
			await list({ forRange });

			expect(checkOrganizationExistence).not.toHaveBeenCalled();
			expect(execute).toHaveBeenCalledWith(new WorkingEmployeeGetCommand({ forRange }));
		});
	});

	describe('GET /employee/working/count', () => {
		const count = (findInput: Record<string, unknown>) => controller.findAllWorkingEmployeesCount({ findInput });

		it('refuses an organization the caller does not belong to, before counting', async () => {
			await expect(count({ organizationId: THEIRS, forRange })).rejects.toBeInstanceOf(BadRequestException);
			expect(checkOrganizationExistence).toHaveBeenCalledWith(THEIRS);
			expect(findWorkingEmployeesCount).not.toHaveBeenCalled();
		});

		it.each([[[MINE, THEIRS]], [{ $ne: MINE }]])(
			'refuses a non-string organization %j without looking it up',
			async (organizationId) => {
				await expect(count({ organizationId, forRange })).rejects.toBeInstanceOf(BadRequestException);
				expect(checkOrganizationExistence).not.toHaveBeenCalled();
				expect(findWorkingEmployeesCount).not.toHaveBeenCalled();
			}
		);

		it("counts one of the caller's own organizations", async () => {
			await expect(count({ organizationId: MINE, forRange })).resolves.toEqual({ total: 0 });

			expect(findWorkingEmployeesCount).toHaveBeenCalledWith(MINE, forRange);
		});

		it('passes a call without an organization through, as before', async () => {
			await count({ forRange });

			expect(checkOrganizationExistence).not.toHaveBeenCalled();
			expect(findWorkingEmployeesCount).toHaveBeenCalledWith(undefined, forRange);
		});
	});
});
