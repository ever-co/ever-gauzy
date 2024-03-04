import { TypeOrmModule } from '@nestjs/typeorm';
import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductVariant } from './product-variant.entity';
import { ProductVariantController } from './product-variant.controller';
import { ProductVariantService } from './product-variant.service';
import { ProductVariantPriceModule } from './../product-variant-price/product-variant-price-module';
import { ProductVariantSettingModule } from './../product-setting/product-setting.module';
import { ProductModule } from './../product/product.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.register([{ path: '/product-variants', module: ProductVariantModule }]),
		TypeOrmModule.forFeature([ProductVariant]),
		MikroOrmModule.forFeature([ProductVariant]),
		RolePermissionModule,
		ProductVariantPriceModule,
		ProductVariantSettingModule,
		forwardRef(() => ProductModule),
		CqrsModule
	],
	controllers: [ProductVariantController],
	providers: [ProductVariantService, ...CommandHandlers],
	exports: [ProductVariantService]
})
export class ProductVariantModule { }
