import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductVariantPrice } from './product-variant-price.entity';

@Injectable()
export class ProductVariantPriceService extends TenantAwareCrudService<ProductVariantPrice> {
	constructor(
		@InjectRepository(ProductVariantPrice)
		private readonly productVariantPriceRepository: Repository<ProductVariantPrice>
	) {
		super(productVariantPriceRepository);
	}

	async createDefaultProductVariantPrice(): Promise<ProductVariantPrice> {
		const newProductVariantPrice = new ProductVariantPrice();
		return this.productVariantPriceRepository.save(newProductVariantPrice);
	}

	async deleteMany(
		productVariantPrices: ProductVariantPrice[]
	): Promise<ProductVariantPrice[]> {
		return this.productVariantPriceRepository.remove(productVariantPrices);
	}
}
