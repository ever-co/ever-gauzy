import { ApiTags } from '@nestjs/swagger';
import { CrudController } from './../core/crud';
import { Controller, UseGuards } from '@nestjs/common';
import { ProductOption } from './product-option.entity';
import { ProductOptionService } from './product-option.service';
import { TenantPermissionGuard } from './../shared/guards';

@ApiTags('ProductOptions')
@UseGuards(TenantPermissionGuard)
@Controller()
export class ProductOptionController extends CrudController<ProductOption> {
	constructor(private readonly productOptionService: ProductOptionService) {
		super(productOptionService);
	}
}
