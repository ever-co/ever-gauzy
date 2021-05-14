import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Merchant, Warehouse, ImageAsset } from 'core';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';
import { TenantModule } from '../tenant/tenant.module';


@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/merchants', module: MerchantModule }
		]),
		TypeOrmModule.forFeature([Merchant, Warehouse, ImageAsset]),
		TenantModule
	],
	controllers: [MerchantController],
	providers: [MerchantService]
})
export class MerchantModule {}