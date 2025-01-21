import { ApiTags } from '@nestjs/swagger';
import { CrudController } from './../core/crud';
import { Controller, UseGuards } from '@nestjs/common';
import { ProductOption } from './product-option.entity';
import { ProductOptionService } from './product-option.service';
import { TenantPermissionGuard } from './../shared/guards';

@ApiTags('ProductOption')
@UseGuards(TenantPermissionGuard)
@Controller('/product-options')
export class ProductOptionController extends CrudController<ProductOption> {
	constructor(private readonly productOptionService: ProductOptionService) {
		super(productOptionService);
	}
}
