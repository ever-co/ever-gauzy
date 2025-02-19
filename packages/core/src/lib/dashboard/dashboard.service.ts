import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import {
	ActionTypeEnum,
	BaseEntityEnum,
	ActorTypeEnum,
	IDashboardCreateInput,
	IDashboardUpdateInput,
	ID
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { Dashboard } from './dashboard.entity';
import { TypeOrmDashboardRepository } from './repository/type-orm-dashboard.repository';
import { MikroOrmDashboardRepository } from './repository/mikro-orm-dashboard.repository';

@Injectable()
export class DashboardService extends TenantAwareCrudService<Dashboard> {
	constructor(
		readonly typeOrmDashboardRepository: TypeOrmDashboardRepository,
		readonly mikroOrmDashboardRepository: MikroOrmDashboardRepository,
		private readonly _activityLogService: ActivityLogService
	) {
		super(typeOrmDashboardRepository, mikroOrmDashboardRepository);
	}

	/**
	 * Creates a new dashboard.
	 *
	 * @param input - The data required to create a new dashboard.
	 * @returns The created Dashboard entity.
	 * @throws {HttpException} If the creation process fails.
	 */
	async create(input: IDashboardCreateInput): Promise<Dashboard> {
		try {
			// Retrieve the current user ID from the request context
			const createdByUserId = RequestContext.currentUserId();
			// Retrieve the tenant ID from the request context or fallback to the input tenantId
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
			// Destructure organizationId and the rest of the input data
			const { organizationId, ...data } = input;

			// Create the dashboard entity using the base service's create method
			const dashboard = await super.create({
				...data,
				organizationId,
				tenantId,
				createdByUserId
			});

			// Log the creation activity
			this._activityLogService.logActivity<Dashboard>(
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
			// Log the error for debugging purposes
			console.error(`Failed to create dashboard: ${error.message}`);
			// Throw an HTTP exception with a BAD_REQUEST status
			throw new HttpException(`Failed to create dashboard: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Updates an existing dashboard.
	 *
	 * @param id - The unique identifier of the dashboard to update.
	 * @param input - The data to update the dashboard with.
	 * @returns A promise that resolves to the updated Dashboard entity.
	 * @throws {NotFoundException} If the dashboard with the given ID does not exist.
	 * @throws {HttpException} If the update process fails.
	 */
	async update(id: ID, input: IDashboardUpdateInput): Promise<Dashboard> {
		try {
			// Retrieve the tenant ID from the request context or fallback to the input tenantId
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
			// Destructure organizationId and the rest of the input data
			const { organizationId, ...data } = input;

			// Retrieve the existing dashboard by ID
			const dashboard = await this.findOneByIdString(id);

			// If the dashboard does not exist, throw a NotFoundException
			if (!dashboard) {
				console.log(`Dashboard with ID ${id} does not exist`);
				throw new NotFoundException(`Dashboard with ID ${id} does not exist`);
			}

			// Update the dashboard using the base service's create method
			const updatedDashboard = await super.create({
				...data,
				tenantId,
				organizationId,
				id
			});

			// Log the update activity
			this._activityLogService.logActivity<Dashboard>(
				BaseEntityEnum.Dashboard,
				ActionTypeEnum.Updated,
				ActorTypeEnum.User,
				updatedDashboard.id,
				updatedDashboard.name,
				updatedDashboard,
				organizationId,
				tenantId,
				dashboard,
				input
			);

			// Return the updated dashboard
			return updatedDashboard;
		} catch (error) {
			// Log the error and throw an HttpException
			console.error('Error while updating dashboard:', error);
			throw new HttpException(`Failed to update dashboard: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}
}
