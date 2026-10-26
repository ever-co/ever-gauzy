import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AdjustmentModule, TaxLineModule, RolePermissionModule } from '@gauzy/core';
import { ALL_CART_ENTITIES } from './entities';
import { CommerceCartController } from './commerce-cart/commerce-cart.controller';
import { CommerceCartService } from './commerce-cart/commerce-cart.service';
import { TypeOrmCommerceCartRepository } from './commerce-cart/repository/type-orm-commerce-cart.repository';
import { MikroOrmCommerceCartRepository } from './commerce-cart/repository/mikro-orm-commerce-cart.repository';
import { CommerceCartLineController } from './commerce-cart-line/commerce-cart-line.controller';
import { CommerceCartLineService } from './commerce-cart-line/commerce-cart-line.service';
import { TypeOrmCommerceCartLineRepository } from './commerce-cart-line/repository/type-orm-commerce-cart-line.repository';
import { MikroOrmCommerceCartLineRepository } from './commerce-cart-line/repository/mikro-orm-commerce-cart-line.repository';
import { CommerceCartShippingMethodController } from './commerce-cart-shipping-method/commerce-cart-shipping-method.controller';
import { CommerceCartShippingMethodService } from './commerce-cart-shipping-method/commerce-cart-shipping-method.service';
import { TypeOrmCommerceCartShippingMethodRepository } from './commerce-cart-shipping-method/repository/type-orm-commerce-cart-shipping-method.repository';
import { MikroOrmCommerceCartShippingMethodRepository } from './commerce-cart-shipping-method/repository/mikro-orm-commerce-cart-shipping-method.repository';
import { CommerceCartPromotionController } from './commerce-cart-promotion/commerce-cart-promotion.controller';
import { CommerceCartPromotionService } from './commerce-cart-promotion/commerce-cart-promotion.service';
import { TypeOrmCommerceCartPromotionRepository } from './commerce-cart-promotion/repository/type-orm-commerce-cart-promotion.repository';
import { MikroOrmCommerceCartPromotionRepository } from './commerce-cart-promotion/repository/mikro-orm-commerce-cart-promotion.repository';
import { CommerceCheckoutSessionController } from './commerce-checkout-session/commerce-checkout-session.controller';
import { CommerceCheckoutSessionService } from './commerce-checkout-session/commerce-checkout-session.service';
import { TypeOrmCommerceCheckoutSessionRepository } from './commerce-checkout-session/repository/type-orm-commerce-checkout-session.repository';
import { MikroOrmCommerceCheckoutSessionRepository } from './commerce-checkout-session/repository/mikro-orm-commerce-checkout-session.repository';
import { cartResolvers } from './graphql';

/**
 * The cart module.
 *
 * Every entity is registered with both ORMs from the one entity array, so the package cannot boot with
 * a table TypeORM knows about and MikroORM does not. The core adjustment and tax-line modules are
 * imported because the cart's money is *their* rows: the cart writes the ledger and recomputes its own
 * cache from it, and it must not keep a second copy of a discount or of a tax amount.
 *
 * One capability is deliberately **not** imported: the stock the checkout ladder measures a line
 * against belongs to the inventory package, and this package must not read its tables. It is reached
 * through the optional `CART_STOCK_AVAILABILITY` port instead (see `cart.types.ts`), so the binding is
 * the installation's to make — with the provider registered the ladder's `STOCK` step runs, and on an
 * installation that has no inventory package the step is reported as skipped and the cart still
 * validates and completes.
 */
@Module({
	controllers: [
		CommerceCartController,
		CommerceCartLineController,
		CommerceCartShippingMethodController,
		CommerceCartPromotionController,
		CommerceCheckoutSessionController
	],
	imports: [
		// The controllers below are guarded, and the guard resolves the caller's permissions.
		RolePermissionModule,
		TypeOrmModule.forFeature(ALL_CART_ENTITIES),
		MikroOrmModule.forFeature(ALL_CART_ENTITIES),
		AdjustmentModule,
		TaxLineModule
	],
	providers: [
		CommerceCartService,
		TypeOrmCommerceCartRepository,
		MikroOrmCommerceCartRepository,
		CommerceCartLineService,
		TypeOrmCommerceCartLineRepository,
		MikroOrmCommerceCartLineRepository,
		CommerceCartShippingMethodService,
		TypeOrmCommerceCartShippingMethodRepository,
		MikroOrmCommerceCartShippingMethodRepository,
		CommerceCartPromotionService,
		TypeOrmCommerceCartPromotionRepository,
		MikroOrmCommerceCartPromotionRepository,
		CommerceCheckoutSessionService,
		TypeOrmCommerceCheckoutSessionRepository,
		MikroOrmCommerceCheckoutSessionRepository,
		// The GraphQL resolvers are providers of this module, beside their controllers. Nest discovers a
		// resolver by scanning the providers of every module, so a resolver a plugin declares only in its
		// plugin metadata — `extensions.resolvers` — is never registered: the schema advertises its
		// fields and the default resolver answers `null` for each of them, which is a non-null violation
		// at the caller. Every other package in this set lists them here for that reason.
		...cartResolvers
	],
	exports: [
		CommerceCartService,
		CommerceCartLineService,
		CommerceCartShippingMethodService,
		CommerceCartPromotionService,
		CommerceCheckoutSessionService
	]
})
export class CartModule {}
