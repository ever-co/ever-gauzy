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
	 * Fetch entities based on specified parameters using Knex.js.
	 * @param input - Parameters for finding entities (IFindEntityByParams).
	 * @returns A Promise resolving to an object with items and total count.
	 */
	async fetchAllByKnex(input: IFindEntityByParams): Promise<IPagination<BaseEntity>> {
		try {
			// Attempt to get at least one record that matches the specified parameters
			const first = await this.getOneOrFailByKnex(this.knexConnection, input);

			// If no record is found, throw an error
			if (!first) {
				throw new Error('No entities found matching the specified parameters');
			}

			// Perform the Knex query to fetch entities and their count
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
	 * Retrieves entities based on the provided parameters.
	 * @param params - Parameters for filtering (IFindEntityByParams).
	 * @returns A Promise that resolves to an object conforming to the IPagination interface.
	 */
	async fetchAll(params: IFindEntityByParams): Promise<IPagination<BaseEntity>> {
		try {
			/**
			 * Find at least one record or get global records
			 */
			const checkQueryBuilder = this.repository.createQueryBuilder(this.alias);
			checkQueryBuilder.where((qb: SelectQueryBuilder<BaseEntity>) => {
				// Apply filters based on request parameters
				this.getFilterQuery(qb, params);
			});
			await checkQueryBuilder.getOneOrFail(); // Attempt to retrieve at least one record

			/**
			 * Find task sizes/priorities for given params
			 */
			const queryBuilder = this.repository.createQueryBuilder(this.alias);
			queryBuilder.where((qb: SelectQueryBuilder<BaseEntity>) => {
				// Apply filters based on request parameters
				this.getFilterQuery(qb, params);
			});
			const [items, total] = await queryBuilder.getManyAndCount(); // Retrieve entities and their count
			return { items, total };
		} catch (error) {
			// If an error occurs during the retrieval, fallback to default entities
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
	 * Creates a Knex query builder for a specific table.
	 * @param knex - Knex connection instance.
	 * @returns A Knex query builder for the specified table.
	 */
	createKnexQueryBuilder(knex: KnexConnection) {
		// Create and return a Knex query builder for the specified table
		return knex(this.tableName);
	}

	/**
	 * Retrieves a single entity or fails if none is found using a Knex query.
	 * @param knex - Knex connection instance.
	 * @param request - Request parameters for filtering (IFindEntityByParams).
	 * @returns A Promise that resolves to the first entity or rejects if none is found.
	 */
	async getOneOrFailByKnex(knex: KnexConnection, request: IFindEntityByParams) {
		// Create a Knex query builder
		return this.createKnexQueryBuilder(knex).modify((qb: KnexConnection.QueryBuilder<any, any>) => {
			// Apply filters based on request parameters
			this.getFilterQueryByKnex(qb, request);

			// Log the generated SQL query (for debugging purposes)
			console.log(qb.toQuery(), 'Get One Or Fail By Knex');
		}).first(); // Retrieve the first result or undefined
	}

	/**
	 * Retrieves entities and their count using a Knex query.
	 * @param knex - Knex connection instance.
	 * @param request - Request parameters for filtering (IFindEntityByParams).
	 * @returns A Knex query builder with applied filters.
	 */
	async getManyAndCountByKnex(knex: KnexConnection, request: IFindEntityByParams): Promise<KnexConnection.QueryBuilder<any, any>> {
		// Create a Knex query builder
		return this.createKnexQueryBuilder(knex).modify((qb: KnexConnection.QueryBuilder<any, any>) => {
			// Apply filters based on request parameters
			this.getFilterQueryByKnex(qb, request);

			// Log the generated SQL query (for debugging purposes)
			console.log(qb.toQuery(), 'Get Many And Count By Knex');
		});
	}

	/**
	 * Retrieves default entities using a Knex query.
	 * @returns A Promise that resolves to an object conforming to the IPagination interface.
	 */
	async getDefaultEntitiesByKnex(): Promise<IPagination<BaseEntity>> {
		// Create a Knex query builder
		const query = this.createKnexQueryBuilder(this.knexConnection);

		// Modify the query to filter default entities
		const items = await query.modify((qb: KnexConnection.QueryBuilder<any, any>) => {
			// Filter by isSystem property being true
			qb.where('isSystem', true);

			// Filter by null values for tenantId, organizationId, projectId, and organizationTeamId
			qb.whereNull('tenantId');
			qb.whereNull('organizationId');
			qb.whereNull('projectId');
			qb.whereNull('organizationTeamId');
		});

		// Calculate the total number of items retrieved from the query result
		const total = items.length;

		// Return an object containing the items and the total count, conforming to the IPagination interface
		return { items, total };
	}

	/**
	 * Builds a filter query for a Knex query builder based on the provided parameters.
	 * @param qb - Knex query builder.
	 * @param request - Request parameters for filtering (IFindEntityByParams).
	 */
	getFilterQueryByKnex(qb: KnexConnection.QueryBuilder<any, any>, request: IFindEntityByParams) {
		// Destructure request parameters
		const { organizationId, projectId, organizationTeamId } = request;

		// Obtain the current tenant ID from the RequestContext or fallback to the tenantId from the request
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
