/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context/request-context';
import { DashboardService } from './dashboard.service';

/**
 * Dashboards are personal: `DashboardService.update` and `.delete` refuse anyone but the dashboard's creator.
 *
 * The soft-delete/recover pair (`DELETE /dashboard/:id/soft`, `PUT /dashboard/:id/recover`, and the
 * `softDeleteDashboard` / `recoverDashboard` fields that mirror them) reached the CRUD base's `softRemove` /
 * `softRecover`, which check the tenant and nothing else — so a member who could not edit or delete a
 * colleague's dashboard could still withdraw it, or bring back one its creator had withdrawn. Owner decision 5
 * (2026-10-13) makes the pair "require edit permission"; for a dashboard that permission is the creator's, so the
 * pair now refuses on the terms the edit refuses on.
 */
describe('DashboardService — the soft-delete/recover pair is the creator’s, like the edit and the removal', () => {
	const MINE = { id: 'dashboard-1', createdByUserId: 'user-me' };
	const THEIRS = { id: 'dashboard-2', createdByUserId: 'user-other' };
	const LEGACY = { id: 'dashboard-3', createdByUserId: null };

	let service: DashboardService;
	let baseSoftRemove: jest.SpyInstance;
	let baseSoftRecover: jest.SpyInstance;
	let findOne: jest.Mock;

	beforeEach(() => {
		service = Object.create(DashboardService.prototype);
		findOne = jest.fn(async (id: string) => [MINE, THEIRS, LEGACY].find((row) => row.id === id));
		(service as any).findOneByIdString = findOne;
		baseSoftRemove = jest.spyOn(CrudService.prototype, 'softRemove').mockResolvedValue({ deletedAt: new Date() } as any);
		baseSoftRecover = jest.spyOn(CrudService.prototype, 'softRecover').mockResolvedValue({ deletedAt: null } as any);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-me');
	});

	afterEach(() => jest.restoreAllMocks());

	it('lets the creator withdraw and restore their own dashboard, through the base methods', async () => {
		await expect(service.softRemove(MINE.id)).resolves.toEqual({ deletedAt: expect.any(Date) });
		await expect(service.softRecover(MINE.id)).resolves.toEqual({ deletedAt: null });

		expect(baseSoftRemove).toHaveBeenCalledWith(MINE.id, undefined, undefined);
		expect(baseSoftRecover).toHaveBeenCalledWith(MINE.id, undefined, undefined);
	});

	it('refuses to withdraw a colleague’s dashboard, with the 403 the edit answers, and writes nothing', async () => {
		await expect(service.softRemove(THEIRS.id)).rejects.toBeInstanceOf(ForbiddenException);
		expect(baseSoftRemove).not.toHaveBeenCalled();
	});

	it('refuses to restore a colleague’s dashboard, reading the withdrawn row to know whose it is', async () => {
		await expect(service.softRecover(THEIRS.id)).rejects.toBeInstanceOf(ForbiddenException);
		expect(baseSoftRecover).not.toHaveBeenCalled();
		// The row to restore is withdrawn, so the ownership read must include withdrawn rows.
		expect(findOne).toHaveBeenCalledWith(THEIRS.id, { withDeleted: true });
	});

	it('refuses a dashboard with no recorded creator, as the edit does', async () => {
		await expect(service.softRemove(LEGACY.id)).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.softRecover(LEGACY.id)).rejects.toBeInstanceOf(ForbiddenException);
		expect(baseSoftRemove).not.toHaveBeenCalled();
		expect(baseSoftRecover).not.toHaveBeenCalled();
	});
});
