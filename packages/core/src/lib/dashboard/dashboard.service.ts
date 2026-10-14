import { ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import {
	ActionTypeEnum,
	BaseEntityEnum,
	ActorTypeEnum,
	IDashboard,
	IDashboardCreateInput,
	IDashboardUpdateInput,
	ID
} from '@gauzy/contracts';
import { DeleteResult, SaveOptions } from 'typeorm';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { IFindOneOptions } from '../core/crud/icrud.service';
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
			// Retrieve the tenant ID from the request context or fallback to the input tenantId
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
			// Destructure organizationId and the rest of the input data
			const { organizationId, ...data } = input;

			// Create the dashboard entity using the base service's create method
			const dashboard = await super.create({
				...data,
				organizationId,
				tenantId
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

			// Dashboards are personal: only the user who created a dashboard may modify it
			this.checkOwnership(dashboard);

			// When promoting a dashboard to be the default one,
			// demote any other default dashboards of the same user first
			if (input.isDefault === true) {
				await this.resetDefaultDashboards(dashboard);
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
			// Preserve the original HTTP semantics for ownership violations
			// and missing dashboards (403/404, not a generic 400)
			if (error instanceof ForbiddenException || error instanceof NotFoundException) {
				throw error;
			}
			// Log the error and throw an HttpException
			console.error('Error while updating dashboard:', error);
			throw new HttpException(`Failed to update dashboard: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Deletes a dashboard by ID, ensuring the requesting user owns it.
	 *
	 * @param id - The unique identifier of the dashboard to delete.
	 * @returns The delete result.
	 * @throws {ForbiddenException} If the dashboard belongs to another user.
	 */
	async delete(id: ID): Promise<DeleteResult> {
		// Retrieve the existing dashboard by ID
		const dashboard = await this.findOneByIdString(id);
		if (!dashboard) {
			throw new NotFoundException(`Dashboard with ID ${id} does not exist`);
		}

		// Dashboards are personal: only the user who created a dashboard may delete it
		this.checkOwnership(dashboard);

		return await super.delete(id);
	}

	/**
	 * Withdraws a dashboard without removing the row (`DELETE /dashboard/:id/soft`, `softDeleteDashboard`), on the
	 * terms the edit and the removal above state: dashboards are personal, so only their creator may withdraw one.
	 *
	 * The CRUD base's soft removal checks the tenant and nothing else, so without this a member who may not edit or
	 * delete a colleague's dashboard could still withdraw it through the inherited route. The refusal is raised
	 * before the base method runs, because the base rethrows whatever fails inside it as a 404.
	 *
	 * @param id - The dashboard to withdraw.
	 * @param options - Find options, passed to the base method unchanged.
	 * @param saveOptions - Save options, passed to the base method unchanged.
	 * @returns The withdrawn dashboard.
	 * @throws {ForbiddenException} If the dashboard belongs to another user.
	 */
	public async softRemove(id: ID, options?: IFindOneOptions<Dashboard>, saveOptions?: SaveOptions): Promise<Dashboard> {
		this.checkOwnership(await this.findOneByIdString(id));

		return super.softRemove(id, options, saveOptions);
	}

	/**
	 * Restores a withdrawn dashboard (`PUT /dashboard/:id/recover`, `recoverDashboard`) — again only for its
	 * creator. The ownership read includes withdrawn rows, since the row to restore is one.
	 *
	 * @param id - The dashboard to restore.
	 * @param options - Find options, passed to the base method unchanged.
	 * @param saveOptions - Save options, passed to the base method unchanged.
	 * @returns The restored dashboard.
	 * @throws {ForbiddenException} If the dashboard belongs to another user.
	 */
	public async softRecover(id: ID, options?: IFindOneOptions<Dashboard>, saveOptions?: SaveOptions): Promise<Dashboard> {
		this.checkOwnership(await this.findOneByIdString(id, { withDeleted: true }));

		return super.softRecover(id, options, saveOptions);
	}

	/**
	 * Ensures the current user is the creator of the given dashboard.
	 *
	 * @param dashboard - The dashboard to verify ownership of.
	 * @throws {ForbiddenException} If the dashboard was created by another user.
	 */
	private checkOwnership(dashboard: IDashboard): void {
		const currentUserId = RequestContext.currentUserId();
		// Deny when either identity is missing — an orphaned/legacy dashboard
		// must not become manageable by arbitrary users.
		if (!dashboard.createdByUserId || !currentUserId || dashboard.createdByUserId !== currentUserId) {
			throw new ForbiddenException('You can only manage your own dashboards');
		}
	}

	/**
	 * Demotes all default dashboards of the dashboard's creator (within the same
	 * tenant/organization), so that at most one dashboard is default per user.
	 *
	 * Uses `find` + `save` (via `super.create`) to stay ORM-agnostic (TypeORM/MikroORM).
	 *
	 * @param dashboard - The dashboard being promoted to default.
	 */
	private async resetDefaultDashboards(dashboard: IDashboard): Promise<void> {
		const { tenantId, organizationId, createdByUserId, id } = dashboard;

		// Find all other default dashboards of the same user
		const { items: defaults } = await this.findAll({
			where: { tenantId, organizationId, createdByUserId, isDefault: true }
		});

		// Demote each of them (except the one being promoted)
		await Promise.all(
			defaults
				.filter((item: IDashboard) => item.id !== id)
				.map((item: IDashboard) => super.create({ id: item.id, isDefault: false }))
		);
	}
}
