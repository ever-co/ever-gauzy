import { TypeOrmModule } from '@nestjs/typeorm';
import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Product } from './product.entity';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ProductVariantModule } from './../product-variant/product-variant.module';
import { ProductVariantPriceModule } from './../product-variant-price/product-variant-price-module';
import { ProductVariantSettingModule } from './../product-setting/product-setting.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { ProductTranslation } from './product-translation.entity';
import { ProductOptionModule } from './../product-option/product-option-module';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmProductRepository } from './repository/type-orm-product.repository';
import { TypeOrmProductTranslationRepository } from './repository/type-orm-product-translation.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Product, ProductTranslation]),
		MikroOrmModule.forFeature([Product, ProductTranslation]),
		CqrsModule,
		RolePermissionModule,
		ProductVariantSettingModule,
		ProductVariantPriceModule,
		ProductOptionModule,
		forwardRef(() => ProductVariantModule)
	],
	controllers: [ProductController],
	providers: [ProductService, TypeOrmProductRepository, TypeOrmProductTranslationRepository, ...CommandHandlers],
	exports: [ProductService]
})
export class ProductModule {}
