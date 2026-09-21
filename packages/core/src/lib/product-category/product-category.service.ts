import { Injectable, BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { ID, IPagination, IProductCategoryTranslatable, LanguagesEnum } from '@gauzy/contracts';
import { DeepPartial, DeleteResult, FindOptionsWhere, In } from 'typeorm';
// The two modules the service actually names, rather than the `core/crud` barrel: the barrel re-exports
// the CRUD controller and the tenant-aware service together, and a spec that doubles the base class has
// to mock the module the service imports — mocking the barrel would hand every other consumer of it a
// module with no `CrudController` in it, which fails at class-definition time rather than at an
// assertion. See `product-category.service.spec.ts`.
import { TenantAwareCrudService } from './../core/crud/tenant-aware-crud.service';
import { BaseQueryDTO } from './../core/dto/base-query.dto';
import { MultiORMEnum } from './../core/utils';
import { ProductCategory } from './product-category.entity';
import { TypeOrmProductCategoryRepository } from './repository/type-orm-product-category.repository';
import { MikroOrmProductCategoryRepository } from './repository/mikro-orm-product-category.repository';

/** What a parent that cannot be assigned is refused with. */
const PARENT_CYCLE_CODE = 'PRODUCT_CATEGORY_CYCLE';
const PARENT_NOT_FOUND_CODE = 'PRODUCT_CATEGORY_PARENT_NOT_FOUND';

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
	 * dialect cannot express. Both arms answer the same list for the same tree, which is what the two
	 * assertions in the suite pin.
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

		if (this.ormType === MultiORMEnum.MikroORM) {
			return [category, ...(await this.walkDescendants([categoryId]))];
		}

		const repository = this.typeOrmRepository.manager.getTreeRepository(ProductCategory);

		return await repository.findDescendants(category);
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
	 * @param entity The category to create.
	 * @returns The stored category.
	 * @throws NotFoundException with `PRODUCT_CATEGORY_PARENT_NOT_FOUND` when the parent is not readable.
	 */
	public async create(entity: DeepPartial<ProductCategory>): Promise<ProductCategory> {
		await this.assertParentIsReadable(entity.parentId);

		return await super.create(entity);
	}

	/**
	 * Refuses a parent that would make the taxonomy cyclic, before anything is written.
	 *
	 * A cycle is not a theoretical state: it is what a drag-and-drop in a category tree produces when a
	 * merchandiser drops a branch onto its own child. Once written, the tree has no root down that path
	 * and every descendant read either loops or silently truncates — and the closure rows the ORM wrote
	 * on the way in are no help, because the closure of a cyclic tree is not a partial order any more.
	 * The assignment is therefore refused, and the refusal happens here, before the write.
	 *
	 * @param categoryId The category being changed.
	 * @param parentId The parent it asks for.
	 * @throws NotFoundException with `PRODUCT_CATEGORY_PARENT_NOT_FOUND` when the parent is not readable.
	 * @throws BadRequestException with `PRODUCT_CATEGORY_CYCLE` when the parent is the category or one of
	 * its descendants.
	 */
	private async assertParentIsUsable(categoryId: ID, parentId?: ID | null): Promise<void> {
		if (parentId === undefined || parentId === null) {
			return;
		}

		await this.assertParentIsReadable(parentId);

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
	 * @param parentId The parent the caller named, when it named one.
	 * @throws NotFoundException with `PRODUCT_CATEGORY_PARENT_NOT_FOUND` when no such category is readable.
	 */
	private async assertParentIsReadable(parentId?: ID | null): Promise<void> {
		if (parentId === undefined || parentId === null) {
			return;
		}

		try {
			await this.findOneByIdString(parentId);
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw new NotFoundException({
					message: `The parent category ${parentId} was not found in this organization.`,
					code: PARENT_NOT_FOUND_CODE
				});
			}

			throw error;
		}
	}

	/**
	 * The categories below one level, and the levels below them.
	 *
	 * The MikroORM arm of {@link findDescendants}. It is one query per level rather than one per
	 * category, so a wide tree costs one round trip per depth.
	 *
	 * @param parentIds The level to read.
	 * @param found The categories collected so far.
	 * @returns Every category below the given level.
	 */
	private async walkDescendants(parentIds: ID[], found: ProductCategory[] = []): Promise<ProductCategory[]> {
		if (parentIds.length === 0) {
			return found;
		}

		const children = await this.findAll({
			where: { parentId: In(parentIds) } as FindOptionsWhere<ProductCategory>
		});

		const level = children.items ?? [];

		if (level.length === 0) {
			return found;
		}

		found.push(...level);

		return await this.walkDescendants(
			level.map((category) => category.id),
			found
		);
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
	 * @param criteria The category to remove, by id or by conditions.
	 * @returns The delete result, so the inherited route keeps the platform's response shape.
	 */
	public async delete(criteria: ID | FindOptionsWhere<ProductCategory>): Promise<DeleteResult> {
		const category = await this.findOneByIdString(criteria as ID);

		if (category) {
			await super.update({ parentId: category.id } as FindOptionsWhere<ProductCategory>, {
				parentId: null
			} as any);
		}

		return await super.delete(criteria);
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
	 * UPDATE product category
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	async updateProductCategory(id: ID, entity: ProductCategory): Promise<ProductCategory> {
		try {
			// This is a delete-then-recreate, so an id matching nothing in the caller's tenant would
			// leave `delete` affecting zero rows and `save` INSERTING a brand-new category at that
			// arbitrary URL id. `findOneByIdString` is tenant-scoped and THROWS NotFoundException, so
			// the recreate can only ever replace a row that was already ours.
			await this.findOneByIdString(id);

			// Before the delete, not after: a parent that would close a loop has to be refused while the
			// subtree it would close over is still there to be read.
			await this.assertParentIsUsable(id, entity.parentId);

			await super.delete(id);
			// Persist under the verified path id, never a body-supplied one (save() with an existing PK
			// updates THAT row).
			//
			// MikroORM only: `save()` is `upsert()` there, which does NOT cascade relations, so a
			// translatable entity came back with its translations dropped. `create()` goes through
			// persistAndFlush, which does cascade. The TypeORM path keeps `save()` unchanged — its
			// behaviour is already correct and this is not the place to alter it.
			return this.ormType === MultiORMEnum.MikroORM
				? await this.create({ ...entity, id })
				: await this.save({ ...entity, id });
		} catch (err) {
			// Preserve the 404 above instead of flattening it to a 400.
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
}
