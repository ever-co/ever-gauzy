import { Fulfillment } from '../fulfillment/fulfillment.entity';
import { FulfillmentLine } from '../fulfillment-line/fulfillment-line.entity';
import { ShippingOption } from '../shipping-option/shipping-option.entity';
import { ShippingProfile } from '../shipping-profile/shipping-profile.entity';
import { ShippingProfileVariant } from '../shipping-profile-variant/shipping-profile-variant.entity';

export { Fulfillment } from '../fulfillment/fulfillment.entity';
export { FulfillmentLine } from '../fulfillment-line/fulfillment-line.entity';
export { ShippingOption } from '../shipping-option/shipping-option.entity';
export { ShippingProfile } from '../shipping-profile/shipping-profile.entity';
export { ShippingProfileVariant } from '../shipping-profile-variant/shipping-profile-variant.entity';

/**
 * Every entity this plugin owns.
 *
 * The array is the single source for the plugin's `entities` metadata and for the per-ORM feature
 * registration of its module, so a table cannot reach one ORM and miss the other.
 */
export const ALL_FULFILLMENT_ENTITIES = [
	ShippingProfile,
	ShippingProfileVariant,
	ShippingOption,
	Fulfillment,
	FulfillmentLine
];
