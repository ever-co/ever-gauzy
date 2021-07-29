import { Injectable, BadRequestException } from '@nestjs/common';
import { IPagination } from '../core';
import { TenantAwareCrudService } from './../core/crud';
import { ProductType } from './product-type.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class ProductTypeService extends TenantAwareCrudService<ProductType> {
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
		langCode?: string,
		options = {page: 1, limit: 10}
	): Promise<IPagination<ProductType>> {
		const total = await this.productTypeRepository.count(findInput);

		const allProductTypes = await this.productTypeRepository.find({
			where: findInput,
			relations,
			skip: (options.page - 1) * options.limit,
			take: options.limit
		});

		return {
			items: allProductTypes.map((type) => type.translate(langCode)),
			total
		};
	}
}
