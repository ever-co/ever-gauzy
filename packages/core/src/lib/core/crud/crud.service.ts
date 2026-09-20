// Modified code from https://github.com/xmlking/ngx-starter-kit.
// Original license: MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Original copyright: Copyright (c) 2018 Sumanth Chinthagunta

import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
	DeepPartial,
	DeleteResult,
	FindManyOptions,
	FindOneOptions,
	FindOptionsWhere,
	In,
	Repository,
	SaveOptions,
	UpdateResult
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Collection, CreateOptions, FilterQuery as MikroFilterQuery, RequiredEntityData, wrap } from '@mikro-orm/core';
import { AssignOptions } from '@mikro-orm/knex';
import { ID, IPagination } from '@gauzy/contracts';
import { BaseEntity, SoftDeletableBaseEntity } from '../entities/internal';
import { multiORMCreateQueryBuilder } from '../../core/orm/query-builder/query-builder.factory';
import { IQueryBuilder } from '../../core/orm/query-builder/iquery-builder';
import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import {
	MultiORM,
	MultiORMEnum,
	concatIdToWhere,
	getORMType,
	parseFindOptionsRelations,
	parseFindOptionsSelect,
	parseTypeORMFindOptions,
	parseTypeORMFindToMikroOrm
} from './../../core/utils';
import { parseTypeORMFindCountOptions } from './utils';
import { assertCriteriaHasPredicate } from './criteria.helper';
import { assertSensitiveRelationsAllowed } from '../util/sensitive-relations.helper';
import { redactDatabaseError, safeErrorMessage, toClientSafeError } from '../errors/database-error';
import {
	ICountByOptions,
	ICountOptions,
	ICrudService,
	IFindManyOptions,
	IFindOneOptions,
	IFindWhereOptions,
	IPartialEntity,
	IUpdateCriteria
} from './icrud.service';
import { ITryRequest } from './try-request';

// Get the type of the Object-Relational Mapping (ORM) used in the application.
const ormType: MultiORM = getORMType();

export abstract class CrudService<T extends BaseEntity> implements ICrudService<T> {
	constructor(
		protected readonly typeOrmRepository: Repository<T>,
		protected readonly mikroOrmRepository: MikroOrmBaseEntityRepository<T>
	) {}

	/**
	 * Get the table name from the repository metadata.
	 * @returns {string} The table name.
	 */
	public get tableName(): string {
		return this.typeOrmRepository.metadata.tableName;
	}

	/**
	 * Get the ORM type.
	 * @returns {MultiORM} The ORM type.
	 */
	public get ormType(): MultiORM {
		return ormType;
	}

	/**
	 * Creates an ORM-specific query builder for the repository, supporting MikroORM and TypeORM.
	 *
	 * @param alias - Optional alias for the primary table in the query.
	 * @returns An `IQueryBuilder<T>` instance suitable for the repository's ORM type.
	 * @throws Error if the ORM type is not implemented.
	 */
	public createQueryBuilder(alias?: string): IQueryBuilder<T> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				return multiORMCreateQueryBuilder<T>(
					this.mikroOrmRepository as any,
					this.ormType as MultiORMEnum,
					alias
				);

