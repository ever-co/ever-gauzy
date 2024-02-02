import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { ProductVariantSetting } from './product-setting.entity';
import { ProductVariantSettingService } from './product-setting.service';
import { ProductVariantSettingController } from './product-setting.controller';
import { TenantModule } from '../tenant/tenant.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/product-variant-settings',
				module: ProductVariantSettingModule
			}
		]),
		TypeOrmModule.forFeature([ProductVariantSetting]),
		MikroOrmModule.forFeature([ProductVariantSetting]),
		TenantModule
	],
	controllers: [ProductVariantSettingController],
	providers: [ProductVariantSettingService],
	exports: [ProductVariantSettingService]
})
export class ProductVariantSettingModule { }
