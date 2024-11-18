import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud';
import { Controller, UseGuards } from '@nestjs/common';
import { ProductVariantSetting } from './product-setting.entity';
import { ProductVariantSettingService } from './product-setting.service';
import { TenantPermissionGuard } from '../shared/guards';

@ApiTags('ProductVariantSetting')
@UseGuards(TenantPermissionGuard)
@Controller()
export class ProductVariantSettingController extends CrudController<ProductVariantSetting> {
	constructor(
		private readonly productVariantSettingService: ProductVariantSettingService
	) {
		super(productVariantSettingService);
	}
}
