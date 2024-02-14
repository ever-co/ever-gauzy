import { isNotEmpty } from '@gauzy/common';
import { Injectable } from '@nestjs/common';
import { Brackets, Repository, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { Knex as KnexConnection } from 'knex';
import { EntityRepository } from '@mikro-orm/core';
import {
	IIssueTypeFindInput,
	IPagination,
	ITaskPriorityFindInput,
	ITaskSizeFindInput,
	ITaskStatusFindInput,
	ITaskVersionFindInput
} from '@gauzy/contracts';
import { TenantBaseEntity } from '../core/entities/internal';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { prepareSQLQuery as p } from './../database/database.helper';

export type IFindEntityByParams = | ITaskStatusFindInput | ITaskPriorityFindInput | ITaskSizeFindInput | IIssueTypeFindInput | ITaskVersionFindInput;

@Injectable()
export class TaskStatusPrioritySizeService<BaseEntity extends TenantBaseEntity> extends TenantAwareCrudService<BaseEntity> {
	constructor(
		readonly typeOrmTaskStatusRepository: Repository<BaseEntity>,
		readonly mikroOrmTaskStatusRepository: EntityRepository<BaseEntity>,
		readonly knexConnection: KnexConnection
	) {
		super(typeOrmTaskStatusRepository, mikroOrmTaskStatusRepository);
	}

	/**
	 * Fetch entities based on specified parameters using Knex.js
	 * @param input - Parameters for finding entities
	 * @returns A Promise resolving to an object with items and total count
	 */
	async fetchAllByKnex(input: IFindEntityByParams): Promise<IPagination<BaseEntity>> {
		try {
			const first = await this.getOneOrFailByKnex(this.knexConnection, input);
			if (!first) {
				throw new Error('No entities found matching the specified parameters');
			}

			// Perform the Knex query and await the result
			const items = await this.getManyAndCountByKnex(this.knexConnection, input);

			// Calculate the total count of items
			const total = items.length;

			// Return an object containing the items and total count
			return { items, total };
		} catch (error) {
			// If an error occurs during the query, fallback to default entities
			return await this.getDefaultEntitiesByKnex();
		}
	}

	/**
	 *
	 * @param params
	 * @returns
	 */
	async fetchAll(params: IFindEntityByParams): Promise<IPagination<BaseEntity>> {
		try {
			/**
			 * Find at least one record or get global records
			 */
			const cqb = this.repository.createQueryBuilder(this.alias);
			cqb.where((qb: SelectQueryBuilder<BaseEntity>) => {
				this.getFilterQuery(qb, params);
			});
			await cqb.getOneOrFail();

			/**
			 * Find task sizes/priorities for given params
			 */
			const query = this.repository.createQueryBuilder(this.alias);
			query.where((qb: SelectQueryBuilder<BaseEntity>) => {
				this.getFilterQuery(qb, params);
			});
			const [items, total] = await query.getManyAndCount();
			return { items, total };
		} catch (error) {
			return await this.getDefaultEntities();
		}
	}

	/**
	 * GET global system statuses/priorities/sizes
	 *
	 * @returns
	 */
	async getDefaultEntities(): Promise<IPagination<BaseEntity>> {
		const query = this.repository.createQueryBuilder(this.alias);
		query.where((qb: SelectQueryBuilder<BaseEntity>) => {
			qb.andWhere(
				new Brackets((bck: WhereExpressionBuilder) => {
					bck.andWhere(p(`"${qb.alias}"."organizationId" IS NULL`));
					bck.andWhere(p(`"${qb.alias}"."tenantId" IS NULL`));
					bck.andWhere(p(`"${qb.alias}"."projectId" IS NULL`));
					bck.andWhere(p(`"${qb.alias}"."organizationTeamId" IS NULL`));
					bck.andWhere(p(`"${qb.alias}"."isSystem" = :isSystem`), { isSystem: true });
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
	getFilterQuery(query: SelectQueryBuilder<BaseEntity>, request: IFindEntityByParams) {
		const { organizationId, projectId, organizationTeamId } = request;
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

		/**
		 * GET by tenant level
		 */
		if (isNotEmpty(tenantId)) {
			query.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
		} else {
			query.andWhere(p(`"${query.alias}"."tenantId" IS NULL`));
		}
		/**
		 * GET by organization level
		 */
		if (isNotEmpty(organizationId)) {
			query.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), {
				organizationId
			});
		} else {
			query.andWhere(p(`"${query.alias}"."organizationId" IS NULL`));
		}
		/**
		 * GET by project level
		 */
		if (isNotEmpty(projectId)) {
			query.andWhere(p(`"${query.alias}"."projectId" = :projectId`), {
				projectId
			});
		} else {
			query.andWhere(p(`"${query.alias}"."projectId" IS NULL`));
		}

		/**
		 * GET by team level
		 */
		if (isNotEmpty(organizationTeamId)) {
			query.andWhere(p(`"${query.alias}"."organizationTeamId" = :organizationTeamId`), {
				organizationTeamId
			});
		} else {
			query.andWhere(p(`"${query.alias}"."organizationTeamId" IS NULL`));
		}
		return query;
	}

	/**
	 *
	 * @param knex
	 * @returns
	 */
	createKnexQueryBuilder(knex: KnexConnection) {
		return knex(this.tableName);
	}

	/**
	 *
	 * @param knex
	 * @param request
	 */
	async getOneOrFailByKnex(knex: KnexConnection, request: IFindEntityByParams) {
		return this.createKnexQueryBuilder(knex).modify((qb: KnexConnection.QueryBuilder<any, any>) => {
			this.getFilterQueryByKnex(qb, request);
		}).first();
	}

	/**
	 *
	 * @param knex
	 * @param request
	 * @returns
	 */
	async getManyAndCountByKnex(knex: KnexConnection, request: IFindEntityByParams): Promise<KnexConnection.QueryBuilder<any, any>> {
		return this.createKnexQueryBuilder(knex).modify((qb: KnexConnection.QueryBuilder<any, any>) => {
			this.getFilterQueryByKnex(qb, request);
		});
	}

	/**
	 *
	 * @returns
	 */
	async getDefaultEntitiesByKnex(): Promise<IPagination<BaseEntity>> {
		const query = this.createKnexQueryBuilder(this.knexConnection);
		const items = await query.modify((qb: KnexConnection.QueryBuilder<any, any>) => {
			qb.where('isSystem', true);
			qb.whereNull('tenantId');
			qb.whereNull('organizationId');
			qb.whereNull('projectId');
			qb.whereNull('organizationTeamId');
		});
		const total = items.length;
		return { items, total };
	}

	/**
	 *
	 * @param qb
	 * @param request
	 */
	getFilterQueryByKnex(qb: KnexConnection.QueryBuilder<any, any>, request: IFindEntityByParams) {
		const { organizationId, projectId, organizationTeamId } = request;
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

		/**
		 * GET by tenant level
		 */
		if (isNotEmpty(tenantId)) {
			qb.where('tenantId', tenantId);
		} else {
			qb.whereNull('tenantId');
		}
		/**
		 * GET by organization level
		 */
		if (isNotEmpty(organizationId)) {
			qb.where('organizationId', organizationId);
		} else {
			qb.whereNull('organizationId');
		}
		/**
		 * GET by project level
		 */
		if (isNotEmpty(projectId)) {
			qb.where('projectId', projectId);
		} else {
			qb.whereNull('projectId');
		}

		/**
		 * GET by team level
		 */
		if (isNotEmpty(organizationTeamId)) {
			qb.where('organizationTeamId', organizationTeamId);
		} else {
			qb.whereNull('organizationTeamId');
		}
	}
}
