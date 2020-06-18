import { Repository } from 'typeorm';
import { CrudService, IPagination } from '../core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { IProductCreateInput } from '@gauzy/models';

@Injectable()
export class ProductService extends CrudService<Product> {
	constructor(
		@InjectRepository(Product)
		private readonly productRepository: Repository<Product>
	) {
		super(productRepository);
	}

	async findAllProducts(
		langCode?: string,
		relations?: string[],
		findInput?: any
	): Promise<IPagination<Product>> {
		const total = await this.productRepository.count();
		const items = await this.productRepository.find({
			relations: relations
		});

		if (langCode) {
			//tstodo write method
			items.forEach((product) => {
				if (product.type) {
					product.type = product.type.translate(langCode);
				}

				if (product.category) {
					product.category = product.category.translate(langCode);
				}
			});
		}

		return { items, total };
	}

	async findById(id: string, options: any): Promise<Product> {
		return await this.productRepository.findOne(id, options);
	}

	async saveProduct(productRequest: IProductCreateInput): Promise<Product> {
		return await this.productRepository.save(productRequest);
	}
}
