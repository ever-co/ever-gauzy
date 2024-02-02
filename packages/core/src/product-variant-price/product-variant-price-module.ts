import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { ProductVariantPrice } from './product-variant-price.entity';
import { ProductVariantPriceController } from './product-variant-price.controller';
import { ProductVariantPriceService } from './product-variant-price.service';
import { TenantModule } from '../tenant/tenant.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

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
		TenantModule
	],
	controllers: [ProductVariantPriceController],
	providers: [ProductVariantPriceService],
	exports: [ProductVariantPriceService]
})
export class ProductVariantPriceModule { }
