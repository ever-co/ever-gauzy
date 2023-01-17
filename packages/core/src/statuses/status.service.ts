import {
	Brackets,
	DeleteResult,
	Repository,
	SelectQueryBuilder,
	WhereExpressionBuilder,
} from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPagination, IStatus, IStatusFindInput } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { TenantAwareCrudService } from '../core/crud';
import { RequestContext } from './../core/context';
import { Status } from './status.entity';

@Injectable()
export class StatusService extends TenantAwareCrudService<Status> {
	constructor(
		@InjectRepository(Status)
		protected readonly statusRepository: Repository<Status>
	) {
		super(statusRepository);
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
	): Promise<IPagination<Status>> {
		try {
			/**
			 * Find atleast one record or get global statuses
			 */
			const cqb = this.repository.createQueryBuilder(this.alias);
			cqb.where((qb: SelectQueryBuilder<Status>) => {
				this.getFilterStatusQuery(qb, params);
			});
			await cqb.getOneOrFail();

			/**
			 * Find statuses for given params
			 */
			const query = this.repository.createQueryBuilder(this.alias);
			query.where((qb: SelectQueryBuilder<Status>) => {
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
		query.where((qb: SelectQueryBuilder<Status>) => {
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
		query: SelectQueryBuilder<Status>,
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
			query.andWhere(`"${query.alias}"."organizationId" = :organizationId`, {
				organizationId,
			});
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
}
