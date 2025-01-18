import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductVariantSetting } from './product-setting.entity';
import { ProductVariantSettingService } from './product-setting.service';
import { ProductVariantSettingController } from './product-setting.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmProductVariantSettingRepository } from './repository/type-orm-product-setting.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([ProductVariantSetting]),
		MikroOrmModule.forFeature([ProductVariantSetting]),
		RolePermissionModule
	],
	controllers: [ProductVariantSettingController],
	providers: [ProductVariantSettingService, TypeOrmProductVariantSettingRepository]
})
export class ProductVariantSettingModule {}
