import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductVariantPrice } from './product-variant-price.entity';
import { ProductVariantPriceController } from './product-variant-price.controller';
import { ProductVariantPriceService } from './product-variant-price.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/product-variant-prices',
				module: ProductVariantPriceModule
			}
		]),
		TypeOrmModule.forFeature([ProductVariantPrice]),
		MikroOrmModule.forFeature([ProductVariantPrice]),
		RolePermissionModule
	],
	controllers: [ProductVariantPriceController],
	providers: [ProductVariantPriceService],
	exports: [ProductVariantPriceService]
})
export class ProductVariantPriceModule { }
