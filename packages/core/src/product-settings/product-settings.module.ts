import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { ProductVariantSettings } from './product-settings.entity';
import { ProductVariantSettingService } from './product-settings.service';
import { ProductVariantSettingsController } from './product-settings.controller';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/product-variant-settings',
				module: ProductVariantSettingsModule
			}
		]),
		TypeOrmModule.forFeature([ProductVariantSettings]),
		TenantModule
	],
	controllers: [ProductVariantSettingsController],
	providers: [ProductVariantSettingService],
	exports: [ProductVariantSettingService]
})
export class ProductVariantSettingsModule {}
