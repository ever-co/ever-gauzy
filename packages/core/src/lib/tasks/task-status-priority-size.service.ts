import { Injectable } from '@nestjs/common';
import { Repository as TypeOrmBaseEntityRepository, SelectQueryBuilder, IsNull, FindManyOptions } from 'typeorm';
import { Knex as KnexConnection } from 'knex';
import { isNotEmpty } from '@gauzy/utils';
import {
	FileStorageProviderEnum,
	IIssueTypeFindInput,
	IPagination,
	ITaskPriorityFindInput,
	ITaskSizeFindInput,
	ITaskStatusFindInput,
	ITaskVersionFindInput
} from '@gauzy/contracts';
import { MikroOrmBaseEntityRepository } from '../core/repository/mikro-orm-base-entity.repository';
import { FileStorage } from '../core/file-storage';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { MultiORMEnum, parseTypeORMFindToMikroOrm } from '../core/utils';
import { TenantBaseEntity } from '../core/entities/internal';
import { prepareSQLQuery as p } from './../database/database.helper';

export type FindEntityByParams =
	| ITaskStatusFindInput
	| ITaskPriorityFindInput
	| ITaskSizeFindInput
	| IIssueTypeFindInput
	| ITaskVersionFindInput;

@Injectable()
export class TaskStatusPrioritySizeService<
	BaseEntity extends TenantBaseEntity
