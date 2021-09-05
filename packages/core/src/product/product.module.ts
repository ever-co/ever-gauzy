import { TypeOrmModule } from '@nestjs/typeorm';
import { forwardRef, Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { Product } from './product.entity';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ProductVariantModule } from './../product-variant/product-variant.module';
import { ProductVariantPriceModule } from './../product-variant-price/product-variant-price-module';
import { ProductVariantSettingModule } from './../product-setting/product-setting.module';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { ProductTranslation } from './product-translation.entity';
import { ProductOptionModule } from './../product-option/product-option-module';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([{ path: '/products', module: ProductModule }]),
		TypeOrmModule.forFeature([
			Product,
			ProductTranslation
		]),
		CqrsModule,
		TenantModule,
		UserModule,
		ProductVariantSettingModule,
		ProductVariantPriceModule,
		ProductOptionModule,
		forwardRef(() => ProductVariantModule)
	],
	controllers: [ProductController],
	providers: [
		ProductService,
		...CommandHandlers
	],
	exports: [ProductService]
})
export class ProductModule {}
