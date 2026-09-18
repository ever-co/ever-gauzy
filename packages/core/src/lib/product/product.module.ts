import { TypeOrmModule } from '@nestjs/typeorm';
import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Product } from './product.entity';
import { ProductController } from './product.controller';
import { ProductResolver } from './product.resolver';
import { ProductService } from './product.service';
import { ProductVariantModule } from './../product-variant/product-variant.module';
import { ProductVariantPriceModule } from './../product-variant-price/product-variant-price-module';
import { ProductVariantSettingModule } from './../product-setting/product-setting.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { ProductTranslation } from './product-translation.entity';
import { ProductOptionModule } from './../product-option/product-option-module';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmProductRepository } from './repository/type-orm-product.repository';
import { MikroOrmProductRepository } from './repository/mikro-orm-product.repository';
import { TypeOrmProductTranslationRepository } from './repository/type-orm-product-translation.repository';
import { MikroOrmProductTranslationRepository } from './repository/mikro-orm-product-translation.repository';

/**
 * The catalogue's sellable thing.
 *
 * `CqrsModule` is re-exported, not merely imported, and that is what makes the resolver's two
 * dependencies resolvable from the module the Apollo configuration names: a resolver is a provider of
 * whichever module hosts the handler, so a module that imports this one receives `ProductService` and
 * the command bus only if this module hands them on. The REST controller beside the resolver resolves
 * both from this module's own imports, which is why the service was the only export needed until the
 * GraphQL view of the same resource existed.
 */
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
	providers: [
		ProductService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		ProductResolver,
		TypeOrmProductRepository,
		MikroOrmProductRepository,
		TypeOrmProductTranslationRepository,
		MikroOrmProductTranslationRepository,
		...CommandHandlers
	],
	exports: [ProductService, CqrsModule]
})
export class ProductModule {}