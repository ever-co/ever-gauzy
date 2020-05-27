import { Injectable, BadRequestException } from '@nestjs/common';
import { CrudService, IPagination } from '../core';
import { ProductType } from './product-type.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductTypeTranslated } from '@gauzy/models';

@Injectable()
export class ProductTypeService extends CrudService<ProductType> {
	constructor(
		@InjectRepository(ProductType)
		private readonly productTypeRepository: Repository<ProductType>
	) {
		super(productTypeRepository);
	}

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

	async findAllProductTypes(
		relations?: string[],
		findInput?: any,
		langCode?: string
	): Promise<IPagination<ProductTypeTranslated>> {
		const allProductTypes = await this.productTypeRepository.find({
			where: findInput,
			relations,
		});

		return {
			items: allProductTypes.map((type) => type.translate(langCode)),
			total: allProductTypes.length,
		};
	}
}
