import { ApiTags } from '@nestjs/swagger';
import { CrudController } from './../core/crud';
import { Controller, UseGuards } from '@nestjs/common';
import { ProductVariantSettings } from './product-settings.entity';
import { ProductVariantSettingService } from './product-settings.service';
import { TenantPermissionGuard } from './../shared/guards';

@ApiTags('ProductVariantPrice')
@UseGuards(TenantPermissionGuard)
@Controller()
export class ProductVariantSettingsController extends CrudController<ProductVariantSettings> {
	constructor(
		private readonly productVariantSettingService: ProductVariantSettingService
	) {
		super(productVariantSettingService);
	}
}
