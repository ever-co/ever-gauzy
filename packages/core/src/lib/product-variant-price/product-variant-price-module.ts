import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductVariantPrice } from './product-variant-price.entity';
import { ProductVariantPriceController } from './product-variant-price.controller';
import { ProductVariantPriceService } from './product-variant-price.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmProductVariantPriceRepository } from './repository/type-orm-product-variant-price.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([ProductVariantPrice]),
		MikroOrmModule.forFeature([ProductVariantPrice]),
		RolePermissionModule
	],
	controllers: [ProductVariantPriceController],
	providers: [ProductVariantPriceService, TypeOrmProductVariantPriceRepository]
})
export class ProductVariantPriceModule {}
