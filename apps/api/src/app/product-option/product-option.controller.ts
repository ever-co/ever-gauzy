import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core';
import { Controller, UseGuards } from '@nestjs/common';
import { ProductOption } from './product-option.entity';
import { ProductOptionService } from './product-option.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Product-Options')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class ProductOptionController extends CrudController<ProductOption> {
	constructor(private readonly productOptionService: ProductOptionService) {
		super(productOptionService);
	}
}
