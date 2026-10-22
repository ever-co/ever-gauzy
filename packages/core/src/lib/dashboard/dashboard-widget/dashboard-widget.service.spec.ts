import '../../core/entities/internal';

import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { TenantAwareCrudService } from '../../core/crud';
import { RequestContext } from '../../core/context/request-context';
import { DashboardWidgetService } from './dashboard-widget.service';

/**
 * `DashboardWidgetService.update` wrapped every error, including the not-found raised by the lookup,
 * in a 400. A missing widget now answers 404, like `DashboardService.update`.
 */
describe('DashboardWidgetService.update', () => {
	let service: DashboardWidgetService;
	let baseCreate: jest.SpyInstance;
	let logActivity: jest.Mock;

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		baseCreate = jest.spyOn(TenantAwareCrudService.prototype, 'create');
		logActivity = jest.fn();
		service = Object.create(DashboardWidgetService.prototype);
		Object.assign(service, { activityLogService: { logActivity } });
	});

	afterEach(() => jest.restoreAllMocks());

	it('answers 404 when the lookup does not find the widget', async () => {
		(service as any).findOneByIdString = jest.fn().mockRejectedValue(new NotFoundException('not found'));

		await expect(service.update('missing', { name: 'Widget' } as any)).rejects.toBeInstanceOf(NotFoundException);
		expect(baseCreate).not.toHaveBeenCalled();
	});

	it('answers 404 when the lookup returns nothing', async () => {
		(service as any).findOneByIdString = jest.fn().mockResolvedValue(null);

		await expect(service.update('missing', { name: 'Widget' } as any)).rejects.toBeInstanceOf(NotFoundException);
		expect(baseCreate).not.toHaveBeenCalled();
	});

	it('still answers 400 when the save fails', async () => {
		(service as any).findOneByIdString = jest.fn().mockResolvedValue({ id: 'widget-1', name: 'Widget' });
		baseCreate.mockRejectedValue(new Error('constraint violation'));

		const error = await service.update('widget-1', { name: 'Widget' } as any).catch((e) => e);

		expect(error).toBeInstanceOf(HttpException);
		expect(error).not.toBeInstanceOf(NotFoundException);
		expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
		expect(logActivity).not.toHaveBeenCalled();
	});
});
