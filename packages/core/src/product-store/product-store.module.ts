import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductStore, Warehouse, ImageAsset } from 'core';
import { ProductStoreController } from './product-store.controller';
import { ProductStoreService } from './product-store.service';
import { TenantModule } from '../tenant/tenant.module';


@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/product-stores', module: ProductStoreModule }
		]),
		TypeOrmModule.forFeature([ProductStore, Warehouse, ImageAsset]),
		TenantModule
	],
	controllers: [ProductStoreController],
	providers: [ProductStoreService]
})
export class ProductStoreModule {}