import { Injectable, BadRequestException, HttpException } from '@nestjs/common';
import { ID, IPagination, IProductCategoryTranslatable, LanguagesEnum } from '@gauzy/contracts';
import { BaseQueryDTO, TenantAwareCrudService } from './../core/crud';
import { ProductCategory } from './product-category.entity';
import { TypeOrmProductCategoryRepository } from './repository/type-orm-product-category.repository';
import { MikroOrmProductCategoryRepository } from './repository/mikro-orm-product-category.repository';

@Injectable()
export class ProductCategoryService extends TenantAwareCrudService<ProductCategory> {
	constructor(
		typeOrmProductCategoryRepository: TypeOrmProductCategoryRepository,
		mikroOrmProductCategoryRepository: MikroOrmProductCategoryRepository
	) {
		super(typeOrmProductCategoryRepository, mikroOrmProductCategoryRepository);
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
			await super.delete(id);
			// Persist under the verified path id, never a body-supplied one (save() with an existing PK
			// updates THAT row).
			return this.save({ ...entity, id });
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
