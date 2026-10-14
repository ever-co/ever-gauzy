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
	/** The author's own comment, already withdrawn: only a read that includes withdrawn rows finds it. */
	const WITHDRAWN = 'comment-own-withdrawn';
	/** An author-less comment a caller with no employee record posted. */
	const POSTED = 'comment-posted-without-employee';

	let service: CommentService;
	let findOne: jest.Mock;
	let baseSoftRemove: jest.SpyInstance;
	let baseSoftRecover: jest.SpyInstance;
	let baseDelete: jest.SpyInstance;

	const as = (employeeId: string | null, canChangeSelectedEmployee: boolean, userId: string | null = 'user-me') => {
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(employeeId as any);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(userId as any);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission: PermissionsEnum) => canChangeSelectedEmployee && permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);
	};

	beforeEach(() => {
		service = Object.create(CommentService.prototype);
		// The tenant-scoped lookup: a comment is found by its id, and — when the caller states an author — only
		// when it is that author's.
		findOne = jest.fn(async (id: string, options?: { where?: { employeeId?: string; createdByUserId?: string }; withDeleted?: boolean }) => {
			if (id === WITHDRAWN && !options?.withDeleted) {
				throw new NotFoundException('The requested record was not found');
			}
			const row =
				id === OWN || id === WITHDRAWN
					? { id, employeeId: 'employee-me', createdByUserId: 'user-me' }
					: id === POSTED
					? { id, employeeId: null, createdByUserId: 'user-me' }
					: { id, employeeId: 'employee-other', createdByUserId: 'user-other' };
			const where = options?.where ?? {};
			if (
				('employeeId' in where && where.employeeId !== row.employeeId) ||
				('createdByUserId' in where && where.createdByUserId !== row.createdByUserId)
			) {
				throw new NotFoundException('The requested record was not found');
			}
			return row;
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

	it('lets the author permanently remove their own comment after withdrawing it, as the delete always could', async () => {
		// Greptile on #10568: the removal deletes the row whatever its `deletedAt`, so its ownership read must
		// include withdrawn rows too — otherwise a withdrawn comment could never be removed by its author.
		as('employee-me', false);

		await expect(service.delete(WITHDRAWN)).resolves.toEqual({ affected: 1, raw: [] });
		expect(findOne).toHaveBeenCalledWith(WITHDRAWN, { where: { employeeId: 'employee-me' }, withDeleted: true });
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

	it('refuses everybody else’s comments to a caller with no employee identity — the hole the base scope left open', async () => {
		as(null, false);

		await expect(service.softRemove(THEIRS)).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.softRecover(THEIRS)).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.delete(THEIRS)).rejects.toBeInstanceOf(NotFoundException);
		expect(baseSoftRemove).not.toHaveBeenCalled();
		expect(baseSoftRecover).not.toHaveBeenCalled();
		expect(baseDelete).not.toHaveBeenCalled();
	});

	it('still lets a caller with no employee identity remove the comment they posted themselves', async () => {
		as(null, false);

		await expect(service.delete(POSTED)).resolves.toEqual({ affected: 1, raw: [] });
		await expect(service.softRemove(POSTED)).resolves.toBeDefined();
		expect(findOne).toHaveBeenCalledWith(POSTED, { where: { createdByUserId: 'user-me' } });
	});

	it('refuses a caller with no identity at all', async () => {
		as(null, false, null);

		await expect(service.delete(POSTED)).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.softRemove(POSTED)).rejects.toBeInstanceOf(ForbiddenException);
		expect(baseDelete).not.toHaveBeenCalled();
	});

	it('lets a CHANGE_SELECTED_EMPLOYEE holder manage any comment of the tenant, as editing does', async () => {
		as(null, true);

		await expect(service.softRemove(THEIRS)).resolves.toBeDefined();
		await expect(service.softRecover(THEIRS)).resolves.toBeDefined();
		await expect(service.delete(THEIRS)).resolves.toEqual({ affected: 1, raw: [] });
	});
});
