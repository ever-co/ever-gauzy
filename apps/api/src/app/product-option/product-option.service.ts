import { Injectable } from '@nestjs/common';
import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductOption as IProductOption } from '@gauzy/models';
import { ProductOption } from './product-option.entity';

@Injectable()
export class ProductOptionService extends CrudService<ProductOption> {
	constructor(
		@InjectRepository(ProductOption)
		private readonly productOptionRepository: Repository<ProductOption>
	) {
		super(productOptionRepository);
	}

	async saveBulk(
		productOptionsInput: ProductOption[]
	): Promise<ProductOption[]> {
		return this.productOptionRepository.save(productOptionsInput);
	}

	async deleteBulk(productOptionsInput: IProductOption[]) {
		return this.productOptionRepository.remove(productOptionsInput as any);
	}
}
