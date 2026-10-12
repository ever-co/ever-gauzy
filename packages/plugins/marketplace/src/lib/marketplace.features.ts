import { PluginFeatureContribution } from '@gauzy/plugin';

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
