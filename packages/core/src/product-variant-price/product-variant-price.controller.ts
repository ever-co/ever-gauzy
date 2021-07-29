import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core';
import { Controller, UseGuards } from '@nestjs/common';
import { ProductVariantPrice } from './product-variant-price.entity';
import { ProductVariantPriceService } from './product-variant-price.service';
import { AuthGuard } from '@nestjs/passport';
import { TenantPermissionGuard } from './../shared/guards';

@ApiTags('ProductVariantPrice')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class ProductVariantPriceController extends CrudController<ProductVariantPrice> {
	constructor(
		private readonly productVariantPriceService: ProductVariantPriceService
	) {
		super(productVariantPriceService);
	}
}
