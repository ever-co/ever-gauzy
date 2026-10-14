/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context/request-context';
import { ReactionService } from './reaction.service';

/**
 * A reaction is its employee's own: `ReactionService.update` and `.delete` act only on a reaction of the caller's
 * own employee record, and refuse a caller who has none in the request context.
 *
 * The soft-delete/recover pair (`DELETE /reaction/:id/soft`, `PUT /reaction/:id/recover`, `softDeleteReaction`,
 * `recoverReaction`) reached the CRUD base instead, whose employee scope is dropped for a CHANGE_SELECTED_EMPLOYEE
 * holder and falls back to the whole tenant for a caller with no employee record — so either could withdraw or
 * restore anybody's reaction, which neither may edit or delete. Owner decision 5 (2026-10-13) keeps the pair equal
 * to `update`, rule included.
 */
describe('ReactionService — withdrawing and restoring a reaction follow the rule editing and removing it follow', () => {
	const OWN = 'reaction-own';
	const THEIRS = 'reaction-theirs';

	let service: ReactionService;
	let findOne: jest.Mock;
	let baseSoftRemove: jest.SpyInstance;
	let baseSoftRecover: jest.SpyInstance;

	const as = (employeeId: string | null, canChangeSelectedEmployee = false) => {
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(employeeId as any);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission: PermissionsEnum) => canChangeSelectedEmployee && permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);
	};

	beforeEach(() => {
		service = Object.create(ReactionService.prototype);
		findOne = jest.fn(async (id: string, options?: { where?: { employeeId?: string } }) => {
			const owner = id === OWN ? 'employee-me' : 'employee-other';
			if (options?.where?.employeeId && options.where.employeeId !== owner) {
				throw new NotFoundException('The requested record was not found');
			}
			return { id, employeeId: owner };
		});
		(service as any).findOneByIdString = findOne;
		baseSoftRemove = jest.spyOn(CrudService.prototype, 'softRemove').mockResolvedValue({ deletedAt: new Date() } as any);
		baseSoftRecover = jest.spyOn(CrudService.prototype, 'softRecover').mockResolvedValue({ deletedAt: null } as any);
	});

	afterEach(() => jest.restoreAllMocks());

	it('lets an employee withdraw and restore their own reaction', async () => {
		as('employee-me');

		await expect(service.softRemove(OWN)).resolves.toEqual({ deletedAt: expect.any(Date) });
		await expect(service.softRecover(OWN)).resolves.toEqual({ deletedAt: null });
		expect(findOne).toHaveBeenCalledWith(OWN, { where: { employeeId: 'employee-me' }, withDeleted: true });
	});

	it('refuses another employee’s reaction, and writes nothing', async () => {
		as('employee-me');

		await expect(service.softRemove(THEIRS)).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.softRecover(THEIRS)).rejects.toBeInstanceOf(NotFoundException);
		expect(baseSoftRemove).not.toHaveBeenCalled();
		expect(baseSoftRecover).not.toHaveBeenCalled();
	});

	it('refuses a CHANGE_SELECTED_EMPLOYEE holder, as editing and removing a reaction do (no own employee in the context)', async () => {
		as(null, true);

		await expect(service.softRemove(THEIRS)).rejects.toBeInstanceOf(BadRequestException);
		await expect(service.softRecover(THEIRS)).rejects.toBeInstanceOf(BadRequestException);
		expect(baseSoftRemove).not.toHaveBeenCalled();
		expect(baseSoftRecover).not.toHaveBeenCalled();
	});

	it('refuses a caller with no employee identity', async () => {
		as(null);

		await expect(service.softRemove(OWN)).rejects.toBeInstanceOf(BadRequestException);
		await expect(service.softRecover(OWN)).rejects.toBeInstanceOf(BadRequestException);
		expect(baseSoftRemove).not.toHaveBeenCalled();
		expect(baseSoftRecover).not.toHaveBeenCalled();
	});
});
