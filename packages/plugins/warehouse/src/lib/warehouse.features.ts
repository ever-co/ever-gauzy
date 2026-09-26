import { FeatureEnum } from '@gauzy/contracts';
import { PluginFeatureContribution } from '@gauzy/plugin';

/**
 * Carries a feature code this plugin gates its endpoints with.
 *
 * @param code The feature code.
 * @returns The code, in the shape the guard reads its metadata in.
 */
function feature(code: string): FeatureEnum {
	return code as unknown as FeatureEnum;
}

/**
 * Feature flags the warehouse domain uses.
 *
 * The flag is read through `@FeatureFlag` on every controller this plugin registers, so a tenant that
 * has not adopted zones and bins carries the tables (empty) and none of the endpoints.
 */
export const WarehouseFeatures = {
	/** Zones, bins, picking, packing and carrier manifests. */
	WAREHOUSE: feature('FEATURE_WAREHOUSE')
} as const;

/**
 * The feature catalogue this plugin contributes.
 *
 * The flag defaults to off. Adopting it changes how a location addresses the units inside it and puts
 * work in front of people, so it is enabled deliberately, once the building's areas and positions have
 * been described — a location with no pickable zone routes every generated line to nowhere.
 */
export const WAREHOUSE_FEATURES: PluginFeatureContribution[] = [
	{
		code: 'FEATURE_WAREHOUSE',
		name: 'Warehouse management',
		description:
			'Describe the inside of a stock location, derive picking work from what has to ship, confirm what was actually collected, pack it and hand the parcels to the carrier.',
		icon: 'cube-outline',
		defaultEnabled: false
	}
];
