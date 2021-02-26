import { Injectable } from '@nestjs/common';
import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IProductOption } from '@gauzy/contracts';
import { ProductOptionGroup } from './product-option-group.entity';

@Injectable()
export class ProductOptionGroupService extends CrudService<ProductOptionGroup> {
	constructor(
		@InjectRepository(ProductOptionGroup)
		private readonly productOptionGroupRepository: Repository<ProductOptionGroup>
	) {
		super(productOptionGroupRepository);
	}

	async saveBulk(
		productOptionsGroupInput: ProductOptionGroup[]
	): Promise<ProductOptionGroup[]> {
		return this.productOptionGroupRepository.save(productOptionsGroupInput);
	}

	async deleteBulk(productOptionGroupsInput: IProductOption[]) {
		return this.productOptionGroupRepository.remove(
			productOptionGroupsInput as any
		);
	}
}
