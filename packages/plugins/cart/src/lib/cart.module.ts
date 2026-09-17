import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AdjustmentModule, TaxLineModule } from '@gauzy/core';
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

/**
 * The cart module.
 *
 * Every entity is registered with both ORMs from the one entity array, so the package cannot boot with
 * a table TypeORM knows about and MikroORM does not. The core adjustment and tax-line modules are
 * imported because the cart's money is *their* rows: the cart writes the ledger and recomputes its own
 * cache from it, and it must not keep a second copy of a discount or of a tax amount.
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
		MikroOrmCommerceCheckoutSessionRepository
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
