import { TypeOrmModule } from '@nestjs/typeorm';
import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { ProductVariant } from './product-variant.entity';
import { ProductVariantController } from './product-variant.controller';
import { ProductVariantService } from './product-variant.service';
import { ProductVariantPriceModule } from './../product-variant-price/product-variant-price-module';
import { ProductVariantSettingModule } from './../product-setting/product-setting.module';
import { ProductModule } from './../product/product.module';
import { TenantModule } from '../tenant/tenant.module';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/product-variants', module: ProductVariantModule }
		]),
		TypeOrmModule.forFeature([
			ProductVariant
		]),
		CqrsModule,
		TenantModule,
		ProductVariantPriceModule,
		ProductVariantSettingModule,
		forwardRef(() => ProductModule)
	],
	controllers: [ProductVariantController],
	providers: [
		ProductVariantService,
		...CommandHandlers
	],
	exports: [ProductVariantService]
})
export class ProductVariantModule {}
