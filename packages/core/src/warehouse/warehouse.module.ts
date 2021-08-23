import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { WarehouseService } from './warehouse.service';
import { TenantModule } from '../tenant/tenant.module';
import { WarehouseController } from './warehouse.controller';
import { Warehouse } from './warehouse.entity';
import { UserModule } from './../user/user.module';
import { Product } from './../core/entities/internal';
import { WarehouseProductVariant } from './warehouse-product-variant.entity';
import { WarehouseProduct } from './warehouse-product.entity';
import { WarehouseProductService } from './warehouse-product-service';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/warehouses', module: WarehouseModule }
		]),
		TypeOrmModule.forFeature([
			Warehouse,
			Product,
			WarehouseProduct,
			WarehouseProductVariant
		]),
		TenantModule,
		UserModule
	],
	controllers: [WarehouseController],
	providers: [WarehouseService, WarehouseProductService],
	exports: [WarehouseService, WarehouseProductService]
})
export class WarehouseModule {}
