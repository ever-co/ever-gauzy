/**
 * Load the decorator graph first, as the application boot does, or importing the handler's services
 * hits the "IsEmployeeBelongsToOrganization is not a function" cycle.
 */
import '../../../core/entities/internal';

import { ConflictException } from '@nestjs/common';
import { CandidateStatusEnum, CurrenciesEnum, RolesEnum } from '@gauzy/contracts';
import { CandidateHiredCommand } from '../candidate.hired.command';
import { CandidateHiredHandler } from './candidate.hired.handler';

/**
 * Hiring a candidate creates the employee from the candidate's rates. Both sides are `numeric(14,2)`
 * since #10203 (employee) and this change (candidate), so the cents must survive — and
 * `minimumBillingRate` has to be carried over, not dropped.
 */
describe('CandidateHiredHandler', () => {
	const candidate = {
		id: 'candidate-1',
		alreadyHired: false,
		billRateValue: 10.49,
		minimumBillingRate: 5.25,
		billRateCurrency: CurrenciesEnum.USD,
		reWeeklyLimit: 37,
		tenantId: 'tenant-1',
		organizationId: 'org-1',
		userId: 'user-1',
		tags: []
	};

	const buildHandler = (overrides: Partial<typeof candidate> = {}) => {
		const candidateService = {
			findOneByIdString: jest.fn(async () => ({ ...candidate, ...overrides })),
			create: jest.fn(async (input: any) => input)
		};
		const employeeService = { create: jest.fn(async (input: any) => ({ id: 'employee-1', ...input })) };
		const userService = { create: jest.fn(async (input: any) => input) };
		const roleService = {
			findOneByWhereOptions: jest.fn(async () => ({ id: 'role-1', name: RolesEnum.EMPLOYEE }))
		};

		const handler = new CandidateHiredHandler(
			candidateService as any,
			employeeService as any,
			userService as any,
			roleService as any
		);

		return { handler, candidateService, employeeService };
	};

	it('carries both rates, with their cents, into the new employee', async () => {
		const { handler, employeeService } = buildHandler();

		await handler.execute(new CandidateHiredCommand(candidate.id));

		expect(employeeService.create).toHaveBeenCalledWith(
			expect.objectContaining({ billRateValue: 10.49, minimumBillingRate: 5.25 })
		);
	});

	it('passes a missing minimum rate through as-is', async () => {
		const { handler, employeeService } = buildHandler({ minimumBillingRate: null });

		await handler.execute(new CandidateHiredCommand(candidate.id));

		expect(employeeService.create).toHaveBeenCalledWith(expect.objectContaining({ minimumBillingRate: null }));
	});

	it('marks the candidate hired', async () => {
		const { handler, candidateService } = buildHandler();

		await handler.execute(new CandidateHiredCommand(candidate.id));

		expect(candidateService.create).toHaveBeenCalledWith(
			expect.objectContaining({ id: candidate.id, status: CandidateStatusEnum.HIRED })
		);
	});

	it('refuses to hire an already hired candidate', async () => {
		const { handler, employeeService } = buildHandler({ alreadyHired: true });

		await expect(handler.execute(new CandidateHiredCommand(candidate.id))).rejects.toBeInstanceOf(
			ConflictException
		);
		expect(employeeService.create).not.toHaveBeenCalled();
	});
});
