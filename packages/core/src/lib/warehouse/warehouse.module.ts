import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { ProductModule } from '../product/product.module';
import { WarehouseService } from './warehouse.service';
import { WarehouseController } from './warehouse.controller';
import { Warehouse } from './warehouse.entity';
import { WarehouseProductVariant } from './warehouse-product-variant.entity';
import { WarehouseProduct } from './warehouse-product.entity';
import { WarehouseProductService } from './warehouse-product-service';
import { TypeOrmWarehouseRepository } from './repository/type-orm-warehouse.repository';
import { MikroOrmWarehouseRepository } from './repository/mikro-orm-warehouse.repository';
import { TypeOrmWarehouseProductRepository } from './repository/type-orm-warehouse-product.repository';
import { MikroOrmWarehouseProductRepository } from './repository/mikro-orm-warehouse-product.repository';
import { TypeOrmWarehouseProductVariantRepository } from './repository/type-orm-warehouse-product-variant.repository';
import { MikroOrmWarehouseProductVariantRepository } from './repository/mikro-orm-warehouse-product-variant.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Warehouse, WarehouseProduct, WarehouseProductVariant]),
		MikroOrmModule.forFeature([Warehouse, WarehouseProduct, WarehouseProductVariant]),
		RolePermissionModule,
		ProductModule
	],
	controllers: [WarehouseController],
	providers: [
		WarehouseService,
		WarehouseProductService,
		TypeOrmWarehouseRepository, MikroOrmWarehouseRepository,
		TypeOrmWarehouseProductRepository, MikroOrmWarehouseProductRepository,
		TypeOrmWarehouseProductVariantRepository, MikroOrmWarehouseProductVariantRepository
	]
})
export class WarehouseModule {}