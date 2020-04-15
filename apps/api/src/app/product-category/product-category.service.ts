import { CrudService } from '../core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductCategory } from './product-category.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ProductCategoryService extends CrudService<ProductCategory> {
	constructor(
		@InjectRepository(ProductCategory)
		private readonly productCategoryRepository: Repository<ProductCategory>
	) {
		super(productCategoryRepository);
	}
}
