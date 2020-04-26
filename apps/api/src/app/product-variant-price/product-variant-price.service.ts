import { Injectable } from '@nestjs/common';
import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductVariantPrice } from './product-variant-price.entity';

@Injectable()
export class ProductVariantPriceService extends CrudService<
	ProductVariantPrice
> {
	constructor(
		@InjectRepository(ProductVariantPrice)
		private readonly productVariantPriceRepository: Repository<
			ProductVariantPrice
		>
	) {
		super(productVariantPriceRepository);
	}

	async createDefaultProductVariantPrice(): Promise<ProductVariantPrice> {
		const newProductVariantPrice = new ProductVariantPrice();
		return this.productVariantPriceRepository.save(newProductVariantPrice);
	}
}
