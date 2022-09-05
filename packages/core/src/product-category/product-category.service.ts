import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
	IPagination,
	IProductCategoryTranslatable,
	LanguagesEnum
} from '@gauzy/contracts';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { ProductCategory } from './product-category.entity';

@Injectable()
export class ProductCategoryService extends TenantAwareCrudService<ProductCategory> {
	constructor(
		@InjectRepository(ProductCategory)
		private readonly productCategoryRepository: Repository<ProductCategory>
	) {
		super(productCategoryRepository);
	}

	/**
	 * GET product categories using pagination
	 *
	 * @param options
	 * @param language
	 * @returns
	 */
	public async pagination(
		options: PaginationParams<ProductCategory>,
		language: LanguagesEnum
	) {
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
	async updateProductCategory(
		id: string,
		entity: ProductCategory
	): Promise<ProductCategory> {
		try {
			await this.productCategoryRepository.delete(id);
			return this.productCategoryRepository.save(entity);
		} catch (err) {
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
		options: PaginationParams<ProductCategory>,
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
	async mapTranslatedProductCategories(
		items: IProductCategoryTranslatable[],
		languageCode: LanguagesEnum
	) {
		if (languageCode) {
			return Promise.all(
				items.map((category: IProductCategoryTranslatable) =>
					Object.assign(
						{},
						category,
						category.translate(languageCode)
					)
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
	 async mapTranslatedProductType(
		type: IProductCategoryTranslatable,
		languageCode: LanguagesEnum
	) {
		try {
			if (languageCode) {
				return Object.assign(
					{},
					type,
					type.translate(languageCode)
				);
			} else {
				return type;
			}
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
