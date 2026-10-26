import { FeatureEnum } from '@gauzy/contracts';
import { PluginFeatureContribution } from '@gauzy/plugin';

/**
 * A marketplace feature code, in the type `@FeatureFlag` takes.
 *
 * The codes are not members of the compiled `FeatureEnum` — a package registers its codes as text and
 * the guard compares text — so they are cast here, once, as the other commerce packages cast theirs.
 */
function feature(code: string): FeatureEnum {
	return code as unknown as FeatureEnum;
}

/**
 * The codes the marketplace's surfaces are gated on (review R4-11: until they were, the marketplace was
 * reachable on every tenant whatever this switch said).
 *
 * - every REST controller and the GraphQL resolver state `MARKETPLACE`;
 * - the payout, payout-line and settlement routes, and their GraphQL fields, state `PAYOUTS` too.
 *
 * `PAYOUT_SCHEDULER` gates an automatic payout run, which this package does not ship yet; it is declared
 * so the switch exists when the run does.
 */
export const MarketplaceFeatures = {
	MARKETPLACE: feature('FEATURE_MARKETPLACE'),
	PAYOUTS: feature('FEATURE_MARKETPLACE_PAYOUTS'),
	PAYOUT_SCHEDULER: feature('FEATURE_SELLER_PAYOUT_SCHEDULER')
} as const;

/**
 * The feature flags the marketplace contributes.
 *
 * Each one is off by default and means something narrower than the one before it, so a tenant can
 * adopt the capability in stages rather than all at once:
 *
 * - `FEATURE_MARKETPLACE` registers the endpoints and the tables. Off, nothing about the marketplace
 *   is reachable and no seller exists.
 * - `FEATURE_MARKETPLACE_PAYOUTS` separates "an operator can build a payout" from "the platform pays
 *   third parties" — a tenant may approve sellers and record what they are owed long before it wires a
 *   payout provider.
 * - `FEATURE_SELLER_PAYOUT_SCHEDULER` is the finer gate on the automatic run, so the pass never fires
 *   on a tenant that never opted into paying on a timer.
 */
export const MARKETPLACE_FEATURES: PluginFeatureContribution[] = [
	{
		code: 'FEATURE_MARKETPLACE',
		name: 'Marketplace',
		description: 'Sellers, offerings, commission, the per-seller split of orders, payouts and settlements.',
		defaultEnabled: false
	},
	{
		code: 'FEATURE_MARKETPLACE_PAYOUTS',
		name: 'Marketplace payouts',
		description: 'Building, approving and executing a payout through a payment provider.',
		defaultEnabled: false,
		dependsOn: ['FEATURE_MARKETPLACE']
	},
	{
		code: 'FEATURE_SELLER_PAYOUT_SCHEDULER',
		name: 'Scheduled seller payouts',
		description: 'Automatic payout runs on a seller’s payout schedule, rather than only on an operator’s request.',
		defaultEnabled: false,
		dependsOn: ['FEATURE_MARKETPLACE', 'FEATURE_MARKETPLACE_PAYOUTS']
	}
];
