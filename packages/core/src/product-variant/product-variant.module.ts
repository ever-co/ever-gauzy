import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { ProductVariant } from './product-variant.entity';
import { ProductVariantController } from './product-variant.controller';
import { ProductVariantService } from './product-variant.service';
import { CqrsModule } from '@nestjs/cqrs';
import { ProductVariantCreateHandler } from './commands/handlers/product-variant.create.handler';
import { ProductVariantPriceService } from '../product-variant-price/product-variant-price.service';
import { ProductVariantSettingService } from '../product-settings/product-settings.service';
import { ProductVariantPrice } from '../product-variant-price/product-variant-price.entity';
import { ProductVariantSettings } from '../product-settings/product-settings.entity';
import { ProductService } from '../product/product.service';
import { Product } from '../product/product.entity';
import { ProductVariantDeleteHandler } from './commands/handlers/product-variant.delete.handler';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/product-variants', module: ProductVariantModule }
		]),
		TypeOrmModule.forFeature([
			ProductVariant,
			ProductVariantPrice,
			ProductVariantSettings,
			Product
		]),
		CqrsModule,
		TenantModule
	],
	controllers: [ProductVariantController],
	providers: [
		ProductService,
		ProductVariantService,
		ProductVariantCreateHandler,
		ProductVariantDeleteHandler,
		ProductVariantPriceService,
		ProductVariantSettingService,
		ProductService
	],
	exports: [ProductVariantService]
})
export class ProductVariantModule {}
