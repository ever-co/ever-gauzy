import { Injectable, Logger } from '@nestjs/common';
import {
	Repository as TypeOrmBaseEntityRepository,
	SelectQueryBuilder,
	IsNull,
	FindManyOptions,
	FindOptionsWhere,
	UpdateResult
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Knex as KnexConnection } from 'knex';
import { isNotEmpty } from '@gauzy/utils';
import {
	ID,
	IIssueTypeFindInput,
	IPagination,
	ITaskPriorityFindInput,
	ITaskSizeFindInput,
	ITaskStatusFindInput,
	ITaskVersionFindInput
} from '@gauzy/contracts';
import { MikroOrmBaseEntityRepository } from '../core/repository/mikro-orm-base-entity.repository';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { IPartialEntity } from '../core/crud/icrud.service';
import { MultiORMEnum, parseTypeORMFindToMikroOrm } from '../core/utils';
import { TenantBaseEntity } from '../core/entities/internal';
import { IconImageAsset, iconFileUrl, isImageAssetIcon, toStoredImageAssetIcon } from '../image-asset/image-asset-icon';
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
	 * Creates a row, with an uploaded icon stored as {@link withStoredIcon} completes it.
	 *
	 * @param entity - The row to create.
	 * @returns The created row.
	 */
	public async create(entity: IPartialEntity<BaseEntity>): Promise<BaseEntity> {
		return await super.create(await this.withStoredIcon(entity));
	}

	/**
	 * Updates rows, with an uploaded icon stored as {@link withStoredIcon} completes it.
	 *
	 * @param id - The id of the row, or the criteria of the rows.
	 * @param partialEntity - The changes.
	 * @returns The update result, or the updated row.
	 */
	public async update(
		id: string | FindOptionsWhere<BaseEntity>,
		partialEntity: QueryDeepPartialEntity<BaseEntity>
	): Promise<BaseEntity | UpdateResult> {
		return await super.update(id, await this.withStoredIcon(partialEntity, id));
	}

	/**
	 * The values to write, with the icon as the row stores it. A client names an icon the user uploaded
	 * `image-asset:<image asset id>`; the row stores `image-asset:<id>:<provider>:<key>`, completed from the image
	 * asset of the caller's tenant, so that `fullIconUrl` is built with the provider that holds the file and no
	 * listing reads the image asset again (see `image-asset-icon.ts`). Any other icon is written as it is.
	 *
	 * @param input - The values to write.
	 * @param id - What an update names: the row's id, or criteria.
	 * @returns The values, with the stored icon.
	 * @throws BadRequestException when the icon names no image asset of the tenant, or one that cannot be an icon.
	 */
	protected async withStoredIcon<Input extends object>(input: Input, id?: unknown): Promise<Input> {
		const icon = (input as { icon?: unknown })?.icon;
		if (!isImageAssetIcon(icon)) {
			return input;
		}
		const tenantId = RequestContext.currentTenantId();
		const rowId = typeof id === 'string' ? id : null;
		const stored = await toStoredImageAssetIcon(icon, {
			tenantId,
			findAsset: (assetId, assetTenantId) => this.findIconImageAsset(assetId, assetTenantId),
			storedIcon: rowId && tenantId ? () => this.findStoredIcon(rowId, tenantId) : undefined
		});
		return { ...input, icon: stored };
	}

	/**
	 * The image asset an uploaded icon names, in the tenant. Read with Knex: the icon needs the stored key and
	 * provider, not the signed URLs the image asset's load hook would build.
	 *
	 * @param id - The image asset's id.
	 * @param tenantId - The caller's tenant.
	 */
	protected async findIconImageAsset(id: ID, tenantId: ID): Promise<IconImageAsset | undefined> {
		return await this.knexConnection('image_asset')
			.select('id', 'url', 'storageProvider')
			.where({ id, tenantId })
			.whereNull('deletedAt')
			.first();
	}

	/**
	 * The icon a row of the tenant stores now.
	 *
	 * @param id - The row's id.
	 * @param tenantId - The caller's tenant.
	 */
	protected async findStoredIcon(id: ID, tenantId: ID): Promise<string | null | undefined> {
		const row = await this.createKnexQueryBuilder(this.knexConnection)
			.select('icon')
			.where({ id, tenantId })
			.first();
		return row?.icon;
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

			// Raw Knex rows skip the entity load hooks: resolve the full icon URL with the same rules
			// (a library icon such as `hugeicons:done` is no file and gets no URL; an uploaded icon is
			// served by the provider that holds it)
			await Promise.all(
				items.map(async (item: any) => {
					if (item.icon) {
						item.fullIconUrl = await iconFileUrl(item.icon, item.tenantId);
					}
				})
			);

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
				qb.whereNull('deletedAt');
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
		// Raw Knex has no soft-delete filter: exclude soft-deleted rows as the TypeORM / MikroORM paths do
		qb.whereNull('deletedAt');
		for (const [column, value] of this.getScopeFilters(request)) {
			if (value !== null) {
				qb.where(column, value);
			} else {
				qb.whereNull(column);
			}
		}
	}
}
