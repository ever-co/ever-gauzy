import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
	IPagination,
	IProductTypeTranslatable,
	LanguagesEnum
} from '@gauzy/contracts';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { ProductType } from './product-type.entity';

@Injectable()
export class ProductTypeService extends TenantAwareCrudService<ProductType> {
	constructor(
		@InjectRepository(ProductType)
		private readonly productTypeRepository: Repository<ProductType>
	) {
		super(productTypeRepository);
	}

	/**
	 * GET product types using pagination
	 *
	 * @param options
	 * @param language
	 * @returns
	 */
	public async pagination(
		options: PaginationParams<ProductType>,
		language: LanguagesEnum
	) {
		const { items, total } = await super.paginate(options);
		return await this.mapTranslatedProductTypes(items as any, language).then((items) => {
			return { items, total };
		});
	}

	/**
	 * UPDATE product type
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	async updateProductType(
		id: string,
		entity: ProductType
	): Promise<ProductType> {
		try {
			await this.productTypeRepository.delete(id);
			return this.productTypeRepository.save(entity);
		} catch (err) {
			throw new BadRequestException(err);
		}
	}

	/**
	 * GET all product types
	 *
	 * @param options
	 * @param language
	 * @returns
	 */
	public async findProductTypes(
		options: PaginationParams<ProductType>,
		language: LanguagesEnum
	): Promise<IPagination<ProductType>> {
		const { relations = [], where } = options;
		const { items, total } = await this.findAll({
			where,
			relations
		});
		return await this.mapTranslatedProductTypes(items as any, language).then((items) => {
			return { items, total };
		});
	}

	/**
	 * MAP product types translations
	 *
	 * @param items
	 * @param languageCode
	 * @returns
	 */
	async mapTranslatedProductTypes(
		items: IProductTypeTranslatable[],
		languageCode: LanguagesEnum
	) {
		if (languageCode) {
			return Promise.all(
				items.map((type: IProductTypeTranslatable) =>
					Object.assign(
						{},
						type,
						type.translate(languageCode)
					)
				)
			);
		} else {
			return items;
		}
	}

	/**
	 * MAP product type translations
	 *
	 * @param type
	 * @param languageCode
	 * @returns
	 */
	async mapTranslatedProductType(
		type: IProductTypeTranslatable,
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
