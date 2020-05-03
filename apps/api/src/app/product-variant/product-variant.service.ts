import { Repository } from 'typeorm';
import { CrudService, IPagination } from '../core';
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

	async findAllProductVariants(): Promise<IPagination<ProductVariant>> {
		const total = await this.productVariantRepository.count();
		const items = await this.productVariantRepository.find({
			relations: ['settings', 'price']
		});

		return { items, total };
	}

	async createBulk(
		productVariants: ProductVariant[]
	): Promise<ProductVariant[]> {
		return this.productVariantRepository.save(productVariants);
	}

	async createVariant(
		productVariant: ProductVariant
	): Promise<ProductVariant> {
		return this.productVariantRepository.save(productVariant);
	}

	async updateVariant(
		productVariant: ProductVariant
	): Promise<ProductVariant> {
		return this.productVariantRepository.save(productVariant);
	}
}
