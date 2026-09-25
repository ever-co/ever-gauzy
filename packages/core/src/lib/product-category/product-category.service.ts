import { Injectable, BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { ID, IPagination, IProductCategoryTranslatable, LanguagesEnum } from '@gauzy/contracts';
import { Brackets, DeepPartial, DeleteResult, FindOptionsWhere, In, IsNull } from 'typeorm';
import { FilterQuery } from '@mikro-orm/core';
// The two modules the service actually names, rather than the `core/crud` barrel: the barrel re-exports
// the CRUD controller and the tenant-aware service together, and a spec that doubles the base class has
// to mock the module the service imports — mocking the barrel would hand every other consumer of it a
// module with no `CrudController` in it, which fails at class-definition time rather than at an
// assertion. See `product-category.service.spec.ts`.
import { TenantAwareCrudService } from './../core/crud/tenant-aware-crud.service';
import { BaseQueryDTO } from './../core/dto/base-query.dto';
import { RequestContext } from './../core/context';
import { MultiORMEnum } from './../core/utils';
import { ProductCategory } from './product-category.entity';
import { ProductCategoryTranslation } from './product-category-translation.entity';
import { mikroOrmClosureRunner, ProductCategoryClosure, typeOrmClosureRunner } from './product-category-closure';
import { TypeOrmProductCategoryRepository } from './repository/type-orm-product-category.repository';
import { MikroOrmProductCategoryRepository } from './repository/mikro-orm-product-category.repository';

/** What a parent that cannot be assigned is refused with. */
const PARENT_CYCLE_CODE = 'PRODUCT_CATEGORY_CYCLE';
const PARENT_NOT_FOUND_CODE = 'PRODUCT_CATEGORY_PARENT_NOT_FOUND';

/**
 * The columns an edit writes: the category's own facts. Never its identity, its tenant or organization,
 * its timestamps, or a relation — `parentId` is written by the edit only when it is a move, and the
 * translations are replaced as rows of their own.
 */
const EDITABLE_COLUMNS = [
	'imageUrl',
	'imageId',
	'slug',
	'sortOrder',
	'isFeatured',
	'status',
	'metadata',
	'isActive',
	'isArchived'
] as const;

/**
 * The tenant and organization a category belongs to, as read off the row itself.
 *
 * `organizationId` is `undefined` — not `null` — when the row did not say, and a write is then scoped
 * by the tenant alone rather than by an organization it would have to guess.
 */
interface ICategoryScope {
	tenantId: ID | null;
	organizationId?: ID | null;
}

/** One language's text, as either surface states it. */
interface ITranslationInput {
	name?: string;
	description?: string;
	languageCode?: string;
}

@Injectable()
export class ProductCategoryService extends TenantAwareCrudService<ProductCategory> {
	constructor(
		typeOrmProductCategoryRepository: TypeOrmProductCategoryRepository,
		mikroOrmProductCategoryRepository: MikroOrmProductCategoryRepository
	) {
		super(typeOrmProductCategoryRepository, mikroOrmProductCategoryRepository);
	}

	/**
	 * Every category in a category's subtree, the category itself included.
	 *
	 * The answer is the closure table's whole reason to exist: on TypeORM the tree repository reads it
	 * as one join, and on MikroORM — which has no closure-table strategy — the same subtree is walked
	 * through `parentId`, one level at a time, because the alternative is a recursive CTE the embedded
	 * dialect cannot express. Both arms answer the same list for the same tree, because the service
	 * keeps the closure table in step with `parentId` on every write (see {@link ProductCategoryClosure}).
	 *
	 * **Both arms are scoped to the category's own tenant and organization.** The closure table carries
	 * no tenant of its own, so the TypeORM read narrows the joined rows explicitly rather than trusting
	 * that every pair it holds stays inside one tenant; the MikroORM walk reads through the tenant-scoped
	 * `findAll` and names the organization as well.
	 *
	 * The category itself is part of the answer, which is what the self-pair row means: a navigation
	 * that lists "everything under this category" lists the category too, and a caller that wants only
	 * the levels below drops the first entry.
	 *
	 * @param categoryId The category to walk from.
	 * @returns Its subtree, the category first.
	 */
	public async findDescendants(categoryId: ID): Promise<ProductCategory[]> {
		const category = await this.findOneByIdString(categoryId);
		const scope = this.scopeOf(category);

		if (this.ormType === MultiORMEnum.MikroORM) {
			return [category, ...(await this.walkDescendants(category, scope))];
		}

		const query = this.typeOrmRepository.manager
			.getTreeRepository(ProductCategory)
			.createDescendantsQueryBuilder('category', 'closure', category);

		if (scope.tenantId) {
			query.andWhere('category.tenantId = :closureTenantId', { closureTenantId: scope.tenantId });
		} else {
			query.andWhere('category.tenantId IS NULL');
		}

		if (scope.organizationId) {
			query.andWhere('category.organizationId = :closureOrganizationId', {
				closureOrganizationId: scope.organizationId
			});
		} else if (scope.organizationId === null) {
			query.andWhere('category.organizationId IS NULL');
		}

		const descendants = await query.getMany();

		return [category, ...descendants.filter((row) => String(row.id) !== String(category.id))];
	}

	/**
	 * Whether one category sits inside another's subtree.
	 *
	 * @param ancestorId The category whose subtree is searched.
	 * @param descendantId The category looked for.
	 * @returns True when the second is the first or below it.
	 */
	public async isDescendantOf(ancestorId: ID, descendantId: ID): Promise<boolean> {
		if (String(ancestorId) === String(descendantId)) {
			return true;
		}

		const descendants = await this.findDescendants(ancestorId);

		return descendants.some((category) => String(category.id) === String(descendantId));
	}

	/**
	 * Creates a category, refusing a parent that does not exist in the caller's organization.
	 *
	 * A category cannot cycle into itself on creation — it has no descendants yet — so the only rule a
	 * create has to keep is that the parent it names is really there. The check is worth its read: a
	 * dangling `parentId` produces a category that belongs to no tree at all, which is worse than a
	 * refusal because nothing about the row says so.
	 *
	 * **The closure pairs are written with the row, in the same transaction, on both ORMs.** Both
	 * surfaces name the parent by `parentId`, and TypeORM's closure executor never reads that column: it
	 * reads the `parent` relation, and a row inserted without it received its self-pair and nothing else
	 * — invisible to every descendant read and to the cycle guard. On TypeORM the relation is therefore
	 * set from `parentId`, so the executor writes the ancestor pairs inside the insert's own
	 * transaction. MikroORM has no closure executor, so there the insert and
	 * {@link ProductCategoryClosure.attach} run in one transaction of their own.
	 *
	 * @param entity The category to create.
	 * @returns The stored category.
	 * @throws NotFoundException with `PRODUCT_CATEGORY_PARENT_NOT_FOUND` when the parent is not readable.
	 */
	public async create(entity: DeepPartial<ProductCategory>): Promise<ProductCategory> {
		const fields = withoutTreeRelations(entity);
		const parentId = requestedParentId(entity) ?? null;

		await this.assertParentIsReadable(parentId, (fields.organizationId as ID) ?? null);

		if (this.ormType === MultiORMEnum.MikroORM) {
			return await this.mikroOrmRepository.getEntityManager().transactional(async (em) => {
				const created = await super.create({ ...fields, parentId });
				const tenantId = this.scopeOf(created).tenantId ?? RequestContext.currentTenantId() ?? null;

				await new ProductCategoryClosure(mikroOrmClosureRunner(em)).attach(created.id, parentId, tenantId);

				return created;
			});
		}

		const created = await super.create({
			...fields,
			parentId,
			...(parentId ? { parent: { id: parentId } } : {})
		});

		// The relation was set only so the executor would read it; the row answers with `parentId`,
		// exactly as it did before, rather than with a half-loaded parent.
		delete created.parent;

		return created;
	}

	/**
	 * Refuses a parent that would make the taxonomy cyclic, before anything is written.
	 *
	 * A cycle is not a theoretical state: it is what a drag-and-drop in a category tree produces when a
	 * merchandiser drops a branch onto its own child. Once written, the tree has no root down that path
	 * and every descendant read either loops or silently truncates — and the closure rows written on the
	 * way in are no help, because the closure of a cyclic tree is not a partial order any more. The
	 * assignment is therefore refused, and the refusal happens here, before the write.
	 *
	 * @param categoryId The category being changed.
	 * @param parentId The parent it asks for.
	 * @param organizationId The organization the category belongs to, when the row says.
	 * @throws NotFoundException with `PRODUCT_CATEGORY_PARENT_NOT_FOUND` when the parent is not readable.
	 * @throws BadRequestException with `PRODUCT_CATEGORY_CYCLE` when the parent is the category or one of
	 * its descendants.
	 */
	private async assertParentIsUsable(categoryId: ID, parentId?: ID | null, organizationId?: ID | null): Promise<void> {
		if (parentId === undefined || parentId === null) {
			return;
		}

		await this.assertParentIsReadable(parentId, organizationId);

		if (String(parentId) === String(categoryId)) {
			throw new BadRequestException({
				message: `A category cannot be its own parent.`,
				code: PARENT_CYCLE_CODE,
				details: { categoryId, parentId }
			});
		}

		// The subtree of the category being moved is what the new parent may not belong to: making a
		// descendant the parent is what closes the loop.
		if (await this.isDescendantOf(categoryId, parentId)) {
			throw new BadRequestException({
				message: `Category ${parentId} is inside the subtree of ${categoryId}, so making it the parent would close a loop.`,
				code: PARENT_CYCLE_CODE,
				details: { categoryId, parentId }
			});
		}
	}

	/**
	 * Reads a parent category, or refuses.
	 *
	 * The read is the tenant-scoped one, and when the category's organization is known the parent has to
	 * belong to the same one: a tree is one organization's taxonomy, and the descendant reads are scoped
	 * to it, so a parent from a sibling organization would be a parent no read of this tree can see.
	 *
	 * @param parentId The parent the caller named, when it named one.
	 * @param organizationId The organization of the category that would sit under it, when known.
	 * @throws NotFoundException with `PRODUCT_CATEGORY_PARENT_NOT_FOUND` when no such category is readable.
	 */
	private async assertParentIsReadable(parentId?: ID | null, organizationId?: ID | null): Promise<void> {
		if (parentId === undefined || parentId === null) {
			return;
		}

		const refusal = () =>
			new NotFoundException({
				message: `The parent category ${parentId} was not found in this organization.`,
				code: PARENT_NOT_FOUND_CODE
			});

		let parent: ProductCategory;

		try {
			parent = await this.findOneByIdString(parentId);
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw refusal();
			}

			throw error;
		}

		const parentOrganizationId = this.scopeOf(parent).organizationId;

		if (organizationId && parentOrganizationId !== undefined && String(parentOrganizationId ?? '') !== String(organizationId)) {
			throw refusal();
		}
	}

	/**
	 * The categories below a category, every level of them.
	 *
	 * The MikroORM arm of {@link findDescendants}. It is one query per level rather than one per
	 * category, so a wide tree costs one round trip per depth.
	 *
	 * Two details keep it answering what the closure table answers. The walk goes **through** withdrawn
	 * (soft-deleted) categories — a closure pair does not disappear when a row is withdrawn, so the
	 * categories below one are still below it — and leaves only the withdrawn rows themselves out of the
	 * answer, as the TypeORM read does. And it remembers what it has visited, so a tree that was made
	 * cyclic before the cycle guard existed ends the walk instead of recursing forever.
	 *
	 * @param category The category to walk from.
	 * @param scope Its tenant and organization.
	 * @returns Every category below it.
	 */
	private async walkDescendants(category: ProductCategory, scope: ICategoryScope): Promise<ProductCategory[]> {
		const found: ProductCategory[] = [];
		const visited = new Set<string>([String(category.id)]);
		let level: ID[] = [category.id];

		while (level.length > 0) {
			const { items } = await this.findAll({
				where: {
					parentId: In(level),
					...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
					...(scope.organizationId ? { organizationId: scope.organizationId } : {})
				} as FindOptionsWhere<ProductCategory>,
				withDeleted: true
			});

			const next = (items ?? []).filter((row) => !visited.has(String(row.id)));

			next.forEach((row) => visited.add(String(row.id)));
			found.push(...next.filter((row) => !row.deletedAt));
			level = next.map((row) => row.id);
		}

		return found;
	}

	/**
	 * Removes a category, detaching its children first.
	 *
	 * The schema promises `SET NULL`: a deleted parent makes its children roots rather than deleting
	 * them, because a category that holds products or prices is not something a delete should cascade
	 * into. Postgres and MySQL enforce that in the database, on the constraint the closure migration
	 * adds. **SQLite cannot**, because a SQLite table cannot gain a constraint without being rebuilt —
	 * so the same outcome is produced here, on every dialect, by one statement before the delete. The
	 * order matters: children first, because after the parent is gone there is no id left to detach
	 * them by.
	 *
	 * **The detach is a statement, not a read-then-write.** The inherited `update` reads a row matching
	 * its criteria before it writes and refuses with `NotFoundException` when there is none, which is
	 * right for "update this record" and wrong for "detach whatever children there are": a leaf has no
	 * children, so going through it made every leaf undeletable. The detach, the closure maintenance and
	 * the delete run as one transaction on the ORM's own manager, each scoped to the category's tenant.
	 *
	 * @param criteria The category to remove, by id — or `{ id }`, which is the only condition a tree
	 * delete can honour, because what it detaches is that one category's children.
	 * @returns The delete result, so the inherited route keeps the platform's response shape.
	 * @throws NotFoundException when the category is not readable in the caller's tenant.
	 * @throws BadRequestException when the criteria name anything other than one id.
	 */
	public async delete(criteria: ID | FindOptionsWhere<ProductCategory>): Promise<DeleteResult> {
		const id = typeof criteria === 'object' && criteria !== null ? (criteria as { id?: unknown }).id : criteria;
		const onlyAnId =
			typeof criteria !== 'object' || criteria === null || Object.keys(criteria).every((key) => key === 'id');

		if (!onlyAnId || typeof id !== 'string' || !id) {
			throw new BadRequestException('A category is removed by its identifier.');
		}

		const category = await this.findOneByIdString(id);
		const scope = this.scopeOf(category);

		if (this.ormType === MultiORMEnum.MikroORM) {
			const affected = await this.mikroOrmRepository.getEntityManager().transactional(async (em) => {
				await new ProductCategoryClosure(mikroOrmClosureRunner(em)).detach(id, scope.tenantId);

				// `filters: false` so a withdrawn child is detached too: it still names this category, and
				// a restore would otherwise bring it back under a parent that no longer exists.
				await em.nativeUpdate(
					ProductCategory,
					{ parentId: id, tenant: scope.tenantId ?? null } as FilterQuery<ProductCategory>,
					{ parentId: null, updatedAt: new Date() } as Partial<ProductCategory>,
					{ filters: false }
				);

				return await em.nativeDelete(ProductCategory, {
					id,
					...this.mikroOrmScope(scope)
				} as FilterQuery<ProductCategory>);
			});

			return { affected, raw: [] };
		}

		const affected = await this.typeOrmRepository.manager.transaction(async (manager) => {
			await new ProductCategoryClosure(typeOrmClosureRunner(manager)).detach(id, scope.tenantId);

			await manager.update(
				ProductCategory,
				{ parentId: id, tenantId: scope.tenantId ?? IsNull() } as FindOptionsWhere<ProductCategory>,
				{ parentId: null } as Partial<ProductCategory>
			);

			const { affected } = await manager.delete(ProductCategory, {
				id,
				...this.typeOrmScope(scope)
			} as FindOptionsWhere<ProductCategory>);

			return affected ?? 0;
		});

		return { affected, raw: [] };
	}

	/**
	 * GET product categories using pagination
	 *
	 * @param options
	 * @param language
	 * @returns
	 */
	public async pagination(options: BaseQueryDTO<ProductCategory>, language: LanguagesEnum) {
		const { items, total } = await super.paginate(options);
		return await this.mapTranslatedProductCategories(items as any, language).then((items) => {
			return { items, total };
		});
	}

	/**
	 * Edits a category in place.
	 *
	 * **An edit is an `UPDATE` of the row, never a delete and a re-insert.** The delivered update removed
	 * the category and inserted it again under the same id, and a tree cannot survive that: on Postgres
	 * and MySQL the parent constraint's `SET NULL` fired on the removal and turned every child of the
	 * category into a root — so renaming a parent flattened its branch — while on SQLite, which has no
	 * such constraint, the same edit kept them, and on every dialect the closure table's `CASCADE` took
	 * every pair through the category with it. The row is now updated where it stands, so nothing that
	 * points at it is disturbed.
	 *
	 * **A member the caller does not state is left as it is.** `parentId` is written only when it
	 * changes, which is also the only case that asks the cycle guard and moves the subtree's closure
	 * pairs; `null` makes the category a root. `translations`, when stated, replaces the category's
	 * languages as a set (an empty list removes them all); when omitted, they are kept. The tenant, the
	 * organization and the identifier are the row's and are never taken from the body.
	 *
	 * The row, its translations and its closure pairs are written in one transaction on the ORM's own
	 * manager, each statement scoped to the category's tenant.
	 *
	 * @param id The category, by the identifier of the route or of the input.
	 * @param entity The members the caller states.
	 * @returns The category as stored after the edit.
	 * @throws NotFoundException when the category is not readable in the caller's tenant.
	 * @throws NotFoundException with `PRODUCT_CATEGORY_PARENT_NOT_FOUND` when a new parent is not readable.
	 * @throws BadRequestException with `PRODUCT_CATEGORY_CYCLE` when the new parent would close a loop.
	 */
	async updateProductCategory(id: ID, entity: ProductCategory): Promise<ProductCategory> {
		try {
			// Tenant-scoped, and it THROWS NotFoundException: a category of another tenant, or one that is
			// not there, is answered with the miss before anything is read about the tree or written.
			const existing = await this.findOneByIdString(id);
			const scope = this.scopeOf(existing);

			const currentParentId = existing.parentId ?? null;
			const requested = requestedParentId(entity);
			const parentId = requested === undefined ? currentParentId : requested;
			const moving = String(parentId ?? '') !== String(currentParentId ?? '');

			// Before the write: a parent that would close a loop has to be refused while the subtree it
			// would close over is still the one that is stored.
			if (moving) {
				await this.assertParentIsUsable(id, parentId, scope.organizationId);
			}

			const columns = editableColumns(entity);

			if (moving) {
				columns['parentId'] = parentId;
			}

			const translations = Array.isArray(entity?.translations)
				? (entity.translations as ITranslationInput[])
				: undefined;

			if (this.ormType === MultiORMEnum.MikroORM) {
				await this.mikroOrmRepository.getEntityManager().transactional(async (em) => {
					if (Object.keys(columns).length > 0) {
						await em.nativeUpdate(
							ProductCategory,
							{ id, ...this.mikroOrmScope(scope) } as FilterQuery<ProductCategory>,
							// `nativeUpdate` is a statement, so the timestamp the unit of work would stamp
							// is stated here; TypeORM's update stamps it itself.
							{ ...columns, updatedAt: new Date() } as Partial<ProductCategory>
						);
					}

					if (translations) {
						await em.nativeDelete(
							ProductCategoryTranslation,
							{
								reference: id,
								$or: [{ tenant: scope.tenantId ?? null }, { tenant: null }]
							} as FilterQuery<ProductCategoryTranslation>,
							{ filters: false }
						);

						for (const translation of translations) {
							em.persist(
								em.create(ProductCategoryTranslation, {
									name: translation.name,
									description: translation.description,
									languageCode: translation.languageCode,
									reference: id,
									tenant: scope.tenantId ?? null,
									...(scope.organizationId !== undefined ? { organization: scope.organizationId } : {})
								} as any)
							);
						}

						await em.flush();
					}

					if (moving) {
						await new ProductCategoryClosure(mikroOrmClosureRunner(em)).move(id, parentId, scope.tenantId);
					}
				});
			} else {
				await this.typeOrmRepository.manager.transaction(async (manager) => {
					if (Object.keys(columns).length > 0) {
						await manager.update(
							ProductCategory,
							{ id, ...this.typeOrmScope(scope) } as FindOptionsWhere<ProductCategory>,
							columns as Partial<ProductCategory>
						);
					}

					if (translations) {
						await manager
							.createQueryBuilder()
							.delete()
							.from(ProductCategoryTranslation)
							.where({ referenceId: id })
							.andWhere(ownTranslations(scope.tenantId))
							.execute();

						if (translations.length > 0) {
							await manager.save(
								ProductCategoryTranslation,
								translations.map((translation) => ({
									name: translation.name,
									description: translation.description,
									languageCode: translation.languageCode,
									reference: { id } as ProductCategory,
									referenceId: id,
									...(scope.tenantId ? { tenant: { id: scope.tenantId }, tenantId: scope.tenantId } : {}),
									...(scope.organizationId
										? { organization: { id: scope.organizationId }, organizationId: scope.organizationId }
										: {})
								})) as DeepPartial<ProductCategoryTranslation>[]
							);
						}
					}

					if (moving) {
						await new ProductCategoryClosure(typeOrmClosureRunner(manager)).move(id, parentId, scope.tenantId);
					}
				});
			}

			return await this.reload(id, scope);
		} catch (err) {
			// Preserve the 404 and the two tree refusals instead of flattening them to a 400.
			if (err instanceof HttpException) {
				throw err;
			}
			throw new BadRequestException(err);
		}
	}

	/**
	 * GET all product categories
	 *
	 * @param input
	 * @param language
	 * @returns
	 */
	public async findProductCategories(
		options: BaseQueryDTO<ProductCategory>,
		language: LanguagesEnum
	): Promise<IPagination<ProductCategory>> {
		const { relations = [], where } = options;
		const { items, total } = await this.findAll({
			where,
			relations
		});
		return await this.mapTranslatedProductCategories(items as any, language).then((items) => {
			return { items, total };
		});
	}

	/**
	 * MAP product category translations
	 *
	 * @param items
	 * @param languageCode
	 * @returns
	 */
	async mapTranslatedProductCategories(items: IProductCategoryTranslatable[], languageCode: LanguagesEnum) {
		if (languageCode) {
			return Promise.all(
				items.map((category: IProductCategoryTranslatable) =>
					Object.assign({}, category, category.translate(languageCode))
				)
			);
		} else {
			return items;
		}
	}

	/**
	 * MAP product category translations
	 *
	 * @param type
	 * @param languageCode
	 * @returns
	 */
	async mapTranslatedProductType(type: IProductCategoryTranslatable, languageCode: LanguagesEnum) {
		try {
			if (languageCode) {
				return Object.assign({}, type, type.translate(languageCode));
			} else {
				return type;
			}
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Reads a category back after an edit.
	 *
	 * On MikroORM the read goes through a fresh fork: the request's identity map still holds the row as
	 * it was read before the edit — `nativeUpdate` and `nativeDelete` do not touch it — and a read that
	 * merged into it would answer the old translations.
	 *
	 * @param id The category.
	 * @param scope Its tenant and organization.
	 * @returns The category as stored.
	 */
	private async reload(id: ID, scope: ICategoryScope): Promise<ProductCategory> {
		if (this.ormType === MultiORMEnum.MikroORM) {
			const em = this.mikroOrmRepository.getEntityManager().fork();
			const row = await em.findOneOrFail(ProductCategory, {
				id,
				...this.mikroOrmScope(scope)
			} as FilterQuery<ProductCategory>);

			return this.serialize(row);
		}

		return await this.findOneByIdString(id);
	}

	/**
	 * The tenant and organization of a category, read off the row.
	 *
	 * A TypeORM row carries both columns; a MikroORM row, serialized, carries them too and names the
	 * relations by their key. Only a row that says nothing about its tenant falls back to the caller's,
	 * which is the tenant the create path stamps.
	 */
	private scopeOf(category: Partial<ProductCategory>): ICategoryScope {
		const row = (category ?? {}) as Record<string, unknown>;
		const tenantId =
			row['tenantId'] !== undefined
				? (row['tenantId'] as ID | null)
				: row['tenant'] !== undefined
					? idOf(row['tenant'])
					: RequestContext.currentTenantId();
		const organizationId =
			row['organizationId'] !== undefined
				? (row['organizationId'] as ID | null)
				: row['organization'] !== undefined
					? idOf(row['organization'])
					: undefined;

		return { tenantId: tenantId ?? null, organizationId };
	}

	/** A category's scope as TypeORM `where` members. */
	private typeOrmScope(scope: ICategoryScope): Record<string, unknown> {
		return {
			tenantId: scope.tenantId ?? IsNull(),
			...(scope.organizationId !== undefined ? { organizationId: scope.organizationId ?? IsNull() } : {})
		};
	}

	/** A category's scope as MikroORM `where` members, through the relations that own the columns. */
	private mikroOrmScope(scope: ICategoryScope): Record<string, unknown> {
		return {
			tenant: scope.tenantId ?? null,
			...(scope.organizationId !== undefined ? { organization: scope.organizationId ?? null } : {})
		};
	}
}

/**
 * The payload without the tree relations.
 *
 * The tree is written from `parentId` alone. A `parent` object would make TypeORM's closure executor
 * and this service disagree about which parent is meant, and `children` would re-parent other rows
 * through TypeORM's one-to-many rewrite, which maintains no closure pair at all.
 */
function withoutTreeRelations(entity: DeepPartial<ProductCategory>): Record<string, unknown> {
	const { parent: _parent, children: _children, ...fields } = (entity ?? {}) as Record<string, unknown>;

	return fields;
}

/**
 * The parent a payload asks for: `undefined` when it does not say, `null` for a root, otherwise the id.
 *
 * `parentId` is what both surfaces send; a `parent` object is honoured only when `parentId` is absent,
 * so a payload that carries the relation (a client echoing a row back) still means what it says.
 */
function requestedParentId(entity: DeepPartial<ProductCategory>): ID | null | undefined {
	const payload = (entity ?? {}) as Record<string, unknown>;

	if (payload['parentId'] !== undefined) {
		return (payload['parentId'] as ID | null) ?? null;
	}

	if (payload['parent'] !== undefined) {
		return idOf(payload['parent']) ?? null;
	}

	return undefined;
}

/** The editable members a payload states — `undefined` means "not stated" and is left out. */
function editableColumns(entity: Partial<ProductCategory>): Record<string, unknown> {
	const payload = (entity ?? {}) as Record<string, unknown>;
	const columns: Record<string, unknown> = {};

	for (const column of EDITABLE_COLUMNS) {
		if (payload[column] !== undefined) {
			columns[column] = payload[column];
		}
	}

	return columns;
}

/**
 * The translation rows an edit may replace: the category's own, in its tenant — and those written
 * without a tenant, which is how a translation created through the category's cascade was stored when
 * the payload did not state one.
 */
function ownTranslations(tenantId: ID | null): Brackets {
	return new Brackets((query) => {
		if (tenantId) {
			query.where({ tenantId }).orWhere({ tenantId: IsNull() });
		} else {
			query.where({ tenantId: IsNull() });
		}
	});
}

/** The id of a relation value, whether it is the related row or only its key. */
function idOf(value: unknown): ID | null {
	if (value === null || value === undefined) {
		return null;
	}

	return typeof value === 'object' ? (((value as { id?: ID }).id ?? null) as ID | null) : (value as ID);
}
