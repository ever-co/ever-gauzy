/**
 * Public API Surface of @gauzy/plugin-fulfillment
 */
export * from './lib/fulfillment.plugin';
export * from './lib/fulfillment.module';
export * from './lib/fulfillment.quantity';
export * from './lib/fulfillment.permissions';
export * from './lib/fulfillment.features';
export * from './lib/entities';
export * from './lib/database/fulfillment-migrations';
export * from './lib/database/migrations/1791000000240-CreateFulfillmentTables';
export * from './lib/database/migrations/1791000000250-AddCartShippingOptionForeignKey';
export * from './lib/graphql';
export * from './lib/graphql/schema-extensions';
// The GraphQL type module is exported by name rather than wholesale. Two of its members already
// exist elsewhere in this barrel — the aliases `Fulfillment`, `FulfillmentLine`, `ShippingOption`,
// `ShippingProfile` and `ShippingProfileVariant` name the entities `./lib/entities` exports, and
// `IShippingOptionEligibility` is also declared by the shipping-option service — and a `export *`
// of both makes every one of them ambiguous, which the compiler reports as an error rather than
// picking a winner. What is genuinely this module's own — the connection and rate shapes a client
// reads — is named here.
export {
	IFulfillmentConnection,
	IShippingOptionConnection,
	IShippingProfileConnection,
	IShippingRate
} from './lib/graphql/types';

export * from './lib/fulfillment/fulfillment.entity';
export * from './lib/fulfillment/fulfillment.service';
export * from './lib/fulfillment/fulfillment.controller';
export * from './lib/fulfillment/dto';
export * from './lib/fulfillment/repository/type-orm-fulfillment.repository';
export * from './lib/fulfillment/repository/mikro-orm-fulfillment.repository';

export * from './lib/fulfillment-line/fulfillment-line.entity';
export * from './lib/fulfillment-line/fulfillment-line.service';
export * from './lib/fulfillment-line/fulfillment-line.controller';
export * from './lib/fulfillment-line/dto';
export * from './lib/fulfillment-line/repository/type-orm-fulfillment-line.repository';
export * from './lib/fulfillment-line/repository/mikro-orm-fulfillment-line.repository';

export * from './lib/shipping-option/shipping-option.entity';
export * from './lib/shipping-option/shipping-option.service';
export * from './lib/shipping-option/shipping-option.controller';
export * from './lib/shipping-option/dto';
export * from './lib/shipping-option/repository/type-orm-shipping-option.repository';
export * from './lib/shipping-option/repository/mikro-orm-shipping-option.repository';

export * from './lib/shipping-profile/shipping-profile.entity';
export * from './lib/shipping-profile/shipping-profile.service';
export * from './lib/shipping-profile/shipping-profile.controller';
export * from './lib/shipping-profile/dto';
export * from './lib/shipping-profile/repository/type-orm-shipping-profile.repository';
export * from './lib/shipping-profile/repository/mikro-orm-shipping-profile.repository';

export * from './lib/shipping-profile-variant/shipping-profile-variant.entity';
export * from './lib/shipping-profile-variant/shipping-profile-variant.service';
export * from './lib/shipping-profile-variant/shipping-profile-variant.controller';
export * from './lib/shipping-profile-variant/dto';
export * from './lib/shipping-profile-variant/repository/type-orm-shipping-profile-variant.repository';
export * from './lib/shipping-profile-variant/repository/mikro-orm-shipping-profile-variant.repository';
