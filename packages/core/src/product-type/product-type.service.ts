import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
	IPagination,
	IProductTypeTranslatable,
	IProductTypeTranslated,
	LanguagesEnum
} from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
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
	 * @param input 
	 * @param language 
	 * @returns 
	 */
	public async findProductTypes(
		input: any,
		language: LanguagesEnum
	): Promise<IPagination<ProductType | IProductTypeTranslated>> {
		const { relations = [], findInput } = input;
		const { items, total } = await this.findAll({
			where: {
				...findInput
			},
			relations
		});
		return await this.mapTranslatedProductTypes(items as any, language).then((items) => {
			return { items, total };
		});
	}

	/**
	 * MAP product type translations
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
				items.map((product: IProductTypeTranslatable) =>
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
