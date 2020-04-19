import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core';
import { ProductVariant } from './product-variant.entity';
import { ProductVariantService } from './product-variant.service';

@ApiTags('ProductVariant')
@Controller()
export class ProductVariantController extends CrudController<ProductVariant> {
	constructor(private readonly productVariantService: ProductVariantService) {
		super(productVariantService);
	}
}