> extends TenantAwareCrudService<BaseEntity> {
	constructor(
		readonly typeOrmBaseEntityRepository: TypeOrmBaseEntityRepository<BaseEntity>,
		readonly mikroOrmBaseEntityRepository: MikroOrmBaseEntityRepository<BaseEntity>,
		readonly knexConnection: KnexConnection
	) {
		super(typeOrmBaseEntityRepository, mikroOrmBaseEntityRepository);
	}

	/**
	 * Fetch entities based on specified parameters using Knex.js.
	 * @param input - Parameters for finding entities (IFindEntityByParams).
	 * @returns A Promise resolving to an object with items and total count.
	 */
	async fetchAllByKnex(input: FindEntityByParams): Promise<IPagination<BaseEntity>> {
		try {
			// Ensure at least one record matches the specified parameters
			const first = await this.getOneOrFailByKnex(input);

			if (!first) {
				console.log(`No entities found matching the specified parameters ${JSON.stringify(input)}`);
				return await this.getDefaultEntitiesByKnex();
			}

			// Perform the Knex query to fetch entities and their count
			const items = await this.getManyAndCountByKnex(input);

			if (items.length > 0) {
				// this call depends on tenant and organization, so we can't make it global
				const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);

				const provider = store.getProviderInstance();

				// Fetch fullIconUrl for items with an icon
				await Promise.all(
					items.map(async (item: any) => {
						if (item.icon) {
							item.fullIconUrl = await provider.url(item.icon);
						}
					})
				);
			}

			// Calculate the total count of items
			const total = items.length;

			// Return an object containing the items and total count
			return { items, total };
		} catch (error) {
			console.error('Failed to retrieve entities based on the specified parameters', error);
			// If an error occurs during the query, fallback to default entities
			return await this.getDefaultEntitiesByKnex();
		}
	}

	/**
	 * Retrieves entities based on the provided parameters.
	 *
	 * @param params - Parameters for filtering (IFindEntityByParams).
	 * @returns A Promise that resolves to an object conforming to the IPagination interface.
	 */
	async fetchAll(params: FindEntityByParams): Promise<IPagination<BaseEntity>> {
		try {
			// Destructuring the organizationId, projectId, and organizationTeamId from the provided parameters.
			const { organizationId, projectId, organizationTeamId } = params;

			// Convert the where clause to FindManyOptions<BaseEntity>
			const options: FindManyOptions<FindEntityByParams> = {
				// Construct the where clause based on parameters
				where: {
					tenantId: isNotEmpty(params.tenantId)
						? RequestContext.currentTenantId() || params.tenantId
						: IsNull(),
					organizationId: isNotEmpty(organizationId) ? organizationId : IsNull(),
					projectId: isNotEmpty(projectId) ? projectId : IsNull(),
					organizationTeamId: isNotEmpty(organizationTeamId) ? organizationTeamId : IsNull()
				}
			};

			// Initialize variables to store the retrieved items and total count.
			let items: BaseEntity[]; // Array to store retrieved items
			let total: number; // Variable to store total count of items

			// Determine the ORM type and execute the appropriate logic accordingly.
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					// Parse the where clause for MikroORM
					const mikroOrmOptions = parseTypeORMFindToMikroOrm<BaseEntity>(
						options as FindManyOptions<BaseEntity>
					);
					// Retrieve entities and their count
					[items, total] = await this.mikroOrmRepository.findAndCount(mikroOrmOptions.where);
					// Optionally serialize the items
					items = items.map((item: BaseEntity) => this.serialize(item));
					break;
				case MultiORMEnum.TypeORM:
					// Retrieve entities and their count
					[items, total] = await this.typeOrmRepository.findAndCount(options as FindManyOptions<BaseEntity>);
					break;
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}

			// If no entities are found, fallback to default entities
			if (total === 0) {
				return await this.getDefaultEntities();
			}

			return { items, total };
		} catch (error) {
			console.log(
				`No entities found matching the specified parameters ${JSON.stringify(params)} for ${this.ormType}: `,
				error?.message
			);
			// If an error occurs during the retrieval, fallback to default entities
			return await this.getDefaultEntities();
		}
	}

	/**
	 * Retrieves default entities based on certain criteria.
	 * @returns A promise resolving to an object containing items and total count.
	 */
	async getDefaultEntities(): Promise<IPagination<BaseEntity>> {
		try {
			// Convert the where clause to FindManyOptions<FindEntityByParams>
			const options: FindManyOptions<FindEntityByParams & { isSystem: boolean }> = {
				// Construct the where clause based on parameters
				where: {
					tenantId: IsNull(),
					organizationId: IsNull(),
					projectId: IsNull(),
					organizationTeamId: IsNull(),
					isSystem: true
				}
			};

			// Initialize variables to store the retrieved items and total count.
			let items: BaseEntity[]; // Array to store retrieved items
			let total: number; // Variable to store total count of items

			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					// Parse the where clause for MikroORM
					const { where } = parseTypeORMFindToMikroOrm<BaseEntity>(options as FindManyOptions<BaseEntity>);
					// Retrieve entities and their count
					[items, total] = await this.mikroOrmRepository.findAndCount(where);
					// Optionally serialize the items
					items = items.map((item: BaseEntity) => this.serialize(item));
					break;
				case MultiORMEnum.TypeORM:
					// Retrieve entities and their count
					[items, total] = await this.typeOrmRepository.findAndCount(options as FindManyOptions<BaseEntity>);
					break;
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}

			return { items, total };
		} catch (error) {
			console.error(`Error while getting base entities by ${this.ormType}`, error);
		}
	}

	/**
	 * GET status filter query
	 *
	 * @param query
	 * @param request
	 * @returns
	 */
	getFilterQuery(query: SelectQueryBuilder<BaseEntity>, request: FindEntityByParams): SelectQueryBuilder<BaseEntity> {
		const { organizationId, projectId, organizationTeamId } = request;

		/**
		 * GET by tenant level
		 */
		if (isNotEmpty(request.tenantId)) {
			const tenantId = RequestContext.currentTenantId() || request.tenantId;
			query.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
		} else {
			query.andWhere(p(`"${query.alias}"."tenantId" IS NULL`));
		}
		/**
		 * GET by organization level
		 */
		if (isNotEmpty(organizationId)) {
			query.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
		} else {
			query.andWhere(p(`"${query.alias}"."organizationId" IS NULL`));
		}
		/**
		 * GET by project level
		 */
		if (isNotEmpty(projectId)) {
			query.andWhere(p(`"${query.alias}"."projectId" = :projectId`), { projectId });
		} else {
			query.andWhere(p(`"${query.alias}"."projectId" IS NULL`));
		}

		/**
		 * GET by team level
		 */
		if (isNotEmpty(organizationTeamId)) {
			query.andWhere(p(`"${query.alias}"."organizationTeamId" = :organizationTeamId`), { organizationTeamId });
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
	async getOneOrFailByKnex(request: FindEntityByParams): Promise<BaseEntity | undefined> {
		// Create a Knex query builder
		return await this.createKnexQueryBuilder(this.knexConnection)
			.modify((qb: KnexConnection.QueryBuilder<any, any>) => {
				// Apply filters based on request parameters
				this.getFilterQueryByKnex(qb, request);

				// Log the generated SQL query (for debugging purposes)
				console.log('Get One Or Fail By Knex', qb.toQuery());
			})
			.first(); // Retrieve the first result or undefined
	}

	/**
	 * Retrieves entities and their count using a Knex query.
	 * @param knex - Knex connection instance.
	 * @param request - Request parameters for filtering (IFindEntityByParams).
	 * @returns A Knex query builder with applied filters.
	 */
	async getManyAndCountByKnex(request: FindEntityByParams): Promise<KnexConnection.QueryBuilder<any, any>> {
		// Create a Knex query builder
		return await this.createKnexQueryBuilder(this.knexConnection).modify(
			(qb: KnexConnection.QueryBuilder<any, any>) => {
				// Apply filters based on request parameters
				this.getFilterQueryByKnex(qb, request);

				// Log the generated SQL query (for debugging purposes)
				console.log('Get Many And Count By Knex', qb.toQuery());
			}
		);
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
	getFilterQueryByKnex(qb: KnexConnection.QueryBuilder<any, any>, request: FindEntityByParams) {
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
