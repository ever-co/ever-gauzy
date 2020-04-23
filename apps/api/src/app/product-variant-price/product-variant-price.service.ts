import { Injectable } from '@nestjs/common';
import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductVariantPrice } from './product-variant-price.entity';
import { CurrenciesEnum } from '@gauzy/models';

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

		newProductVariantPrice.retailPriceCurrency = CurrenciesEnum.BGN;
		newProductVariantPrice.unitCostCurrency = CurrenciesEnum.BGN;

		return this.productVariantPriceRepository.save(newProductVariantPrice);
	}
}
