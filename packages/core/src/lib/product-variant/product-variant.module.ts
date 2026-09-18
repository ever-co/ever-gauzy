import { TypeOrmModule } from '@nestjs/typeorm';
import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductVariant } from './product-variant.entity';
import { ProductVariantController } from './product-variant.controller';
import { ProductVariantService } from './product-variant.service';
import { ProductVariantResolver } from './product-variant.resolver';
import { ProductVariantPriceModule } from './../product-variant-price/product-variant-price-module';
import { ProductVariantSettingModule } from './../product-setting/product-setting.module';
import { ProductModule } from './../product/product.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmProductVariantRepository } from './repository/type-orm-product-variant.repository';
import { MikroOrmProductVariantRepository } from './repository/mikro-orm-product-variant.repository';

/**
 * The buyable configurations of a product.
 *
 * `ProductModule` and `CqrsModule` are re-exported, not merely imported, and that is what makes the
 * resolver's two non-service dependencies resolvable: a resolver is a provider of whichever module
 * hosts the handler the Apollo configuration names, so a module that imports this one receives
 * `ProductService` and the command bus only if this module hands them on. The REST controller beside
 * it resolves both from this module's own imports, which is why nothing needed re-exporting until
 * the GraphQL view of the same resource existed. `ProductModule` was already reached through
 * `forwardRef` — a variant belongs to a product and a product is edited with its variants — so the
 * re-export follows the dependency the cycle already fixed rather than adding one.
 */
@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([ProductVariant]),
		MikroOrmModule.forFeature([ProductVariant]),
		RolePermissionModule,
		ProductVariantPriceModule,
		ProductVariantSettingModule,
		forwardRef(() => ProductModule)
	],
	controllers: [ProductVariantController],
	providers: [
		ProductVariantService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		ProductVariantResolver,
		TypeOrmProductVariantRepository,
		MikroOrmProductVariantRepository,
		...CommandHandlers
	],
	exports: [ProductVariantService, CqrsModule, forwardRef(() => ProductModule)]
})
export class ProductVariantModule {}