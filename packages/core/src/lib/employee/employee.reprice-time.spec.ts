import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { repriceMemberTime } from '../time-tracking/time-log/time-log-repricing';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';

jest.mock('../time-tracking/time-log/time-log-repricing', () => ({ repriceMemberTime: jest.fn(async () => 7) }));

/**
 * A rate change says whether time already tracked takes the new rate: with a day (`ratesApplyFrom`), the employee's
 * time logs from that day do; without one, only time recorded from then on does. Re-pricing is the right to change
 * those rates: one's own time needs CHANGE_OWN_RATES, anyone else's ORG_EMPLOYEES_EDIT.
 */
describe('re-pricing an employee time from a day', () => {
	let permissions: PermissionsEnum[];

	beforeEach(() => {
		permissions = [];
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue('employee-1');
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) =>
			permissions.includes(permission as PermissionsEnum)
		);
		(repriceMemberTime as jest.Mock).mockClear();
	});

	afterEach(() => jest.restoreAllMocks());

	describe('EmployeeService', () => {
		const findOne = jest.fn(async () => ({ id: 'employee-2', organizationId: 'organization-1' }));
		const service = Object.create(EmployeeService.prototype) as EmployeeService;
		Object.assign(service, { typeOrmRepository: { findOne, manager: 'manager' } });

		it("refuses one's own time without CHANGE_OWN_RATES, and lets it with", () => {
			permissions = [PermissionsEnum.ORG_EMPLOYEES_EDIT];
			expect(() => service.assertMayRepriceTimeOf('EMPLOYEE-1')).toThrow(ForbiddenException);

			permissions = [PermissionsEnum.CHANGE_OWN_RATES];
			expect(() => service.assertMayRepriceTimeOf('employee-1')).not.toThrow();
		});

		it("refuses a colleague's time without ORG_EMPLOYEES_EDIT, and lets it with", () => {
			permissions = [PermissionsEnum.CHANGE_OWN_RATES, PermissionsEnum.ORG_EMPLOYEES_VIEW];
			expect(() => service.assertMayRepriceTimeOf('employee-2')).toThrow(ForbiddenException);

			permissions = [PermissionsEnum.ORG_EMPLOYEES_EDIT];
			expect(() => service.assertMayRepriceTimeOf('employee-2')).not.toThrow();
		});

		it("re-prices from the day the rates the update sent, in the employee's organization", async () => {
			const count = await service.repriceTimeFrom('employee-2', { billRateValue: 50 } as never, '2026-10-01');

			expect(count).toBe(7);
			expect(repriceMemberTime).toHaveBeenCalledWith(
				'manager',
				{ tenantId: 'tenant-1', organizationId: 'organization-1', from: new Date('2026-10-01') },
				'employee-2',
				{ billing: true, pay: false }
			);
		});

		it('re-prices nothing without a day: past time keeps its price', async () => {
			expect(
				await service.repriceTimeFrom('employee-2', { billRateValue: 50 } as never, undefined)
			).toBeUndefined();
			expect(repriceMemberTime).not.toHaveBeenCalled();
		});
	});

	describe('EmployeeController', () => {
		let execute: jest.Mock;
		let assertMayRepriceTimeOf: jest.Mock;
		let repriceTimeFrom: jest.Mock;
		let controller: EmployeeController;

		beforeEach(() => {
			execute = jest.fn(async () => ({ id: 'employee-2' }));
			assertMayRepriceTimeOf = jest.fn();
			repriceTimeFrom = jest.fn(async () => 12);
			controller = new EmployeeController(
				{ assertOwnPayRateUnchanged: jest.fn(), assertMayRepriceTimeOf, repriceTimeFrom } as never,
				{ execute } as never,
				{} as never,
				{} as never
			);
		});

		it('saves the rates without the day, then answers how many time logs took them', async () => {
			const answer = await controller.update('employee-2', {
				billRateValue: 50,
				ratesApplyFrom: '2026-10-01T00:00:00.000Z'
			} as never);

			const [command] = execute.mock.calls[0];
			expect(command.input).toEqual({ billRateValue: 50 });
			expect(assertMayRepriceTimeOf).toHaveBeenCalledWith('employee-2');
			expect(repriceTimeFrom).toHaveBeenCalledWith(
				'employee-2',
				{ billRateValue: 50 },
				'2026-10-01T00:00:00.000Z'
			);
			expect(answer).toEqual({ id: 'employee-2', repricedTimeLogs: 12 });
		});

		it('changes nothing when the caller may not re-price that time', async () => {
			assertMayRepriceTimeOf.mockImplementation(() => {
				throw new ForbiddenException();
			});

			await expect(
				controller.update('employee-2', { billRateValue: 50, ratesApplyFrom: '2026-10-01' } as never)
			).rejects.toThrow(ForbiddenException);
			expect(execute).not.toHaveBeenCalled();
		});

		it('answers the employee as before without a day', async () => {
			const answer = await controller.update('employee-2', { billRateValue: 50 } as never);

			expect(answer).toEqual({ id: 'employee-2' });
			expect(repriceTimeFrom).not.toHaveBeenCalled();
		});

		it('takes a day on the own-profile route too', async () => {
			const answer = await controller.updateProfile('employee-2', {
				billRateValue: 50,
				ratesApplyFrom: '2026-10-01'
			} as never);

			const [command] = execute.mock.calls[0];
			expect(command.input).toEqual({ billRateValue: 50 });
			expect(answer).toEqual({ id: 'employee-2', repricedTimeLogs: 12 });
		});
	});
});
