import { Repository } from 'typeorm';
import { CrudService, IPagination } from '../core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './product.entity';

@Injectable()
export class ProductService extends CrudService<Product> {
	constructor(
		@InjectRepository(Product)
		private readonly productRepository: Repository<Product>
	) {
		super(productRepository);
	}

	async findAllProducts(): Promise<IPagination<Product>> {
		const total = await this.productRepository.count();
		const items = await this.productRepository.find({
			relations: ['category', 'type']
		});

		return { items, total };
	}
}
