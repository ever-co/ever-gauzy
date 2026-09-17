import { RolePermissionModule } from '@gauzy/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ALL_FULFILLMENT_ENTITIES } from './entities';
import { OrderModule } from '@gauzy/plugin-order';
import { FulfillmentController } from './fulfillment/fulfillment.controller';
import { FulfillmentService } from './fulfillment/fulfillment.service';
import { TypeOrmFulfillmentRepository } from './fulfillment/repository/type-orm-fulfillment.repository';
import { MikroOrmFulfillmentRepository } from './fulfillment/repository/mikro-orm-fulfillment.repository';
import { FulfillmentLineController } from './fulfillment-line/fulfillment-line.controller';
import { FulfillmentLineService } from './fulfillment-line/fulfillment-line.service';
import { TypeOrmFulfillmentLineRepository } from './fulfillment-line/repository/type-orm-fulfillment-line.repository';
import { MikroOrmFulfillmentLineRepository } from './fulfillment-line/repository/mikro-orm-fulfillment-line.repository';
import { ShippingOptionController } from './shipping-option/shipping-option.controller';
import { ShippingOptionService } from './shipping-option/shipping-option.service';
import { TypeOrmShippingOptionRepository } from './shipping-option/repository/type-orm-shipping-option.repository';
import { MikroOrmShippingOptionRepository } from './shipping-option/repository/mikro-orm-shipping-option.repository';
import { ShippingProfileController } from './shipping-profile/shipping-profile.controller';
import { ShippingProfileService } from './shipping-profile/shipping-profile.service';
import { TypeOrmShippingProfileRepository } from './shipping-profile/repository/type-orm-shipping-profile.repository';
import { MikroOrmShippingProfileRepository } from './shipping-profile/repository/mikro-orm-shipping-profile.repository';
import { ShippingProfileVariantController } from './shipping-profile-variant/shipping-profile-variant.controller';
import { ShippingProfileVariantService } from './shipping-profile-variant/shipping-profile-variant.service';
import { TypeOrmShippingProfileVariantRepository } from './shipping-profile-variant/repository/type-orm-shipping-profile-variant.repository';
import { MikroOrmShippingProfileVariantRepository } from './shipping-profile-variant/repository/mikro-orm-shipping-profile-variant.repository';

/**
 * The fulfilment module.
 *
 * Every entity is registered with both ORMs from the one entity array. The order module is imported for
 * one reason: a fulfilment line maintains the order line's own quantity counters, because those counters
 * are what the order's materialised fulfilment status is derived from — and a second implementation of
 * that derivation would be a second answer to "how much of this line has shipped?".
 */
@Module({
	controllers: [
		FulfillmentController,
		FulfillmentLineController,
		ShippingOptionController,
		ShippingProfileController,
		ShippingProfileVariantController
	],
	imports: [
		// The controllers below are guarded, and the guard resolves the caller's permissions.
		RolePermissionModule,
		TypeOrmModule.forFeature(ALL_FULFILLMENT_ENTITIES),
		MikroOrmModule.forFeature(ALL_FULFILLMENT_ENTITIES),
		OrderModule
	],
	providers: [
		FulfillmentService,
		TypeOrmFulfillmentRepository,
		MikroOrmFulfillmentRepository,
		FulfillmentLineService,
		TypeOrmFulfillmentLineRepository,
		MikroOrmFulfillmentLineRepository,
		ShippingOptionService,
		TypeOrmShippingOptionRepository,
		MikroOrmShippingOptionRepository,
		ShippingProfileService,
		TypeOrmShippingProfileRepository,
		MikroOrmShippingProfileRepository,
		ShippingProfileVariantService,
		TypeOrmShippingProfileVariantRepository,
		MikroOrmShippingProfileVariantRepository
	],
	exports: [
		FulfillmentService,
		FulfillmentLineService,
		ShippingOptionService,
		ShippingProfileService,
		ShippingProfileVariantService
	]
})
export class FulfillmentModule {}
