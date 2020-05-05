import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core';
import { Controller, UseGuards } from '@nestjs/common';
import { ProductVariantPrice } from './product-variant-price.entity';
import { ProductVariantPriceService } from './product-variant-price.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Product-Variant-Price')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class ProductVariantPriceController extends CrudController<
	ProductVariantPrice
> {
	constructor(
		private readonly productVariantPriceService: ProductVariantPriceService
	) {
		super(productVariantPriceService);
	}
}
