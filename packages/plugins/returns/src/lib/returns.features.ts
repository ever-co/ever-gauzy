import { FeatureEnum } from '@gauzy/contracts';
import { PluginFeatureContribution } from '@gauzy/plugin';

/**
 * The feature codes this plugin gates its endpoints with.
 *
 * @param code The feature code.
 * @returns The code, as the platform feature enum.
 */
function feature(code: string): FeatureEnum {
	return code as unknown as FeatureEnum;
}

/**
 * Feature flags the returns domain uses.
 *
 * The module flag is read through `@FeatureFlag` on every controller this plugin registers, so a
 * tenant that does not run post-purchase flows carries the tables (empty) and none of the endpoints.
 */
export const ReturnsFeatures = {
	/** Post-purchase returns, claims and exchanges. */
	RETURNS: feature('FEATURE_RETURNS')
} as const;

/**
 * The feature catalogue this plugin contributes.
 *
 * The flag defaults to off: enabling it changes financial and stock behaviour, and it is only
 * meaningful once the tenant has written a return policy — the governed reasons, the return window
 * and the restocking rule all have to exist before the first request is accepted.
 */
export const RETURNS_FEATURES: PluginFeatureContribution[] = [
	{
		code: 'FEATURE_RETURNS',
		name: 'Returns, claims and exchanges',
		description:
			'Accept goods back against a delivered order, record claims about it, and price a return that immediately becomes a new shipment.',
		icon: 'undo-outline',
		defaultEnabled: false
	}
];
