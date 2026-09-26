import { FeatureEnum } from '@gauzy/contracts';
import { PluginFeatureContribution } from '@gauzy/plugin';

/**
 * The feature code this plugin gates its endpoints with.
 *
 * @param code The feature code.
 * @returns The code, as the platform feature enum.
 */
function feature(code: string): FeatureEnum {
	return code as unknown as FeatureEnum;
}

/**
 * Feature flags the subscription domain uses.
 *
 * The module flag is read through `@FeatureFlag` on every controller this plugin registers, so a
 * tenant that does not sell on a recurring basis carries the tables (empty) and none of the
 * endpoints.
 */
export const SubscriptionFeatures = {
	/** Plans, subscriptions and recurring billing. */
	SUBSCRIPTION: feature('FEATURE_SUBSCRIPTION')
} as const;

/**
 * The feature catalogue this plugin contributes.
 *
 * The flag defaults to off, and the default is the point rather than a formality: a recurring charge
 * needs a stored payment instrument and an explicit business decision, and the billing run is a
 * scheduled job that must never fire on a tenant that did not opt in. Enabling it also changes what
 * the platform does without anybody present — it charges a customer — which is exactly the kind of
 * capability a tenant should have to ask for.
 */
export const SUBSCRIPTION_FEATURES: PluginFeatureContribution[] = [
	{
		code: 'FEATURE_SUBSCRIPTION',
		name: 'Subscriptions and recurring billing',
		description:
			'Sell a plan on a schedule: recurring billing cycles raised through the ordinary order path, trials, proration, dunning and the pause, resume, cancel and expire lifecycle.',
		icon: 'repeat-outline',
		defaultEnabled: false
	}
];
