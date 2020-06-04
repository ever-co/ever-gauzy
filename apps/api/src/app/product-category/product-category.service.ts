import { CrudService, IPagination } from '../core';
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductCategory } from './product-category.entity';
import { Repository } from 'typeorm';
import { ProductCategoryTranslated } from '@gauzy/models';

@Injectable()
export class ProductCategoryService extends CrudService<ProductCategory> {
	constructor(
		@InjectRepository(ProductCategory)
		private readonly productCategoryRepository: Repository<ProductCategory>
	) {
		super(productCategoryRepository);
	}

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

	async findAllProductCategories(
		relations?: string[],
		findInput?: any,
		langCode?: string
	): Promise<IPagination<ProductCategory | ProductCategoryTranslated>> {
		const allProductCategories = await this.productCategoryRepository.find({
			where: findInput,
			relations
		});

		return {
			items: allProductCategories.map((category) =>
				category.translate(langCode)
			),
			total: allProductCategories.length
		};
	}
}
