import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core';
import { Controller, UseGuards } from '@nestjs/common';
import { ProductVariantSettings } from './product-settings.entity';
import { ProductVariantSettingService } from './product-settings.service';
import { AuthGuard } from '@nestjs/passport';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';

@ApiTags('ProductVariantPrice')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class ProductVariantSettingsController extends CrudController<ProductVariantSettings> {
	constructor(
		private readonly productVariantSettingService: ProductVariantSettingService
	) {
		super(productVariantSettingService);
	}
}
