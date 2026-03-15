import { Injectable, Logger } from '@nestjs/common';
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

/**
 * Union type for all task metadata find input interfaces.
 */
export type TaskMetadataFindInput =
	| ITaskStatusFindInput
	| ITaskPriorityFindInput
	| ITaskSizeFindInput
	| IIssueTypeFindInput
	| ITaskVersionFindInput;

/**
 * Abstract base service for task metadata entities (statuses, priorities, sizes, issue types, versions, etc.).
 *
 * Provides common CRUD operations with hierarchical fallback logic:
 * tenant → organization → project → team, falling back to system defaults when no match is found.
 */
@Injectable()
export class TaskMetadataService<BaseEntity extends TenantBaseEntity> extends TenantAwareCrudService<BaseEntity> {
	/** Scope columns for hierarchical filtering (tenant → org → project → team). */
	protected static readonly SCOPE_COLUMNS = [
		'tenantId',
		'organizationId',
		'projectId',
		'organizationTeamId'
	] as const;

	protected readonly logger = new Logger(this.constructor.name);

	constructor(
		readonly typeOrmBaseEntityRepository: TypeOrmBaseEntityRepository<BaseEntity>,
		readonly mikroOrmBaseEntityRepository: MikroOrmBaseEntityRepository<BaseEntity>,
		readonly knexConnection: KnexConnection
	) {
		super(typeOrmBaseEntityRepository, mikroOrmBaseEntityRepository);
	}

	/**
	 * Fetches entities using Knex.js, falling back to system defaults if none match.
	 *
	 * @param input - Filter parameters.
	 * @returns Paginated result of matching entities.
	 */
	async fetchAllByKnex(input: TaskMetadataFindInput): Promise<IPagination<BaseEntity>> {
		try {
			const first = await this.getOneOrFailByKnex(input);

			if (!first) {
				return await this.getDefaultEntitiesByKnex();
			}

			const items = await this.getManyAndCountByKnex(input);

			// Resolve full icon URLs for items with an icon
			if (items.length > 0) {
				const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
				const provider = store.getProviderInstance();

				await Promise.all(
					items.map(async (item: any) => {
						if (item.icon) {
							item.fullIconUrl = await provider.url(item.icon);
						}
					})
				);
			}

			return { items, total: items.length };
		} catch (error) {
			this.logger.error('Failed to retrieve entities by Knex', error);
			return await this.getDefaultEntitiesByKnex();
		}
	}

	/**
	 * Retrieves entities using TypeORM/MikroORM, falling back to system defaults if none match.
	 *
	 * @param params - Filter parameters.
	 * @returns Paginated result of matching entities.
	 */
	async fetchAll(params: TaskMetadataFindInput): Promise<IPagination<BaseEntity>> {
		try {
			const { organizationId, projectId, organizationTeamId } = params;
			const tenantId = RequestContext.currentTenantId() ?? params.tenantId;

			// No tenant context — return system defaults to prevent cross-tenant leak
			if (!tenantId) {
				return await this.getDefaultEntities();
			}

			const options: FindManyOptions<TaskMetadataFindInput> = {
				where: {
					tenantId,
					organizationId: isNotEmpty(organizationId) ? organizationId : IsNull(),
					projectId: isNotEmpty(projectId) ? projectId : IsNull(),
					organizationTeamId: isNotEmpty(organizationTeamId) ? organizationTeamId : IsNull()
				}
			};

			// Use base class findAll — we supply explicit tenant scoping via the where clause,
			// intentionally bypassing automatic tenant scoping.
			const { items, total } = await super.findAll(options as FindManyOptions<BaseEntity>);

			if (total === 0) {
				return await this.getDefaultEntities();
			}

			return { items, total };
		} catch (error) {
			this.logger.warn(
				`No entities found for params ${JSON.stringify(params)} (${this.ormType}): ${error?.message}`
			);
			return await this.getDefaultEntities();
		}
	}

	/**
	 * Retrieves system default entities (tenantId=null, organizationId=null, isSystem=true).
	 *
	 * Bypasses TenantAwareCrudService scoping by querying the repository directly,
	 * since system defaults have tenantId IS NULL and would otherwise be overwritten
	 * by the automatic tenant filter.
	 *
	 * @returns Paginated result of default system entities.
	 */
	async getDefaultEntities(): Promise<IPagination<BaseEntity>> {
		try {
			const options: FindManyOptions<TaskMetadataFindInput & { isSystem: boolean }> = {
				where: {
					tenantId: IsNull(),
					organizationId: IsNull(),
					projectId: IsNull(),
					organizationTeamId: IsNull(),
					isSystem: true
				}
			};

			let items: BaseEntity[];
			let total: number;

			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const { where, mikroOptions } = parseTypeORMFindToMikroOrm<BaseEntity>(options as FindManyOptions);
					[items, total] = (await this.mikroOrmBaseEntityRepository.findAndCount(where, mikroOptions)) as any;
					items = items.map((entity) => this.serialize(entity));
					break;
				}
				case MultiORMEnum.TypeORM:
					[items, total] = await this.typeOrmBaseEntityRepository.findAndCount(
						options as FindManyOptions<BaseEntity>
					);
					break;
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}

