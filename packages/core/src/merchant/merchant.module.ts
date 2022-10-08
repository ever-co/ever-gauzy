import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Merchant } from './merchant.entity';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { WarehouseModule } from './../warehouse/warehouse.module';
import { ImageAssetModule } from './../image-asset/image-asset.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/merchants', module: MerchantModule }
		]),
		TypeOrmModule.forFeature([Merchant]),
		TenantModule,
		UserModule,
		WarehouseModule,
		ImageAssetModule
	],
	controllers: [MerchantController],
	providers: [MerchantService],
	exports: [MerchantService]
})
export class MerchantModule {}