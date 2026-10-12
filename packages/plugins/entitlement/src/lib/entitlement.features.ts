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
 * Feature flags the entitlement domain uses.
 *
 * The module flag is read through `@FeatureFlag` on every controller and resolver this plugin
 * registers, so a tenant that does not sell rights carries the tables (empty) and none of the
 * endpoints.
 */
export const EntitlementFeatures = {
	/** Licences, seats, terms and the activations against them. */
	ENTITLEMENT: feature('FEATURE_ENTITLEMENT')
} as const;

/**
 * The feature catalogue this plugin contributes.
 *
 * The flag defaults to off: enabling it changes what a customer is allowed to run and mints bearer
 * credentials, and it is only meaningful once the tenant has decided which of its products grant a
 * right at all.
 */
export const ENTITLEMENT_FEATURES: PluginFeatureContribution[] = [
	{
		code: 'FEATURE_ENTITLEMENT',
		name: 'Entitlements, activations and licence keys',
		description:
			'Issue the rights a purchase grants, activate them against a device or a named seat, and issue the licence keys they are delivered as.',
		icon: 'key-outline',
		defaultEnabled: false
	}
];
