import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import {
	ActionTypeEnum,
	BaseEntityEnum,
	ActorTypeEnum,
	IDashboardCreateInput,
	IDashboardUpdateInput,
	ID
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { RequestContext } from '../core/context';
import { Dashboard } from './dashboard.entity';
import { TypeOrmDashboardRepository } from './repository/type-orm-dashboard.repository';
import { MikroOrmDashboardRepository } from './repository/mikro-orm-dashboard.repository';
import { ActivityLogService } from '../activity-log/activity-log.service';

@Injectable()
export class DashboardService extends TenantAwareCrudService<Dashboard> {
	constructor(
		readonly typeOrmDashboardRepository: TypeOrmDashboardRepository,
		readonly mikroOrmDashboardRepository: MikroOrmDashboardRepository,
		private readonly activityLogService: ActivityLogService
	) {
		super(typeOrmDashboardRepository, mikroOrmDashboardRepository);
	}

	/**
	 * Creates a new dashboard
	 *
	 * @param {IDashboardCreateInput} input - The input data for creating a dashboard
	 * @returns {Promise<Dashboard>} The created dashboard
	 */
	async create(input: IDashboardCreateInput): Promise<Dashboard> {
		try {
			const userId = RequestContext.currentUserId();
			const tenantId = RequestContext.currentTenantId();
			const { organizationId } = input;

			// create dashboard
			const dashboard = await super.create({
				...input,
				tenantId,
				creatorId: userId
			});

			// Generate the activity log
			this.activityLogService.logActivity<Dashboard>(
				BaseEntityEnum.Dashboard,
				ActionTypeEnum.Created,
				ActorTypeEnum.User,
				dashboard.id,
				dashboard.name,
				dashboard,
				organizationId,
				tenantId
			);

			return dashboard;
		} catch (error) {
			throw new HttpException(`Failed to create dashboard: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Updates an existing dashboard
	 *
	 * @param {IDashboardUpdateInput} input - The input data for updating a dashboard
	 * @returns {Promise<Dashboard>} The updated dashboard
	 */
	async update(id: ID, input: IDashboardUpdateInput): Promise<Dashboard> {
		const tenantId = RequestContext.currentTenantId() || input.tenantId;

		try {
			const { organizationId } = input;

			// Retrieve existing dashboard
			const existingDashboard = await this.findOneByIdString(id);

			if (!existingDashboard) {
				throw new NotFoundException('Dashboard not found');
			}

			// Update dashboard
			const updatedDashboard = await super.create({
				...input,
				id
			});

			// Generate the activity log
			this.activityLogService.logActivity<Dashboard>(
				BaseEntityEnum.Dashboard,
				ActionTypeEnum.Updated,
				ActorTypeEnum.User,
				updatedDashboard.id,
				updatedDashboard.name,
				updatedDashboard,
				organizationId,
				tenantId,
				existingDashboard,
				input
			);

			// Return the updated dashboard
			return updatedDashboard;
		} catch (error) {
			throw new HttpException(`Failed to update dashboard: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}
}
