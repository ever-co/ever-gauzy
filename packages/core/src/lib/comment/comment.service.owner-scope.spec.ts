/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { CommentService } from './comment.service';

/**
 * A comment is its author's: `CommentService.update` lets a CHANGE_SELECTED_EMPLOYEE holder edit any comment of
 * the tenant, and everyone else only their own — and refuses outright a caller with no employee identity (a null
 * key used to be dropped from the query, which let such callers edit anything).
 *
 * The soft-delete/recover pair (`DELETE /comment/:id/soft`, `PUT /comment/:id/recover`, `softDeleteComment`,
 * `recoverComment`) and the removal (`DELETE /comment/:id`, `deleteComment`) reached the CRUD base instead, whose
 * employee scope falls back to the WHOLE tenant for a caller who has no employee record and may not act for
 * others — so a user who may not edit a single comment could withdraw, restore or delete every comment of the
 * tenant. They state no permission, like `update`; owner decision 5 (2026-10-13) keeps them equal to `update`,
 * and that includes the rule `update` applies to whose comment it is.
 */
describe('CommentService — withdrawing, restoring and removing a comment follow the rule editing it follows', () => {
	const OWN = 'comment-own';
	const THEIRS = 'comment-theirs';

	let service: CommentService;
	let findOne: jest.Mock;
	let baseSoftRemove: jest.SpyInstance;
	let baseSoftRecover: jest.SpyInstance;
	let baseDelete: jest.SpyInstance;

	const as = (employeeId: string | null, canChangeSelectedEmployee: boolean) => {
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(employeeId as any);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission: PermissionsEnum) => canChangeSelectedEmployee && permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);
	};

	beforeEach(() => {
		service = Object.create(CommentService.prototype);
		// The tenant-scoped lookup: a comment is found by its id, and — when the caller states an author — only
		// when it is that author's.
		findOne = jest.fn(async (id: string, options?: { where?: { employeeId?: string } }) => {
			const author = id === OWN ? 'employee-me' : 'employee-other';
			if (options?.where?.employeeId && options.where.employeeId !== author) {
				throw new NotFoundException('The requested record was not found');
			}
			return { id, employeeId: author };
		});
		(service as any).findOneByIdString = findOne;
		baseSoftRemove = jest.spyOn(CrudService.prototype, 'softRemove').mockResolvedValue({ deletedAt: new Date() } as any);
		baseSoftRecover = jest.spyOn(CrudService.prototype, 'softRecover').mockResolvedValue({ deletedAt: null } as any);
		baseDelete = jest.spyOn(TenantAwareCrudService.prototype, 'delete').mockResolvedValue({ affected: 1, raw: [] });
	});

	afterEach(() => jest.restoreAllMocks());

	it('lets the author withdraw, restore and remove their own comment', async () => {
		as('employee-me', false);

		await expect(service.softRemove(OWN)).resolves.toEqual({ deletedAt: expect.any(Date) });
		await expect(service.softRecover(OWN)).resolves.toEqual({ deletedAt: null });
		await expect(service.delete(OWN)).resolves.toEqual({ affected: 1, raw: [] });
		// Restoring reads the withdrawn row, so the ownership read includes withdrawn rows.
		expect(findOne).toHaveBeenCalledWith(OWN, { where: { employeeId: 'employee-me' }, withDeleted: true });
	});

	it('refuses another employee’s comment to an employee who may not act for others, and writes nothing', async () => {
		as('employee-me', false);

		await expect(service.softRemove(THEIRS)).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.softRecover(THEIRS)).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.delete(THEIRS)).rejects.toBeInstanceOf(NotFoundException);
		expect(baseSoftRemove).not.toHaveBeenCalled();
		expect(baseSoftRecover).not.toHaveBeenCalled();
		expect(baseDelete).not.toHaveBeenCalled();
	});

	it('refuses a caller with no employee identity who may not act for others — the hole the base scope left open', async () => {
		as(null, false);

		await expect(service.softRemove(THEIRS)).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.softRecover(THEIRS)).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.delete(THEIRS)).rejects.toBeInstanceOf(ForbiddenException);
		expect(baseSoftRemove).not.toHaveBeenCalled();
		expect(baseSoftRecover).not.toHaveBeenCalled();
		expect(baseDelete).not.toHaveBeenCalled();
	});

	it('lets a CHANGE_SELECTED_EMPLOYEE holder manage any comment of the tenant, as editing does', async () => {
		as(null, true);

		await expect(service.softRemove(THEIRS)).resolves.toBeDefined();
		await expect(service.softRecover(THEIRS)).resolves.toBeDefined();
		await expect(service.delete(THEIRS)).resolves.toEqual({ affected: 1, raw: [] });
	});
});
