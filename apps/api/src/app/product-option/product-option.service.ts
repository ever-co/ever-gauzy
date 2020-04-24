import { Injectable } from '@nestjs/common';
import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductOption } from './product-option.entity';

@Injectable()
export class ProductOptionService extends CrudService<ProductOption> {
	constructor(
		@InjectRepository(ProductOption)
		private readonly productOptionRepository: Repository<ProductOption>
	) {
		super(productOptionRepository);
	}

	async createBulk(
		productOptionsInput: ProductOption[]
	): Promise<ProductOption[]> {
		return this.productOptionRepository.create(productOptionsInput);
	}
}
