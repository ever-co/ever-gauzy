import { Injectable } from '@nestjs/common';
import { CrudService } from '../core';
import { ProductType } from './product-type.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class ProductTypeService extends CrudService<ProductType> {
	constructor(
		@InjectRepository(ProductType)
		private readonly productTypeRepository: Repository<ProductType>
	) {
		super(productTypeRepository);
	}
}
