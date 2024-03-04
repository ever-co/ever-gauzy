import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Merchant } from './merchant.entity';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';
import { TenantModule } from '../tenant/tenant.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserModule } from './../user/user.module';
import { WarehouseModule } from './../warehouse/warehouse.module';
import { ImageAssetModule } from './../image-asset/image-asset.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/merchants', module: MerchantModule }]),
		TypeOrmModule.forFeature([Merchant]),
		MikroOrmModule.forFeature([Merchant]),
		TenantModule,
		RolePermissionModule,
		UserModule,
		WarehouseModule,
		ImageAssetModule
	],
	controllers: [MerchantController],
	providers: [MerchantService],
	exports: [MerchantService]
})
export class MerchantModule { }