			case MultiORMEnum.TypeORM:
				return multiORMCreateQueryBuilder<T>(this.typeOrmRepository, this.ormType as MultiORMEnum, alias);

			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
	}

	/**
	 * Enforces the sensitive-relation permission table on a read whose `relations` option may have
	 * come from the client.
	 *
	 * `SensitiveRelationsInterceptor` declares this protection per controller, but it is mounted on a
	 * handful of the controllers that accept `relations` — and every tenant-scoped entity exposes an
	 * `organization` relation, so one unguarded controller is enough to reach the protected rows
	 * (GHSA-c3cj-m3xm-7j5h). Asserting it here, on the path every read goes through, makes the table
	 * hold for entities and controllers that never opted in, present and future.
	 *
	 * TypeORM's `loadRelationIds` option is checked too. It loads the ids of the named relations (or of
	 * EVERY relation, when set to `true`) and is honoured by the read methods, which pass the option
	 * object through to the repository, so on an `Organization` read it would list the ids of the very
	 * rows the table protects. No client uses it, so it is checked strictly.
	 *
	 * @param options - The find-options about to be issued; ignored when it carries neither `relations`
	 *                  nor `loadRelationIds`.
	 * @throws ForbiddenException when a requested relation requires a permission the caller lacks.
	 */
	protected assertRelationsPermitted(options?: unknown): void {
		if (!options || typeof options !== 'object') {
			return;
		}
		const metadata = this.typeOrmRepository?.metadata;

		// `relations` is carried by both the TypeORM and the MikroORM option shapes; the union itself
		// does not declare it, hence the read through a widened type.
		const { relations, loadRelationIds } = options as { relations?: unknown; loadRelationIds?: unknown };
		if (relations) {
			assertSensitiveRelationsAllowed(metadata, relations);
		}

		if (loadRelationIds) {
			const named =
				typeof loadRelationIds === 'object' ? (loadRelationIds as { relations?: unknown }).relations : undefined;
			// Only a real array names its relations exactly: TypeORM filters with `relations.indexOf(propertyPath)`,
			// so a STRING (`?loadRelationIds[relations]=all-payments-list`) matches every relation whose name is a
			// substring of it, and a missing or null list loads them all. Anything but an array is therefore
			// checked as a request for the ids of every relation.
			assertSensitiveRelationsAllowed(
				metadata,
				Array.isArray(named) ? named : (metadata?.relations ?? []).map((relation) => relation.propertyPath)
			);
		}
	}

	/**
	 * Count the number of entities based on the provided options.
	 *
	 * @param options - Options for counting entities.
	 * @returns A Promise that resolves to the count of entities.
	 */
	public async count(options?: ICountOptions<T>): Promise<number> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>(options as FindManyOptions);
				return await this.mikroOrmRepository.count(where, mikroOptions);
			case MultiORMEnum.TypeORM:
				const typeormOptions = parseTypeORMFindCountOptions<T>(options as FindManyOptions);
				return await this.typeOrmRepository.count(typeormOptions as FindManyOptions);
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
	}

	/**
	 * Counts entities that match given options.
	 * Useful for pagination.
	 *
	 * @param options
	 * @returns
	 */
	public async countBy(options?: ICountByOptions<T>): Promise<number> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>({ where: options } as FindManyOptions);
				return await this.mikroOrmRepository.count(where, mikroOptions);
			case MultiORMEnum.TypeORM:
				const typeormOptions = parseTypeORMFindCountOptions<T>({ where: options } as FindManyOptions);
				return await this.typeOrmRepository.count(typeormOptions as FindManyOptions);
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
	}

	/**
	 * Finds entities that match given find options.
	 * Also counts all entities that match given conditions,
	 * but ignores pagination settings (from and take options).
	 *
	 * @param options
	 * @returns
	 */
	public async findAll(options?: IFindManyOptions<T>): Promise<IPagination<T>> {
		this.assertRelationsPermitted(options);

		let total: number;
		let items: T[];

		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>(options as FindManyOptions);
				[items, total] = (await this.mikroOrmRepository.findAndCount(where, mikroOptions)) as any;
				items = items.map((entity: T) => this.serialize(entity)) as T[];
				break;
			case MultiORMEnum.TypeORM:
				[items, total] = await this.typeOrmRepository.findAndCount(
					parseTypeORMFindOptions(options as FindManyOptions<T>)
				);
				break;
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}

		return { items, total };
	}

	/**
	 * Finds entities that match given find options.
	 *
	 * @param options
	 * @returns
	 */
	public async find(options?: IFindManyOptions<T>): Promise<T[]> {
		this.assertRelationsPermitted(options);

		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>(options as FindManyOptions);
				const items = await this.mikroOrmRepository.find(where, mikroOptions);
				return items.map((entity: T) => this.serialize(entity)) as T[];
			case MultiORMEnum.TypeORM:
				return await this.typeOrmRepository.find(parseTypeORMFindOptions(options as FindManyOptions<T>));
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
	}

	/**
	 * Finds entities that match given find options.
	 * Also counts all entities that match given conditions,
	 * But includes pagination settings
	 *
	 * @param options
	 * @returns
	 */
	public async paginate(options?: IFindManyOptions<T>): Promise<IPagination<T>> {
		this.assertRelationsPermitted(options);

		try {
			let total: number;
			let items: T[];

			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>(options as FindManyOptions);
					[items, total] = (await this.mikroOrmRepository.findAndCount(where, mikroOptions)) as any;
					items = items.map((entity) => this.serialize(entity)) as T[];
					break;
				case MultiORMEnum.TypeORM:
					// Normalize legacy string-array `relations`/`select` to object form before hitting TypeORM.
					const typeOrmOptions = parseTypeORMFindOptions(options as FindManyOptions<T>);
					[items, total] = await this.typeOrmRepository.findAndCount({
						skip:
							typeOrmOptions && typeOrmOptions.skip
								? typeOrmOptions.take * (typeOrmOptions.skip - 1)
								: 0,
						take: typeOrmOptions && typeOrmOptions.take ? typeOrmOptions.take : 10,
						...(typeOrmOptions && typeOrmOptions.select ? { select: typeOrmOptions.select } : {}),
						...(typeOrmOptions && typeOrmOptions.relations
							? { relations: typeOrmOptions.relations }
							: {}),
						...(typeOrmOptions && typeOrmOptions.where ? { where: typeOrmOptions.where } : {}),
						...(typeOrmOptions && typeOrmOptions.order ? { order: typeOrmOptions.order } : {}),
						...(typeOrmOptions && typeOrmOptions.withDeleted
							? { withDeleted: typeOrmOptions.withDeleted }
							: {})
					});
					break;
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}

			return { items, total };
		} catch (error) {
			console.log(redactDatabaseError(error));
			throw new BadRequestException(toClientSafeError(error));
		}
	}

	/*
	|--------------------------------------------------------------------------
	| @FindOneOrFail
	|--------------------------------------------------------------------------
	*/

	/**
	 * Finds first entity by a given find options.
	 * If entity was not found in the database - rejects with error.
	 *
	 * @param id
	 * @param options
	 * @returns
	 */
	public async findOneOrFailByIdString(id: string, options?: IFindOneOptions<T>): Promise<ITryRequest<T>> {
		// Asserted outside the try: the catch below turns any throw into `{ success: false }`, which
		// would swallow the ForbiddenException instead of refusing the read.
		this.assertRelationsPermitted(options);

		try {
			// A lookup "by id" with no id must not become a lookup for ANY row: TypeORM omits an
			// undefined where value (and used to omit null), so `where: { id }` degraded to
			// `SELECT ... LIMIT 1` and returned an arbitrary record (GHSA-44pv-34gx-q9p4 class).
			if (!id) {
				throw new NotFoundException(`The requested record was not found`);
			}
			let record: T;
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>(options as FindManyOptions);
					record = (await this.mikroOrmRepository.findOneOrFail(
						concatIdToWhere(id, where),
						mikroOptions
					)) as any;
					break;
				case MultiORMEnum.TypeORM:
					options = options as FindOneOptions<T>;
					record = await this.typeOrmRepository.findOneOrFail({
						where: {
							id,
							...(options && options.where ? options.where : {})
						},
						...(options && options.select ? { select: parseFindOptionsSelect(options.select) } : {}),
						...(options && options.relations
							? { relations: parseFindOptionsRelations(options.relations) }
							: []),
						...(options && options.order ? { order: options.order } : {})
					} as FindOneOptions<T>);
					break;
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
			return {
				success: true,
				record: this.serialize(record)
			};
		} catch (error) {
			return {
				success: false,
				error
			};
		}
	}

	/**
	 * Finds first entity by a given find options.
	 * If entity was not found in the database - rejects with error.
	 *
	 * @param options
	 * @returns
	 */
	public async findOneOrFailByOptions(options: IFindOneOptions<T>): Promise<ITryRequest<T>> {
		// See findOneOrFailByIdString: the catch below would swallow the ForbiddenException.
		this.assertRelationsPermitted(options);

		try {
			let record: T;
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>(options as FindManyOptions);
					record = (await this.mikroOrmRepository.findOneOrFail(where, mikroOptions)) as any;
					break;
				case MultiORMEnum.TypeORM:
					record = await this.typeOrmRepository.findOneOrFail(
						parseTypeORMFindOptions(options as FindOneOptions<T>)
					);
					break;
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
			return {
				success: true,
				record: this.serialize(record)
			};
		} catch (error) {
			return {
				success: false,
				error
			};
		}
	}

	/**
	 * Finds first entity that matches given where condition.
	 * If entity was not found in the database - answers `success: false` rather than raising.
	 *
	 * The MikroORM branch states the criteria the way the parser expects to read them. That parser
	 * reads a find *options* object and takes its `where` from it, so handing it the criteria
	 * themselves leaves it with no `where` at all — and an absent filter is not an empty filter, it is
	 * a filter that matches every row. The read then answered with the first row of the table
	 * whatever was asked for, which is the worst possible answer for the callers this method exists
	 * for: a caller asking whether a code is still free would be told about a different row entirely.
	 * Every other call site in this class passes a full options object and is correct as it stands.
	 *
	 * @param options The where condition.
	 * @returns Whether a record was found, and the record.
	 */
	public async findOneOrFailByWhereOptions(options: IFindWhereOptions<T>): Promise<ITryRequest<T>> {
		try {
			let record: T;
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>({
						where: options
					} as FindManyOptions);
					record = (await this.mikroOrmRepository.findOneOrFail(where, mikroOptions)) as any;
					break;
				case MultiORMEnum.TypeORM:
					record = await this.typeOrmRepository.findOneByOrFail(options as FindOptionsWhere<T>);
					break;
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
			return {
				success: true,
				record: this.serialize(record)
			};
		} catch (error) {
			return {
				success: false,
				error
			};
		}
	}

	/*
	|--------------------------------------------------------------------------
	| @FindOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * Finds first entity by a given find options.
	 * If entity was not found in the database - returns null.
	 *
	 * @param id {string}
	 * @param options
	 * @returns
	 */
	public async findOneByIdString(id: ID, options?: IFindOneOptions<T>): Promise<T> {
		this.assertRelationsPermitted(options);

		// See findOneOrFailByIdString: an empty id must fail closed, never match an arbitrary row.
		if (!id) {
			throw new NotFoundException(`The requested record was not found`);
		}
		let record: T;

		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>(options as FindManyOptions);
				record = (await this.mikroOrmRepository.findOne(concatIdToWhere<T>(id, where), mikroOptions)) as any;
				break;
			case MultiORMEnum.TypeORM:
				options = options as FindOneOptions<T>;
				record = await this.typeOrmRepository.findOne({
					where: {
						id,
						...(options && options.where ? options.where : {})
					},
					...(options && options.select ? { select: parseFindOptionsSelect(options.select) } : {}),
					...(options && options.relations
						? { relations: parseFindOptionsRelations(options.relations) }
						: []),
					...(options && options.order ? { order: options.order } : {}),
					...(options && options.withDeleted ? { withDeleted: options.withDeleted } : {})
				} as FindOneOptions<T>);
				break;
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}

		if (!record) {
			throw new NotFoundException(`The requested record was not found`);
		}

		return this.serialize(record);
	}

	/**
	 * Finds the first entity by the given find options.
	 *
	 * **A miss raises rather than answering `null`.** The declared return type says the row, and the
	 * body has always raised `NotFoundException` on a miss — which is what the API contract wants,
	 * since the exception filter turns it into the `404` a caller reading one resource by id should
	 * get. The doc comment here used to promise `null`, and the `| null` in the signature said the
	 * same thing; neither was enforced, because this workspace compiles without `strictNullChecks`,
	 * where `T | null` collapses to `T` and a comment cannot be checked at all. A caller that reads
	 * that promise and branches on `null` therefore gets a `404` from a path that meant to ask a
	 * question, which is how a "is this code still free?" check came to refuse every free code.
	 *
	 * **A caller that must treat absence as an ordinary answer uses `findOneOrFailByOptions`**, whose
	 * `ITryRequest` carries `success: false` instead of raising. That is the pair this platform
	 * already uses in fifty-odd places, and it is the only shape here that says "not finding it is an
	 * outcome" without changing what a read by id does.
	 *
	 * @param options The find options.
	 * @returns The record.
	 * @throws NotFoundException when no record matches.
	 */
	public async findOneByOptions(options: IFindOneOptions<T>): Promise<T> {
		this.assertRelationsPermitted(options);

		let record: T;
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>(options as FindManyOptions);
				record = (await this.mikroOrmRepository.findOne(where, mikroOptions)) as any;
				break;
			case MultiORMEnum.TypeORM:
				record = await this.typeOrmRepository.findOne(parseTypeORMFindOptions(options as FindOneOptions<T>));
				break;
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}

		if (!record) {
			throw new NotFoundException(`The requested record was not found`);
		}

		return this.serialize(record);
	}

	/**
	 * Finds the first entity matching the given where condition.
	 *
	 * **A miss raises rather than answering `null`**, for the reason `findOneByOptions` states in
	 * full: the body has always raised `NotFoundException`, the declared `| null` was never enforced
	 * because this workspace compiles without `strictNullChecks`, and a caller that needs absence as
	 * an ordinary answer uses `findOneOrFailByWhereOptions` and reads `success`.
	 *
	 * @param options The where condition.
	 * @returns The record.
	 * @throws NotFoundException when no record matches.
	 */
	public async findOneByWhereOptions(options: IFindWhereOptions<T>): Promise<T> {
		let record: T;
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>({ where: options } as FindManyOptions);
				record = (await this.mikroOrmRepository.findOne(where, mikroOptions)) as any;
				break;
			case MultiORMEnum.TypeORM:
				record = await this.typeOrmRepository.findOneBy(options as FindOptionsWhere<T>);
				break;
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}

		if (!record) {
			throw new NotFoundException(`The requested record was not found`);
		}
		return this.serialize(record);
	}

	/**
	 * Creates a new entity or updates an existing one based on the provided entity data.
	 *
	 * @param entity The partial entity data for creation or update.
	 * @param createOptions Options for the creation of the entity in MikroORM.
	 * @param upsertOptions Options for the upsert operation in MikroORM.
	 * @returns The created or updated entity.
	 */
	public async create(
		partialEntity: IPartialEntity<T>,
		createOptions: CreateOptions<boolean> = {
			/** This option disables the strict typing which requires all mandatory properties to have value, it has no effect on runtime */
			partial: true,
			/** Creates a managed entity instance instead, bypassing the constructor call */
			managed: true
		},
		assignOptions: AssignOptions<boolean> = {
			updateNestedEntities: false,
			onlyOwnProperties: true
		}
	): Promise<T> {
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					try {
						if (partialEntity['id']) {
							// Try to load the existing entity
							const entity = await this.mikroOrmRepository.findOne(partialEntity['id']);
							if (entity) {
								// If the entity has an ID, perform an upsert operation
								this.mikroOrmRepository.assign(entity, partialEntity as any, assignOptions);
								await this.mikroOrmRepository.flush();

								return this.serialize(entity);
							}
						}
						// If the entity doesn't have an ID, it's new and should be persisted
						// Create a new entity using MikroORM
						const newEntity = this.mikroOrmRepository.create(
							partialEntity as RequiredEntityData<T>,
							createOptions
						);

						// Persist new entity and flush
						await this.mikroOrmRepository.persistAndFlush(newEntity); // This will also persist the relations
						return this.serialize(newEntity);
					} catch (error) {
						console.error('Error during mikro orm create crud transaction:', redactDatabaseError(error));
					}
				case MultiORMEnum.TypeORM:
					const newEntity = this.typeOrmRepository.create(partialEntity as DeepPartial<T>);
					return await this.typeOrmRepository.save(newEntity);
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
		} catch (error) {
			console.error('Error in crud service create method:', redactDatabaseError(error));
			throw new BadRequestException(toClientSafeError(error));
		}
	}

	/**
	 * Creates multiple new entities in a single bulk operation.
	 * More efficient than calling create() in a loop as it batches the database operations.
	 *
	 * @param entities The array of partial entity data for creation.
	 * @returns The array of created entities.
	 */
	public async createMany(entities: IPartialEntity<T>[]): Promise<T[]> {
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const created = entities.map((entity) =>
						this.mikroOrmRepository.create(entity as RequiredEntityData<T>, {
							partial: true,
							managed: true
						})
					);
					await this.mikroOrmRepository.persistAndFlush(created);
					return created.map((entity) => this.serialize(entity));
				}
				case MultiORMEnum.TypeORM: {
					const newEntities = entities.map((entity) =>
						this.typeOrmRepository.create(entity as DeepPartial<T>)
					);
					return await this.typeOrmRepository.save(newEntities);
				}
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
		} catch (error) {
			console.error('Error in crud service createMany method:', redactDatabaseError(error));
			throw new BadRequestException(toClientSafeError(error));
		}
	}

	/**
	 * Saves a given entity in the database.
	 * If entity does not exist in the database then inserts, otherwise updates.
	 *
	 * @param entity
	 * @returns
	 */
	public async save(entity: IPartialEntity<T>): Promise<T> {
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					return await this.mikroOrmRepository.upsert(entity as T);
				case MultiORMEnum.TypeORM:
					return await this.typeOrmRepository.save(entity as DeepPartial<T>);
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
		} catch (error) {
			console.error('Error in crud service save method:', redactDatabaseError(error));
			throw new BadRequestException(toClientSafeError(error));
		}
	}

	/**
	 * Saves multiple entities in a single bulk operation.
	 * If entities do not exist in the database then inserts, otherwise updates.
	 * More efficient than calling save() in a loop as it batches the database operations.
	 *
	 * @param entities The array of partial entity data.
	 * @returns The array of saved entities.
	 */
	public async saveMany(entities: IPartialEntity<T>[]): Promise<T[]> {
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					return await this.mikroOrmRepository.upsertMany(entities as T[]);
				case MultiORMEnum.TypeORM:
					return await this.typeOrmRepository.save(entities as DeepPartial<T>[]);
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
		} catch (error) {
			console.error('Error in crud service saveMany method:', redactDatabaseError(error));
			throw new BadRequestException(toClientSafeError(error));
		}
	}

	/**
	 * Updates entity partially. Entity can be found by a given conditions.
	 * Unlike save method executes a primitive operation without cascades, relations and other operations included.
	 * Executes fast and efficient UPDATE query.
	 * Does not check if entity exist in the database.
	 *
	 * @param id
	 * @param partialEntity
	 * @returns
	 */
	public async update(id: IUpdateCriteria<T>, partialEntity: QueryDeepPartialEntity<T>): Promise<UpdateResult | T> {
		// Outside the try: a malformed criteria is a 400 of its own, not a wrapped DB error.
		assertCriteriaHasPredicate(id, 'update');
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					let where: MikroFilterQuery<T>;
					if (typeof id === 'string') {
						where = { id } as any;
					} else {
						where = id as MikroFilterQuery<T>;
					}
					const row = partialEntity as RequiredEntityData<T>;
					const updatedRow = await this.mikroOrmRepository.nativeUpdate(where, row as T);
					return { affected: updatedRow } as UpdateResult;
				case MultiORMEnum.TypeORM:
					return await this.typeOrmRepository.update(
						id as string | number | FindOptionsWhere<T>,
						partialEntity as QueryDeepPartialEntity<T>
					);
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
		} catch (error) {
			throw new BadRequestException(toClientSafeError(error));
		}
	}

	/**
	 * Deletes a record based on the given criteria.
	 * Criteria can be an ID (string or number) or a complex object with conditions.
	 * Supports multiple ORM types, and throws if the ORM type is unsupported.
	 *
	 * @param criteria - Identifier or condition to delete specific record(s).
	 * @returns {Promise<DeleteResult>} - Result indicating the number of affected records.
	 */
	public async delete(criteria: string | number | FindOptionsWhere<T>): Promise<DeleteResult> {
		// Outside the try: a malformed criteria is a 400 of its own, not a wrapped not-found.
		assertCriteriaHasPredicate(criteria, 'delete');
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					// Determine the appropriate filter for MikroORM based on the criteria type
					let filter: MikroFilterQuery<T>;
					if (typeof criteria === 'object') {
						filter = criteria as MikroFilterQuery<T>;
					} else {
						filter = { id: criteria } as MikroFilterQuery<T>;
					}

					// Convert the filter to MikroORM-specific where and options
					let { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>({ where: filter } as FindManyOptions);

					// Execute delete operation with MikroORM
					const affected = await this.mikroOrmRepository.nativeDelete(where, mikroOptions);
					return { affected } as DeleteResult;
				case MultiORMEnum.TypeORM:
					return await this.typeOrmRepository.delete(criteria);
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
		} catch (error) {
			throw new NotFoundException(`The record was not found`, safeErrorMessage(error));
		}
	}

	/**
	 * Deletes multiple records by their IDs in a single bulk operation.
	 * More efficient than calling delete() in a loop as it batches the database operations.
	 * Uses native ORM operators (TypeORM `In`, MikroORM `$in`) for optimal performance.
	 *
	 * @param ids - An array of entity IDs to delete.
	 * @returns {Promise<DeleteResult>} - Result indicating the number of affected records.
	 */
	public async deleteMany(ids: ID[]): Promise<DeleteResult> {
		if (!ids.length) {
			return { affected: 0, raw: [] } as DeleteResult;
		}

		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const filter = { id: { $in: ids } } as any;
					const affected = await this.mikroOrmRepository.nativeDelete(filter);
					return { affected } as DeleteResult;
				}
				case MultiORMEnum.TypeORM:
					return await this.typeOrmRepository.delete({ id: In(ids) } as FindOptionsWhere<T>);
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
		} catch (error) {
			throw new NotFoundException(`The records were not found`, safeErrorMessage(error));
		}
	}

	/**
	 * Softly deletes entities by a given criteria.
	 * This method sets a flag or timestamp indicating the entity is considered deleted.
	 * It does not actually remove the entity from the database, allowing for recovery or audit purposes.
	 *
	 * @param criteria - Entity ID or condition to identify which entities to soft-delete.
	 * @param options - Additional options for the operation.
	 * @returns {Promise<UpdateResult | DeleteResult>} - Result indicating success or failure.
	 */
	public async softDelete(criteria: string | number | FindOptionsWhere<T>): Promise<UpdateResult | T> {
		// Outside the try: a malformed criteria is a 400 of its own, not a wrapped not-found.
		assertCriteriaHasPredicate(criteria, 'softDelete');
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					// Determine the appropriate filter for MikroORM based on the criteria type
					let filter: MikroFilterQuery<T>;
					if (typeof criteria === 'object') {
						filter = criteria as MikroFilterQuery<T>;
					} else {
						filter = { id: criteria } as MikroFilterQuery<T>;
					}

					// Convert the filter to MikroORM-specific where and options
					let { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>({ where: filter } as FindManyOptions);

					// Find the entity and perform soft delete
					const entity = (await this.mikroOrmRepository.findOne(where, mikroOptions)) as any;
					await this.mikroOrmRepository.removeAndFlush(entity);

					// Return the serialized version of the soft-deleted entity
					return this.serialize(entity);
				case MultiORMEnum.TypeORM:
					// Perform soft delete using TypeORM
					return await this.typeOrmRepository.softDelete(criteria);
				default:
					throw new Error(`Soft delete not implemented for ORM type: ${this.ormType}`);
			}
		} catch (error) {
			throw new NotFoundException(`The record was not found or could not be soft-deleted`, safeErrorMessage(error));
		}
	}

	/**
	 * Softly removes an entity from the database.
	 *
	 * This method handles soft removal of a given entity using different ORM strategies, based on the configured ORM type.
	 * - For MikroORM, it uses the `removeAndFlush` method to ensure that the soft deletion is properly persisted.
	 * - For TypeORM, it utilizes the `softRemove` method to perform a soft deletion.
	 * If the ORM type is not supported, an error is thrown.
	 *
	 * @param id - The unique identifier of the entity to be softly removed.
	 * @param options - Optional parameters for finding the entity (commonly used with TypeORM).
	 * @param saveOptions - Additional save options for the ORM operation (specific to TypeORM).
	 * @returns A promise that resolves to the softly removed entity.
	 */
	public async softRemove(id: ID, options?: IFindOneOptions<T>, saveOptions?: SaveOptions): Promise<T> {
		// The inherited `DELETE :id/soft` route hands over its rest parameter, an ARRAY; never treat it
		// as find options.
		options = toFindOneOptions<T>(options);
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					// Resolve through `findOneByIdString` first: `TenantAwareCrudService` overrides it to add
					// the caller's tenant, which the raw repository lookup below does not. Without it the
					// MikroORM branch soft-deleted a row of ANY tenant by id.
					await this.findOneByIdString(id, options);
					// Convert the filter to MikroORM-specific where and options
					const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>(options as FindManyOptions);
					const entity = (await this.mikroOrmRepository.findOne(
						concatIdToWhere<T>(id, where),
						mikroOptions
					)) as any;
					// Use "em.remove" for MikroORM with a transactional approach to ensure changes are persisted properly
					await this.mikroOrmRepository.removeAndFlush(entity);
					// Return the serialized version of the soft-deleted entity
					return this.serialize(entity);
				}
				case MultiORMEnum.TypeORM: {
					// Ensure the employee exists before attempting soft deletion
					const entity = await this.findOneByIdString(id, options);
					// TypeORM soft removes entities via its repository
					return await this.typeOrmRepository.softRemove<T>(entity, saveOptions);
				}
				default:
					throw new Error(`Unsupported database type: ${this.ormType}`);
			}
		} catch (error) {
			// If any error occurs, rethrow it as a NotFoundException with additional context.
			throw new NotFoundException(`An error occurred during soft removal: ${safeErrorMessage(error)}`);
		}
	}

	/**
	 * Soft-recover a previously soft-deleted entity.
	 *
	 * Depending on the ORM, this method restores a soft-deleted entity by resetting its deletion indicator.
	 *
	 * @param entity - The soft-deleted entity to recover.
	 * @param options - Optional settings for database save operations.
	 * @returns A promise that resolves with the recovered entity.
	 */
	public async softRecover(id: ID, options?: IFindOneOptions<T>, saveOptions?: SaveOptions): Promise<T> {
		// The row to recover IS soft-deleted, so the lookup must include deleted rows: without
		// `withDeleted` every inherited `PUT :id/recover` route answered 404 for the very row it was
		// meant to restore. The inherited route also hands over its rest parameter, an ARRAY; never treat
		// it as find options.
		options = { ...toFindOneOptions<T>(options), withDeleted: true } as IFindOneOptions<T>;
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					// Tenant-scoped existence check first — see softRemove.
					await this.findOneByIdString(id, options);
					// Convert the filter to MikroORM-specific where and options
					const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>(options as FindManyOptions);
					// Find the soft-deleted entity with relations
					const entity = (await this.mikroOrmRepository.findOne(
						concatIdToWhere<T>(id, where),
						mikroOptions
					)) as T;

					// Reset the soft-delete flag to "recover" the entity
					wrap(entity as BaseEntity).assign({ deletedAt: null });

					// Ensure related entities are recovered based on the input object
					await this.ensureRelatedEntitiesRecovered(
						entity,
						mikroOptions.populate as string[],
						this.mikroOrmRepository
					);

					// Persist all changes to ensure recovery is complete
					await this.mikroOrmRepository.persistAndFlush(entity);
					// Return the restored entity, serialized if needed
					return this.serialize(entity);
				}
				case MultiORMEnum.TypeORM: {
					// Ensure the entity exists before attempting soft recover
					const entity = await this.findOneByIdString(id, options);
					// Use TypeORM's recover method to restore the entity
					return await this.typeOrmRepository.recover(entity, saveOptions);
				}
				default:
					throw new Error(`Unsupported database type: ${this.ormType}`);
			}
		} catch (error) {
			// If any error occurs, rethrow it as a NotFoundException with additional context.
			throw new NotFoundException(`An error occurred during restoring entity: ${safeErrorMessage(error)}`);
		}
	}

	/**
	 * Ensure related entities are recovered based on the input object and populate options.
	 *
	 * @param entity - The main entity to which the relations belong.
	 * @param mikroOptionsPopulate - Array of relation names to populate and recover.
	 * @param repository - The repository used for persistence.
	 */
	private async ensureRelatedEntitiesRecovered<T extends BaseEntity>(
		entity: T,
		mikroOptionsPopulate: string[],
		repository: MikroOrmBaseEntityRepository<T>
	): Promise<void> {
		// Loop through the relations to ensure soft-deleted entities are recovered
		await Promise.all(
			mikroOptionsPopulate.map(async (populate) => {
				const relation = entity[populate];

				if (relation) {
					if (relation instanceof Collection) {
						// If it's a collection, recover soft-deleted entities within it
						await this.recoverCollections(relation, repository);
					} else {
						// If it's a single relation, recover it directly
						wrap(relation).assign({ deletedAt: null });
					}
				}
			})
		);

		// Persist the changes to ensure recovery is saved to the database
		await repository.persistAndFlush(entity);
	}

	/**
	 * Recovers soft-deleted entities within a given MikroORM collection
	 * and persists the changes to the database.
	 *
	 * @param collection - The MikroORM collection to process.
	 * @param repository - The repository used to persist changes to the database.
	 * @returns The original collection with soft-deleted entities recovered, or undefined if the collection is not initialized.
	 */
	private async recoverCollections<T extends BaseEntity>(
		collection: Collection<T>,
		repository: MikroOrmBaseEntityRepository<T>
	): Promise<Collection<T> | undefined> {
		// Return early if the collection is not initialized
		if (!collection.isInitialized()) {
			return;
		}
		// Loop through the collection and recover soft-deleted entities
		collection.map((item) => {
			if (item instanceof SoftDeletableBaseEntity) {
				// If the entity is soft-deleted, reset the 'deletedAt' field to recover it
				wrap(item as BaseEntity).assign({ deletedAt: null });
			}
		});
		// Persist the changes to the database
		if (repository) {
			await repository.persistAndFlush(collection);
		}
		// Return the collection with recovered entities
		return collection;
	}

	/**
	 * Serializes the provided entity based on the ORM type.
	 * @param entity The entity to be serialized.
	 * @returns The serialized entity.
	 */
	protected serialize(entity: T): T {
		if (this.ormType === MultiORMEnum.MikroORM) {
			// If using MikroORM, use wrap(entity).toJSON() for serialization
			return wrap(entity).toJSON() as T;
		}
		// If using other ORM types, return the entity as is
		return entity;
	}
}

/**
 * Narrows the `options` argument of `softRemove` / `softRecover` to real find options.
 *
 * `CrudController` forwards its `...options` rest parameter, which Nest fills with an empty ARRAY, so the
 * value is not an options object at all on the inherited routes.
 *
 * @param options - The value received as find options.
 * @returns The options object, or `undefined` when none was given.
 */
function toFindOneOptions<T>(options: unknown): IFindOneOptions<T> | undefined {
	return options && typeof options === 'object' && !Array.isArray(options)
		? (options as IFindOneOptions<T>)
		: undefined;
}
