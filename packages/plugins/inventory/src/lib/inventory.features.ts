/**
 * Feature flags declared by the inventory plugin.
 *
 * A feature is registered in the platform catalogue and toggled per tenant. The module flag ships
 * enabled because the tables it adds are only written by the flows that already own stock; the
 * allocation flag ships disabled because a single-location tenant should not see a strategy it does
 * not use.
 */
import { PluginFeatureContribution } from '@gauzy/plugin';

/** The feature codes this plugin contributes. */
export const InventoryFeature = {
	FEATURE_INVENTORY: 'FEATURE_INVENTORY',
	FEATURE_MULTI_WAREHOUSE: 'FEATURE_MULTI_WAREHOUSE'
} as const;

/** The catalogue entries the plugin contributes to the platform feature catalogue. */
export const INVENTORY_FEATURES: PluginFeatureContribution[] = [
	{
		code: InventoryFeature.FEATURE_INVENTORY,
		name: 'Inventory ledger and reservations',
		description:
			'Movement ledger, reservations, transfers, alerts, adjustments, counts and reconciliation.',
		defaultEnabled: true
	},
	{
		code: InventoryFeature.FEATURE_MULTI_WAREHOUSE,
		name: 'Multi-location allocation',
		description:
			'Allocation split across locations, per-location availability and transfers between them.',
		defaultEnabled: false,
		dependsOn: [InventoryFeature.FEATURE_INVENTORY]
	}
];
