import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
	IPagination,
	IProductCategoryTranslatable,
	IProductCategoryTranslated,
	LanguagesEnum
} from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
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
	 * @param filter 
	 * @param language 
	 * @returns 
	 */
	public async pagination(
		filter: any,
		language: LanguagesEnum
	) {
		if ('where' in filter) {
			const { where } = filter;
			if ('languageCode' in where) {
				const { languageCode } = where;
				language = languageCode;

				delete where['languageCode'];
			}
		}

		const { items, total } = await super.paginate(filter);
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
		input: any,
		language: LanguagesEnum
	): Promise<IPagination<ProductCategory | IProductCategoryTranslated>> {
		const { relations = [], findInput } = input;
		const { items, total } = await this.findAll({
			where: {
				...findInput
			},
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
				items.map((product: IProductCategoryTranslatable) =>
					Object.assign(
						{},
						product,
						product.translate(languageCode)
					)
				)
			);
		} else {
			return items;
		}
	}
}
