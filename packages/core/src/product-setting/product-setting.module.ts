import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductVariantSetting } from './product-setting.entity';
import { ProductVariantSettingService } from './product-setting.service';
import { ProductVariantSettingController } from './product-setting.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';

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
		RolePermissionModule
	],
	controllers: [ProductVariantSettingController],
	providers: [ProductVariantSettingService],
	exports: [ProductVariantSettingService]
})
export class ProductVariantSettingModule { }
