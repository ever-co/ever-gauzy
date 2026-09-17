import { gql } from 'graphql-tag';

/**
 * GraphQL surface of the inventory domain.
 *
 * The shape mirrors the REST resources exactly: the same concepts, the same fields and the same
 * permission on every entry point. GraphQL is an additional protocol for the same capability, never a
 * second, more permissive way in.
 */
export const inventorySchemaExtensions = gql`
	type StockMovement {
		id: ID!
		warehouseId: ID!
		variantId: ID!
		binId: ID
		type: String!
		quantity: Float!
		quantityBefore: Float!
		quantityAfter: Float!
		reservedBefore: Float!
		reservedAfter: Float!
		referenceType: String!
		referenceId: ID!
		reason: String
		note: String
		occurredAt: DateTime!
	}

	type StockReservation {
		id: ID!
		variantId: ID!
		warehouseId: ID!
		quantity: Float!
		status: String!
		referenceType: String!
		referenceId: ID!
		lineId: ID
		expiresAt: DateTime
		releasedAt: DateTime
		consumedAt: DateTime
		isBackorder: Boolean!
		expectedAt: DateTime
	}

	type StockTransferLine {
		id: ID!
		transferId: ID!
		variantId: ID!
		requestedQuantity: Float!
		shippedQuantity: Float!
		receivedQuantity: Float!
		damagedQuantity: Float!
		unitCost: Float
		note: String
	}

	type StockTransfer {
		id: ID!
		number: String!
		fromWarehouseId: ID!
		toWarehouseId: ID!
		status: String!
		shippedAt: DateTime
		receivedAt: DateTime
		note: String
		version: Int!
		lines: [StockTransferLine!]
	}

	type StockAlert {
		id: ID!
		variantId: ID!
		warehouseId: ID
		threshold: Float!
		notifyEmails: [String!]
		notifyRoles: [String!]
		isActive: Boolean!
		lastTriggeredAt: DateTime
		cooldownMinutes: Int!
	}

	type StockAdjustment {
		id: ID!
		number: String!
		warehouseId: ID!
		variantId: ID!
		type: String!
		quantity: Float!
		reasonCode: String
		reason: String
		note: String
		status: String!
		appliedAt: DateTime
		appliedByUserId: ID
		movementId: ID
	}

	type StockCountLine {
		id: ID!
		stockCountId: ID!
		variantId: ID!
		binId: ID
		binPathSnapshot: String
		expectedQuantity: Float!
		countedQuantity: Float
		recountedQuantity: Float
		variance: Float
		status: String!
		countedAt: DateTime
		movementId: ID
		note: String
	}

	type StockCount {
		id: ID!
		number: String!
		warehouseId: ID!
		status: String!
		mode: String!
		blindCount: Boolean!
		freezeMovements: Boolean!
		countedLineCount: Int!
		varianceUnits: Float!
		varianceValue: Float!
		startedAt: DateTime
		closedAt: DateTime
		note: String
		lines: [StockCountLine!]
	}

	type ChannelWarehouse {
		id: ID!
		channelId: ID!
		warehouseId: ID!
		isDefault: Boolean!
		priority: Int!
	}

	"""Availability of one variant at one location. Derived, never stored."""
	type InventoryLevel {
		id: ID!
		warehouseId: ID!
		variantId: ID!
		quantity: Float!
		reservedQuantity: Float!
		safetyStock: Float!
		availableQuantity: Float!
		incomingQuantity: Float!
		isUnlimited: Boolean!
		allowBackorder: Boolean!
		backorderLimit: Float
	}

	extend type Query {
		inventoryLevels(warehouseId: ID, variantId: ID): [InventoryLevel!]!
		inventoryLevel(warehouseId: ID!, variantId: ID!): InventoryLevel
		availableQuantity(warehouseId: ID!, variantId: ID!): Float!
		stockMovements(warehouseId: ID!, variantId: ID!, take: Int): [StockMovement!]!
		stockReservations(referenceType: String, referenceId: ID, status: String): [StockReservation!]!
		stockReservation(id: ID!): StockReservation
		stockTransfers(status: String): [StockTransfer!]!
		stockTransfer(id: ID!): StockTransfer
		stockAlerts(variantId: ID, isActive: Boolean): [StockAlert!]!
		stockAdjustments(warehouseId: ID, variantId: ID, status: String): [StockAdjustment!]!
		stockCounts(warehouseId: ID, status: String, mode: String): [StockCount!]!
		stockCount(id: ID!): StockCount
		channelWarehouses(channelId: ID, warehouseId: ID): [ChannelWarehouse!]!
	}

	extend type Mutation {
		adjustStock(input: StockAdjustmentInput!): StockAdjustment!
		applyStockAdjustment(id: ID!): StockAdjustment!
		createStockReservation(input: StockReservationInput!): StockReservation!
		releaseStockReservation(id: ID!, reason: String): StockReservation!
		consumeStockReservation(id: ID!): StockReservation!
		createStockTransfer(input: StockTransferInput!): StockTransfer!
		updateStockTransfer(id: ID!, note: String): StockTransfer!
		shipStockTransfer(id: ID!, lines: [StockTransferShipLineInput!]!): StockTransfer!
		receiveStockTransfer(id: ID!, lines: [StockTransferReceiveLineInput!]!): StockTransfer!
		cancelStockTransfer(id: ID!, reason: String): StockTransfer!
		createStockAlert(input: StockAlertInput!): StockAlert!
		updateStockAlert(id: ID!, input: StockAlertInput!): StockAlert!
		deleteStockAlert(id: ID!): Boolean!
		createStockCount(input: StockCountInput!): StockCount!
		openStockCount(id: ID!): StockCount!
		recordStockCountLine(id: ID!, lines: [StockCountLineInput!]!): StockCount!
		closeStockCount(id: ID!): StockCount!
		assignChannelWarehouse(input: ChannelWarehouseInput!): ChannelWarehouse!
		unassignChannelWarehouse(channelId: ID!, warehouseId: ID!): Boolean!
	}

	input StockAdjustmentInput {
		warehouseId: ID!
		variantId: ID!
		type: String!
		quantity: Float!
		reasonCode: String
		reason: String
		note: String
	}

	input StockReservationInput {
		variantId: ID!
		productId: ID!
		warehouseId: ID!
		quantity: Float!
		referenceType: String!
		referenceId: ID!
		lineId: ID
		expiresAt: DateTime
		allowBackorder: Boolean
	}

	input StockTransferInput {
		fromWarehouseId: ID!
		toWarehouseId: ID!
		note: String
		lines: [StockTransferLineInput!]
	}

	input StockTransferLineInput {
		variantId: ID!
		requestedQuantity: Float!
		unitCost: Float
	}

	input StockTransferShipLineInput {
		lineId: ID!
		shippedQuantity: Float!
	}

	input StockTransferReceiveLineInput {
		lineId: ID!
		receivedQuantity: Float!
		damagedQuantity: Float
	}

	input StockAlertInput {
		variantId: ID!
		warehouseId: ID
		threshold: Float!
		notifyEmails: [String!]
		notifyRoles: [String!]
		cooldownMinutes: Int
		isActive: Boolean
	}

	input StockCountInput {
		warehouseId: ID!
		mode: String
		blindCount: Boolean
		freezeMovements: Boolean
		scope: JSON
		note: String
	}

	input StockCountLineInput {
		lineId: ID!
		countedQuantity: Float!
		note: String
	}

	input ChannelWarehouseInput {
		channelId: ID!
		warehouseId: ID!
		isDefault: Boolean
		priority: Int
	}

	extend type Subscription {
		inventoryLevelChanged(warehouseId: ID, variantId: ID): InventoryLevel!
		inventoryLevelLow(warehouseId: ID): InventoryLevel!
		inventoryLevelOutOfStock(warehouseId: ID): InventoryLevel!
		stockReservationChanged(referenceId: ID): StockReservation!
		stockTransferChanged(id: ID): StockTransfer!
	}
`;
