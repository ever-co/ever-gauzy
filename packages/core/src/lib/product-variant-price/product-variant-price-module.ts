import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductVariantPrice } from './product-variant-price.entity';
import { ProductVariantPriceController } from './product-variant-price.controller';
import { ProductVariantPriceService } from './product-variant-price.service';
import { ProductVariantPriceResolver } from './product-variant-price.resolver';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmProductVariantPriceRepository } from './repository/type-orm-product-variant-price.repository';

/**
 * What a variant costs and what it is sold for.
 *
 * `ProductVariantPriceResolver` is declared here beside the service it calls, because a resolver can
 * only inject services its own module can reach and this module is what reaches them. Nothing had to
 * be re-exported for it: the resolver's one dependency is `ProductVariantPriceService`, and this
 * module already exports it — the REST controller beside the resolver resolves the same service from
 * this module's own providers. The guard the resolver carries is a provider of the module that hosts
 * it, which is the GraphQL module rather than this one, for the same reason.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([ProductVariantPrice]),
		MikroOrmModule.forFeature([ProductVariantPrice]),
		RolePermissionModule
	],
	controllers: [ProductVariantPriceController],
	providers: [
		ProductVariantPriceService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		ProductVariantPriceResolver,
		TypeOrmProductVariantPriceRepository
	],
	exports: [ProductVariantPriceService]
})
export class ProductVariantPriceModule {}
