import { ApiTags } from '@nestjs/swagger';
import { CrudController } from './../core/crud';
import { Controller, UseGuards } from '@nestjs/common';
import { ProductVariantPrice } from './product-variant-price.entity';
import { ProductVariantPriceService } from './product-variant-price.service';
import { TenantPermissionGuard } from './../shared/guards';

@ApiTags('ProductVariantPrice')
@UseGuards(TenantPermissionGuard)
@Controller()
export class ProductVariantPriceController extends CrudController<ProductVariantPrice> {
	constructor(
		private readonly productVariantPriceService: ProductVariantPriceService
	) {
		super(productVariantPriceService);
	}
}
