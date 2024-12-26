import { Injectable } from '@nestjs/common';

import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import {
	ActionTypeEnum,
	BaseEntityEnum,
	ActorTypeEnum,
	IDashboardWidgetCreateInput,
	IDashboardWidgetUpdateInput,
	ID
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../../core/crud';
import { RequestContext } from '../../core/context';
import { DashboardWidget } from './dashboard-widget.entity';
import { TypeOrmDashboardWidgetRepository } from './repository/type-orm-dashboard-widget.repository';
import { MikroOrmDashboardWidgetRepository } from './repository/mikro-orm-dashboard-widget.repository';
import { ActivityLogService } from '../../activity-log/activity-log.service';

@Injectable()
export class DashboardWidgetService extends TenantAwareCrudService<DashboardWidget> {
	constructor(
		readonly typeOrmDashboardWidgetRepository: TypeOrmDashboardWidgetRepository,
		readonly mikroOrmDashboardWidgetRepository: MikroOrmDashboardWidgetRepository,
		private readonly activityLogService: ActivityLogService
	) {
		super(typeOrmDashboardWidgetRepository, mikroOrmDashboardWidgetRepository);
	}

	/**
	 * Creates a new dashboard widget
	 *
	 * @param {IDashboardWidgetCreateInput} input - The input data for creating a dashboard widget
	 * @returns {Promise<DashboardWidget>} The created dashboard widget
	 */
	async create(input: IDashboardWidgetCreateInput): Promise<DashboardWidget> {
		try {
			const employeeId = input.employeeId || RequestContext.currentEmployeeId();
			const tenantId = RequestContext.currentTenantId();
			const { organizationId } = input;

			// create dashboard widget
			const dashboardWidget = await super.create({
				...input,
				employeeId,
				tenantId
			});

			// Generate the activity log
			this.activityLogService.logActivity<DashboardWidget>(
				BaseEntityEnum.DashboardWidget,
				ActionTypeEnum.Created,
				ActorTypeEnum.User,
				dashboardWidget.id,
				dashboardWidget.name,
				dashboardWidget,
				organizationId,
				tenantId
			);

			// Return the created widget
			return dashboardWidget;
		} catch (error) {
			throw new HttpException(`Failed to create dashboard widget: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Updates an existing dashboard widget
	 *
	 * @param {ID} id - The ID of the dashboard widget to update
	 * @param {IDashboardWidgetUpdateInput} input - The input data for updating a dashboard widget
	 * @returns {Promise<DashboardWidget>} The updated dashboard widget
	 */
	async update(id: ID, input: IDashboardWidgetUpdateInput): Promise<DashboardWidget> {
		const tenantId = RequestContext.currentTenantId() || input.tenantId;

		try {
			const { organizationId } = input;

			// Retrieve existing dashboard widget
			const existingDashboardWidget = await this.findOneByIdString(id);

			if (!existingDashboardWidget) {
				throw new NotFoundException(`Dashboard widget with id ${id} not found`);
			}

			// Update the widget
			const updatedWidget = await super.create({
				...input,
				id
			});

			// Log the update activity
			this.activityLogService.logActivity<DashboardWidget>(
				BaseEntityEnum.DashboardWidget,
				ActionTypeEnum.Updated,
				ActorTypeEnum.User,
				updatedWidget.id,
				updatedWidget.name,
				updatedWidget,
				organizationId,
				tenantId,
				existingDashboardWidget,
				input
			);

			return updatedWidget;
		} catch (error) {
			throw new HttpException(`Failed to update dashboard widget: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}
}
