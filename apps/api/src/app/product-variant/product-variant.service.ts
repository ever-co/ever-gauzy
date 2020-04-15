import { Repository } from 'typeorm';
import { CrudService } from '../core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductVariant } from './product-variant.entity';

@Injectable()
export class ProductVariantService extends CrudService<ProductVariant> {
	constructor(
		@InjectRepository(ProductVariant)
		private readonly productVariantRepository: Repository<ProductVariant>
	) {
		super(productVariantRepository);
	}
}
