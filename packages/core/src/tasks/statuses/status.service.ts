import {
	Brackets,
	DeleteResult,
	Repository,
	SelectQueryBuilder,
	WhereExpressionBuilder,
} from 'typeorm';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IOrganization, IOrganizationProject, IPagination, IStatus, IStatusFindInput, ITenant } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { TenantAwareCrudService } from '../../core/crud';
import { RequestContext } from './../../core/context';
import { TaskStatus } from './status.entity';
import { DEFAULT_GLOBAL_STATUSES } from './default-global-statuses';

@Injectable()
export class StatusService extends TenantAwareCrudService<TaskStatus> {
	constructor(
		@InjectRepository(TaskStatus)
		protected readonly taskStatusRepository: Repository<TaskStatus>
	) {
		super(taskStatusRepository);
	}

	/**
	 * GET statuses by filters
	 * If parameters not match, retrieve global statuses
	 *
	 * @param params
	 * @returns
	 */
	async findAllStatuses(
		params: IStatusFindInput
	): Promise<IPagination<TaskStatus>> {
		try {
			/**
			 * Find at least one record or get global statuses
			 */
			const cqb = this.repository.createQueryBuilder(this.alias);
			cqb.where((qb: SelectQueryBuilder<TaskStatus>) => {
				this.getFilterStatusQuery(qb, params);
			});
			await cqb.getOneOrFail();

			/**
			 * Find statuses for given params
			 */
			const query = this.repository.createQueryBuilder(this.alias);
			query.where((qb: SelectQueryBuilder<TaskStatus>) => {
				this.getFilterStatusQuery(qb, params);
			});
			const [items, total] = await query.getManyAndCount();
			return { items, total };
		} catch (error) {
			return await this.getGlobalStatuses();
		}
	}

	/**
	 * Few Statuses can't be removed/delete because they are global
	 *
	 * @param id
	 * @returns
	 */
	async delete(id: IStatus['id']): Promise<DeleteResult> {
		return await super.delete(id, {
			where: {
				isSystem: false,
			},
		});
	}

	/**
	 * GET global system statuses
	 *
	 * @returns
	 */
	async getGlobalStatuses(): Promise<IPagination<IStatus>> {
		const query = this.repository.createQueryBuilder(this.alias);
		query.where((qb: SelectQueryBuilder<TaskStatus>) => {
			qb.andWhere(
				new Brackets((bck: WhereExpressionBuilder) => {
					bck.andWhere(`"${qb.alias}"."organizationId" IS NULL`);
					bck.andWhere(`"${qb.alias}"."tenantId" IS NULL`);
					bck.andWhere(`"${qb.alias}"."projectId" IS NULL`);
					bck.andWhere(`"${qb.alias}"."isSystem" = :isSystem`, {
						isSystem: true,
					});
				})
			);
		});
		const [items, total] = await query.getManyAndCount();
		return { items, total };
	}

	/**
	 * GET status filter query
	 *
	 * @param query
	 * @param request
	 * @returns
	 */
	getFilterStatusQuery(
		query: SelectQueryBuilder<TaskStatus>,
		request: IStatusFindInput
	) {
		const { tenantId, organizationId, projectId } = request;
		/**
		 * GET statuses by tenant level
		 */
		if (isNotEmpty(tenantId)) {
			query.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
				tenantId: RequestContext.currentTenantId(),
			});
		} else {
			query.andWhere(`"${query.alias}"."tenantId" IS NULL`);
		}
		/**
		 * GET statuses by organization level
		 */
		if (isNotEmpty(organizationId)) {
			query.andWhere(
				`"${query.alias}"."organizationId" = :organizationId`,
				{
					organizationId,
				}
			);
		} else {
			query.andWhere(`"${query.alias}"."organizationId" IS NULL`);
		}
		/**
		 * GET statuses by project level
		 */
		if (isNotEmpty(projectId)) {
			query.andWhere(`"${query.alias}"."projectId" = :projectId`, {
				projectId,
			});
		} else {
			query.andWhere(`"${query.alias}"."projectId" IS NULL`);
		}
		return query;
	}

	/**
	 * Create bulk statuses for specific tenants
	 *
	 * @param tenants '
	 */
	async bulkCreateTenantsStatus(tenants: ITenant[]): Promise<IStatus[] & TaskStatus[]> {
		const statuses: IStatus[] = [];
		for (const tenant of tenants) {
			for (const status of DEFAULT_GLOBAL_STATUSES) {
				statuses.push(new TaskStatus({ ...status, isSystem: false, tenant }));
			}
		}
		return await this.repository.save(statuses);
	}

	/**
	 * Create bulk statuses for specific organization
	 *
	 * @param organization
	 */
	async bulkCreateOrganizationStatus(organization: IOrganization): Promise<IStatus[] & TaskStatus[]> {
		try {
			const statuses: IStatus[] = [];

			const tenantId = RequestContext.currentTenantId();
			const { items = [] } = await this.findAllStatuses({ tenantId });

			for (const item of items) {
				const { tenantId, name, value, description, icon, color } = item;
				const status = new TaskStatus({
					tenantId,
					name,
					value,
					description,
					icon,
					color,
					organization,
					isSystem: false
				});
				statuses.push(status);
			}
			return await this.repository.save(statuses);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Create bulk statuses for specific organization project
	 *
	 * @param project
	 * @returns
	 */
	async bulkCreateOrganizationProjectStatus(project: IOrganizationProject): Promise<IStatus[] & TaskStatus[]> {
		try {
			const { tenantId, organizationId } = project;

			const statuses: IStatus[] = [];
			const { items = [] } = await this.findAllStatuses({ tenantId, organizationId });

			for (const item of items) {
				const { name, value, description, icon, color } = item;
				const status = new TaskStatus({
					tenantId,
					organizationId,
					name,
					value,
					description,
					icon,
					color,
					project,
					isSystem: false
				});
				statuses.push(status);
			}
			return await this.repository.save(statuses);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
