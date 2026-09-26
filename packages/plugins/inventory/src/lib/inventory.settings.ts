/**
 * Setting keys the inventory plugin reads.
 *
 * Declaring them makes each one resolvable per tenant, per organization and per channel without a
 * code change, and gives an operator the default the plugin assumes when nothing is stored.
 */
import { PluginSettingContribution } from '@gauzy/plugin';

/** The setting keys this plugin reads. */
export const InventorySetting = {
	RESERVATION_TTL_MINUTES: 'stock.reservationTtlMinutes',
	ORDER_RESERVATION_TTL_MINUTES: 'stock.orderReservationTtlMinutes',
	POST_PURCHASE_RESERVATION_TTL_MINUTES: 'stock.postPurchaseReservationTtlMinutes',
	TRANSFER_RESERVATION_TTL_MINUTES: 'stock.transferReservationTtlMinutes',
	SUBSCRIPTION_RESERVATION_TTL_MINUTES: 'stock.subscriptionReservationTtlMinutes',
	EXPIRY_BATCH_SIZE: 'stock.reservationExpiryBatchSize',
	EXPIRY_MAX_BATCHES: 'stock.reservationExpiryMaxBatches',
	LOW_STOCK_SCAN_MINUTES: 'stock.lowStockScanMinutes',
	RECONCILE_BATCH_SIZE: 'stock.reconcileBatchSize'
} as const;

/** The catalogue entries the plugin contributes to the platform setting schema. */
export const INVENTORY_SETTINGS: PluginSettingContribution[] = [
	{
		key: InventorySetting.RESERVATION_TTL_MINUTES,
		type: 'number',
		default: 30,
		scope: 'CHANNEL',
		description: 'How long a cart hold survives without activity, in minutes.'
	},
	{
		key: InventorySetting.ORDER_RESERVATION_TTL_MINUTES,
		type: 'number',
		default: 10080,
		scope: 'CHANNEL',
		description: 'How long an order hold survives before fulfilment consumes it, in minutes.'
	},
	{
		key: InventorySetting.POST_PURCHASE_RESERVATION_TTL_MINUTES,
		type: 'number',
		default: 20160,
		scope: 'CHANNEL',
		description: 'How long a return, claim or exchange replacement hold survives, in minutes.'
	},
	{
		key: InventorySetting.TRANSFER_RESERVATION_TTL_MINUTES,
		type: 'number',
		default: 10080,
		scope: 'CHANNEL',
		description: 'How long a transfer hold survives at the source location, in minutes.'
	},
	{
		key: InventorySetting.SUBSCRIPTION_RESERVATION_TTL_MINUTES,
		type: 'number',
		default: 4320,
		scope: 'CHANNEL',
		description: 'How long a recurring-billing hold survives before the cycle ships, in minutes.'
	},
	{
		key: InventorySetting.EXPIRY_BATCH_SIZE,
		type: 'number',
		default: 500,
		scope: 'ORGANIZATION',
		description: 'Reservations selected per transaction by the expiry sweep.'
	},
	{
		key: InventorySetting.EXPIRY_MAX_BATCHES,
		type: 'number',
		default: 200,
		scope: 'ORGANIZATION',
		description: 'Hard cap on the batches one expiry sweep may process, so a backlog cannot monopolise the worker.'
	},
	{
		key: InventorySetting.LOW_STOCK_SCAN_MINUTES,
		type: 'number',
		default: 15,
		scope: 'ORGANIZATION',
		description: 'How often the low-stock scan evaluates the alert rules.'
	},
	{
		key: InventorySetting.RECONCILE_BATCH_SIZE,
		type: 'number',
		default: 500,
		scope: 'ORGANIZATION',
		description: 'Level rows reconciled per transaction by the nightly reconciliation.'
	}
];
