import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core';
import { Controller, UseGuards } from '@nestjs/common';
import { ProductVariantSettings } from './product-settings.entity';
import { ProductVariantSettingService } from './product-settings.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Product-Variant-Price')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class ProductVariantSettingsController extends CrudController<
	ProductVariantSettings
> {
	constructor(
		private readonly productVariantSettingService: ProductVariantSettingService
	) {
		super(productVariantSettingService);
	}
}