			return { items, total };
		} catch (error) {
			this.logger.error(`Error while getting default entities (${this.ormType})`, error);
			return { items: [], total: 0 };
		}
	}

	/**
	 * Resolves hierarchical scoping fields from request parameters.
	 * TenantId prefers the current session tenant over the request value.
	 *
	 * @param request - Filter parameters.
	 * @returns Array of [column, resolvedValue] tuples for the scope columns.
	 */
	protected getScopeFilters(request: TaskMetadataFindInput): [string, string | null][] {
		return TaskMetadataService.SCOPE_COLUMNS.map((column) => {
			const raw = request[column];
			if (!isNotEmpty(raw)) return [column, null];
			return [column, column === 'tenantId' ? RequestContext.currentTenantId() || raw : raw];
		});
	}

	/**
	 * Builds a TypeORM filter query with hierarchical scoping (tenant → org → project → team).
	 *
	 * @param query - SelectQueryBuilder instance.
	 * @param request - Filter parameters.
	 * @returns The modified query builder.
	 */
	getFilterQuery(
		query: SelectQueryBuilder<BaseEntity>,
		request: TaskMetadataFindInput
	): SelectQueryBuilder<BaseEntity> {
		for (const [column, value] of this.getScopeFilters(request)) {
			if (value !== null) {
				query.andWhere(p(`"${query.alias}"."${column}" = :${column}`), { [column]: value });
			} else {
				query.andWhere(p(`"${query.alias}"."${column}" IS NULL`));
			}
		}

		return query;
	}

	/**
	 * Creates a Knex query builder for the current entity table.
	 *
	 * @param knex - Knex connection instance.
	 * @returns A Knex query builder.
	 */
	createKnexQueryBuilder(knex: KnexConnection) {
		return knex(this.tableName);
	}

	/**
	 * Retrieves the first matching entity using Knex, or undefined if none found.
	 *
	 * @param request - Filter parameters.
	 * @returns The first matching entity or undefined.
	 */
	async getOneOrFailByKnex(request: TaskMetadataFindInput): Promise<BaseEntity | undefined> {
		return await this.createKnexQueryBuilder(this.knexConnection)
			.modify((qb: KnexConnection.QueryBuilder<any, any>) => {
				this.getFilterQueryByKnex(qb, request);
			})
			.first();
	}

	/**
	 * Retrieves all matching entities using Knex.
	 *
	 * @param request - Filter parameters.
	 * @returns Array of matching entities.
	 */
	async getManyAndCountByKnex(request: TaskMetadataFindInput): Promise<KnexConnection.QueryBuilder<any, any>> {
		return await this.createKnexQueryBuilder(this.knexConnection).modify(
			(qb: KnexConnection.QueryBuilder<any, any>) => {
				this.getFilterQueryByKnex(qb, request);
			}
		);
	}

	/**
	 * Retrieves system default entities using Knex.
	 *
	 * @returns Paginated result of default system entities.
	 */
	async getDefaultEntitiesByKnex(): Promise<IPagination<BaseEntity>> {
		const items = await this.createKnexQueryBuilder(this.knexConnection).modify(
			(qb: KnexConnection.QueryBuilder<any, any>) => {
				qb.where('isSystem', true);
				qb.whereNull('tenantId');
				qb.whereNull('organizationId');
				qb.whereNull('projectId');
				qb.whereNull('organizationTeamId');
			}
		);

		return { items, total: items.length };
	}

	/**
	 * Builds a Knex filter query with hierarchical scoping (tenant → org → project → team).
	 *
	 * @param qb - Knex query builder.
	 * @param request - Filter parameters.
	 */
	getFilterQueryByKnex(qb: KnexConnection.QueryBuilder<any, any>, request: TaskMetadataFindInput) {
		for (const [column, value] of this.getScopeFilters(request)) {
			if (value !== null) {
				qb.where(column, value);
			} else {
				qb.whereNull(column);
			}
		}
	}
}
