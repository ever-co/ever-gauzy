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
		"Cost carried across the transfer for valuation, as an exact decimal."
		unitCost: Decimal
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
		"Variance of the session valued at the recorded unit cost, as an exact decimal."
		varianceValue: Decimal!
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
	type StockLevel {
		id: ID!
		warehouseId: ID!
		variantId: ID!
		"""
		The counter a conditional write is stated against. It travels with the availability because a
		client can only condition a write on a version it has read.
		"""
		version: Int!
		quantity: Float!
		reservedQuantity: Float!
		safetyStock: Float!
		availableQuantity: Float!
		incomingQuantity: Float!
		isUnlimited: Boolean!
		allowBackorder: Boolean!
		backorderLimit: Float
	}

	"""One level a reconciliation put back in agreement with its movement ledger."""
	type StockLevelCorrection {
		levelId: ID!
		warehouseId: ID!
		variantId: ID!
		quantityBefore: Float!
		ledgerQuantity: Float!
		quantityAfter: Float!
	}

	"""What one reconciliation run scanned, and what it corrected."""
	type StockLevelReconciliation {
		scanned: Int!
		corrected: Int!
		corrections: [StockLevelCorrection!]!
	}

	"A page of stock movements."
	type StockMovementConnection {
		nodes: [StockMovement!]!
		edges: [StockMovementEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One stock movement in a page, with the cursor that addresses it."
	type StockMovementEdge {
		node: StockMovement!
		cursor: String!
	}

	"A page of stock reservations."
	type StockReservationConnection {
		nodes: [StockReservation!]!
		edges: [StockReservationEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One stock reservation in a page, with the cursor that addresses it."
	type StockReservationEdge {
		node: StockReservation!
		cursor: String!
	}

	"A page of stock transfers."
	type StockTransferConnection {
		nodes: [StockTransfer!]!
		edges: [StockTransferEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One stock transfer in a page, with the cursor that addresses it."
	type StockTransferEdge {
		node: StockTransfer!
		cursor: String!
	}

	"A page of stock transfer lines."
	type StockTransferLineConnection {
		nodes: [StockTransferLine!]!
		edges: [StockTransferLineEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One stock transfer line in a page, with the cursor that addresses it."
	type StockTransferLineEdge {
		node: StockTransferLine!
		cursor: String!
	}

	"A page of stock alerts."
	type StockAlertConnection {
		nodes: [StockAlert!]!
		edges: [StockAlertEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One stock alert in a page, with the cursor that addresses it."
	type StockAlertEdge {
		node: StockAlert!
		cursor: String!
	}

	"A page of stock adjustments."
	type StockAdjustmentConnection {
		nodes: [StockAdjustment!]!
		edges: [StockAdjustmentEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One stock adjustment in a page, with the cursor that addresses it."
	type StockAdjustmentEdge {
		node: StockAdjustment!
		cursor: String!
	}

	"A page of stock count sessions."
	type StockCountConnection {
		nodes: [StockCount!]!
		edges: [StockCountEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One stock count session in a page, with the cursor that addresses it."
	type StockCountEdge {
		node: StockCount!
		cursor: String!
	}

	"A page of stock count lines."
	type StockCountLineConnection {
		nodes: [StockCountLine!]!
		edges: [StockCountLineEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One stock count line in a page, with the cursor that addresses it."
	type StockCountLineEdge {
		node: StockCountLine!
		cursor: String!
	}

	"A page of channel assignments."
	type ChannelWarehouseConnection {
		nodes: [ChannelWarehouse!]!
		edges: [ChannelWarehouseEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One channel assignment in a page, with the cursor that addresses it."
	type ChannelWarehouseEdge {
		node: ChannelWarehouse!
		cursor: String!
	}

	"One level in a page, with the cursor that addresses it."
	type StockLevelEdge {
		node: StockLevel!
		cursor: String!
	}

	"A page of stock levels, with their derived availability."
	type StockLevelConnection {
		nodes: [StockLevel!]!
		edges: [StockLevelEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	extend type Query {
		"""
		The levels of a location, of a variant, or of both.

		The page is read from the service's own paged read, which answers the window and counts the set the
		filters select on one predicate — the two things a connection owes its caller and the reason this
		field was a bare list until that read existed.
		"""
		stockLevels(warehouseId: ID, variantId: ID, page: PageInput): StockLevelConnection!
		stockLevel(warehouseId: ID!, variantId: ID!): StockLevel
		availableQuantity(warehouseId: ID!, variantId: ID!): Float!
		stockMovements(warehouseId: ID!, variantId: ID!, page: PageInput): StockMovementConnection!
		stockReservations(
			referenceType: String
			referenceId: ID
			status: String
			page: PageInput
		): StockReservationConnection!
		stockReservation(id: ID!): StockReservation
		stockTransfers(status: String, page: PageInput): StockTransferConnection!
		stockTransfer(id: ID!): StockTransfer
		stockTransferLines(transferId: ID!, page: PageInput): StockTransferLineConnection!
		stockTransferLine(id: ID!): StockTransferLine
		stockAlerts(variantId: ID, isActive: Boolean, page: PageInput): StockAlertConnection!
		stockAdjustments(warehouseId: ID, variantId: ID, status: String, page: PageInput): StockAdjustmentConnection!
		stockCounts(warehouseId: ID, status: String, mode: String, page: PageInput): StockCountConnection!
		stockCount(id: ID!): StockCount
		stockCountLines(stockCountId: ID!, page: PageInput): StockCountLineConnection!
		stockCountLine(id: ID!): StockCountLine
		stockCountVariance(stockCountId: ID!): StockCountVariance!
		channelWarehouses(channelId: ID, warehouseId: ID, page: PageInput): ChannelWarehouseConnection!
	}

	extend type Mutation {
		reconcileStockLevels(input: StockLevelReconciliationInput): StockLevelReconciliation!
		adjustStock(input: StockAdjustmentInput!): StockAdjustment!
		"""
		Applies a drafted correction. The key is the resolver's own argument here because the mutation
		has no input object to carry it; the kernel reads both spellings, so the two protocols answer
		identically.
		"""
		applyStockAdjustment(id: ID!, idempotencyKey: String): StockAdjustment!
		createStockReservation(input: StockReservationInput!): StockReservation!
		releaseStockReservation(id: ID!, reason: String, idempotencyKey: String): StockReservation!
		consumeStockReservation(id: ID!): StockReservation!
		createStockTransfer(input: StockTransferInput!): StockTransfer!
		updateStockTransfer(id: ID!, note: String): StockTransfer!
		shipStockTransfer(id: ID!, lines: [StockTransferShipLineInput!]!, idempotencyKey: String): StockTransfer!
		receiveStockTransfer(id: ID!, lines: [StockTransferReceiveLineInput!]!, idempotencyKey: String): StockTransfer!
		cancelStockTransfer(id: ID!, reason: String): StockTransfer!
		addStockTransferLine(input: StockTransferLineInput!): StockTransferLine!
		createStockAlert(input: StockAlertInput!): StockAlert!
		updateStockAlert(id: ID!, input: StockAlertInput!): StockAlert!
		deleteStockAlert(id: ID!): Boolean!
		createStockCount(input: StockCountInput!): StockCount!
		openStockCount(id: ID!): StockCount!
		recordStockCountLine(id: ID!, lines: [StockCountLineInput!]!, idempotencyKey: String): StockCount!
		closeStockCount(id: ID!, idempotencyKey: String): StockCount!
		assignChannelWarehouse(input: ChannelWarehouseInput!): ChannelWarehouse!
		unassignChannelWarehouse(channelId: ID!, warehouseId: ID!): Boolean!
	}

	"""
	What the caller wants a reconciliation run to walk. Everything may be left out.

	\`version\` is the level counter the run is conditioned on and \`idempotencyKey\` the key a retry
	presents. Both are nullable, and both answer exactly as the REST route answers: a version that has
	moved is refused with the platform's conflict code, and a key already used for this request is
	replayed instead of running the run a second time.
	"""
	input StockLevelReconciliationInput {
		warehouseId: ID
		variantId: ID
		take: Int
		version: Int
		idempotencyKey: String
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

	"""
	The hold a caller wants placed. \`version\` is the level counter the availability decision was
	made from and \`idempotencyKey\` the key a retry presents; both mirror the REST route, and both are
	nullable so a caller that states neither is answered rather than refused.
	"""
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
		version: Int
		idempotencyKey: String
	}

	"""The transfer a caller wants drafted. \`idempotencyKey\` makes a retry of the draft safe."""
	input StockTransferInput {
		fromWarehouseId: ID!
		toWarehouseId: ID!
		note: String
		lines: [StockTransferLineInput!]
		idempotencyKey: String
	}

	input StockTransferLineInput {
		transferId: ID
		variantId: ID!
		requestedQuantity: Float!
		"Cost carried across the transfer for valuation, as an exact decimal."
		unitCost: Decimal
		note: String
	}

	"""The variance of one count session, in units and valued at the recorded unit cost."""
	type StockCountVariance {
		units: Float!
		"Variance valued at the recorded unit cost, as an exact decimal."
		value: Decimal!
		unpricedLines: Int!
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

	"""The alert rule a caller wants created. \`idempotencyKey\` makes a retry of the rule safe."""
	input StockAlertInput {
		variantId: ID!
		warehouseId: ID
		threshold: Float!
		notifyEmails: [String!]
		notifyRoles: [String!]
		cooldownMinutes: Int
		isActive: Boolean
		idempotencyKey: String
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
		stockLevelChanged(warehouseId: ID, variantId: ID): StockLevel!
		stockLevelLow(warehouseId: ID): StockLevel!
		stockLevelOutOfStock(warehouseId: ID): StockLevel!
		stockReservationChanged(referenceId: ID): StockReservation!
		stockTransferChanged(id: ID): StockTransfer!
	}
`;
