import { gql } from 'graphql-tag';

/**
 * The GraphQL surface of the warehouse domain.
 *
 * Types, inputs, enums and the domain's root fields, declared as one document that is composed into the
 * platform schema at boot. The root operation types belong to the kernel, so this file only extends
 * them — a second declaration of `type Query` would be a duplicate definition and would fail the schema
 * build.
 *
 * Quantities and weights are `Decimal`, never `Float`: a weight read here and the same weight read over
 * REST are the same string, and a binary fraction cannot hold a gram exactly.
 *
 * The types this domain relates to that the platform already owns — the stock location, the product
 * variant, the level row — are referenced by `ID` rather than redeclared: a second `Warehouse` type in
 * a plugin's document would be a different type with the same name, and the two would drift.
 */
export const schemaExtensions = gql`
	"Where an area of a stock location sits in the work."
	enum WarehouseZoneType {
		RECEIVING
		STORAGE
		PICKING
		PACKING
		STAGING
		SHIPPING
		RETURNS
		QUARANTINE
		DAMAGE
	}

	"What kind of addressable position a bin is."
	enum WarehouseBinType {
		SHELF
		RACK
		PALLET
		BIN
		FLOOR
		DOCK
		STAGING
	}

	"How a wave grouped the work it was generated from."
	enum PickWaveStrategy {
		SINGLE_ORDER
		BATCH
		CLUSTER
		ZONE
		WAVE
	}

	"Where a wave is in its lifecycle."
	enum PickWaveStatus {
		DRAFT
		RELEASED
		IN_PROGRESS
		PICKED
		PARTIALLY_PICKED
		CLOSED
		CANCELED
	}

	"Where a pick list is in its lifecycle."
	enum PickListStatus {
		PENDING
		ASSIGNED
		IN_PROGRESS
		PICKED
		CANCELED
	}

	"What happened to one line on the floor."
	enum PickListLineStatus {
		PENDING
		PICKED
		SHORT
		SKIPPED
		CANCELED
	}

	"Where a pack slip is in its lifecycle."
	enum PackSlipStatus {
		OPEN
		PACKED
		CANCELED
	}

	"Where a carrier manifest is in its lifecycle."
	enum CarrierManifestStatus {
		DRAFT
		CLOSED
		HANDED_OVER
		CANCELED
	}

	"A named area of one stock location."
	type WarehouseZone {
		id: ID!
		"The stock location the area belongs to."
		warehouseId: ID!
		name: String!
		"Unique inside the location."
		code: String!
		type: WarehouseZoneType!
		"Visiting order in the pick path; lower is visited first."
		priority: Int!
		isPickable: Boolean!
		isReceivable: Boolean!
		isShippable: Boolean!
		"Out of service; the stock inside it does not move."
		isBlocked: Boolean!
		minTemperature: Decimal
		maxTemperature: Decimal
		version: Int!
		metadata: JSON
		"The positions inside the area."
		bins: [WarehouseBin!]!
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One addressable storage position inside a zone."
	type WarehouseBin {
		id: ID!
		warehouseId: ID!
		zoneId: ID
		"The parent position; null for a root."
		parentId: ID
		code: String!
		barcode: String
		type: WarehouseBinType!
		isPickable: Boolean!
		isBlocked: Boolean!
		capacityUnits: Decimal
		"The unit \`capacityUnits\` is counted in; null is an uninterpreted count."
		capacityUnitId: ID
		maxWeight: Decimal
		"The mass unit \`maxWeight\` is expressed in; null means the organization's default."
		maxWeightUnitId: ID
		maxVolume: Decimal
		"The volume unit \`maxVolume\` is expressed in; null means the organization's default."
		maxVolumeUnitId: ID
		aisle: String
		rack: String
		level: String
		position: String
		sortOrder: Int!
		version: Int!
		metadata: JSON
		zone: WarehouseZone
		parent: WarehouseBin
		children: [WarehouseBin!]!
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One variant's derived balance in one bin."
	type WarehouseBinBalance {
		binId: ID
		variantId: ID!
		quantity: Decimal!
	}

	"A batch of picking work released to the floor together."
	type PickWave {
		id: ID!
		warehouseId: ID!
		channelId: ID
		number: String!
		strategy: PickWaveStrategy!
		status: PickWaveStatus!
		priority: Int!
		pickerUserId: ID
		plannedAt: DateTime
		releasedAt: DateTime
		startedAt: DateTime
		completedAt: DateTime
		"Cache of the distinct orders the wave covers."
		orderCount: Int!
		"Cache of the lines the wave covers."
		lineCount: Int!
		version: Int!
		metadata: JSON
		pickLists: [PickList!]!
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One list of work for one picker."
	type PickList {
		id: ID!
		waveId: ID
		warehouseId: ID!
		zoneId: ID
		"The shipment this list serves, when it serves one."
		fulfillmentId: ID
		orderId: ID
		number: String!
		status: PickListStatus!
		assignedToUserId: ID
		priority: Int!
		lineCount: Int!
		pickedCount: Int!
		shortCount: Int!
		startedAt: DateTime
		completedAt: DateTime
		note: String
		version: Int!
		metadata: JSON
		wave: PickWave
		lines: [PickListLine!]!
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One line to pick: what, how much, from which bin, and what happened."
	type PickListLine {
		id: ID!
		pickListId: ID!
		orderLineId: ID
		fulfillmentLineId: ID
		variantId: ID!
		binId: ID
		zoneId: ID
		quantityRequested: Decimal!
		quantityPicked: Decimal!
		quantityShort: Decimal!
		status: PickListLineStatus!
		substituteVariantId: ID
		substituteQuantity: Decimal
		substitutionReason: String
		packSlipId: ID
		"Position in the sorted pick path."
		position: Int!
		pickedAt: DateTime
		pickedByUserId: ID
		lotNumber: String
		expiryDate: DateTime
		serialNumbers: [String!]
		note: String
		metadata: JSON
		bin: WarehouseBin
		createdAt: DateTime
		updatedAt: DateTime
	}

	"The packing record: which picked lines went into which package."
	type PackSlip {
		id: ID!
		warehouseId: ID!
		pickListId: ID
		orderId: ID
		fulfillmentId: ID
		number: String!
		status: PackSlipStatus!
		carrierKey: String
		packageCount: Int!
		"The weight of record; never recomputed from the catalogue."
		totalWeight: Decimal
		totalVolume: Decimal
		trackingNumber: String
		labelUrl: String
		packedAt: DateTime
		packedByUserId: ID
		note: String
		version: Int!
		metadata: JSON
		lines: [PickListLine!]!
		createdAt: DateTime
		updatedAt: DateTime
	}

	"The document a carrier accepts: the parcels handed over at one dock."
	type CarrierManifest {
		id: ID!
		warehouseId: ID!
		carrier: String!
		service: String
		number: String!
		status: CarrierManifestStatus!
		manifestDate: DateTime!
		windowFrom: DateTime
		windowTo: DateTime
		shipmentCount: Int!
		packageCount: Int!
		totalWeight: Decimal!
		closedAt: DateTime
		handedOverAt: DateTime
		canceledAt: DateTime
		documentUrl: String
		documentData: JSON
		note: String
		version: Int!
		metadata: JSON
		"The shipments the manifest currently covers, read from the fulfilment capability."
		members: [ManifestMember!]!
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One shipment on a manifest."
	type ManifestMember {
		fulfillmentId: ID!
		warehouseId: ID
		orderId: ID
		carrier: String
		service: String
		shippedAt: DateTime
		trackingNumber: String
		packageCount: Int
		packedWeight: Decimal
	}

	"One page of zones."
	type WarehouseZoneConnection {
		edges: [WarehouseZoneEdge!]!
		nodes: [WarehouseZone!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One zone inside a page."
	type WarehouseZoneEdge {
		cursor: String!
		node: WarehouseZone!
	}

	"One page of bins."
	type WarehouseBinConnection {
		edges: [WarehouseBinEdge!]!
		nodes: [WarehouseBin!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One bin inside a page."
	type WarehouseBinEdge {
		cursor: String!
		node: WarehouseBin!
	}

	"One page of the bins under a bin."
	type WarehouseBinSubtreeConnection {
		edges: [WarehouseBinSubtreeEdge!]!
		nodes: [WarehouseBin!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One bin inside a page of a subtree."
	type WarehouseBinSubtreeEdge {
		cursor: String!
		node: WarehouseBin!
	}

	"One page of a bin's derived contents."
	type WarehouseBinContentsConnection {
		edges: [WarehouseBinContentsEdge!]!
		nodes: [WarehouseBinBalance!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One variant's balance inside a page of a bin's contents."
	type WarehouseBinContentsEdge {
		cursor: String!
		node: WarehouseBinBalance!
	}

	"One page of waves."
	type PickWaveConnection {
		edges: [PickWaveEdge!]!
		nodes: [PickWave!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One wave inside a page."
	type PickWaveEdge {
		cursor: String!
		node: PickWave!
	}

	"One page of pick lists."
	type PickListConnection {
		edges: [PickListEdge!]!
		nodes: [PickList!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One pick list inside a page."
	type PickListEdge {
		cursor: String!
		node: PickList!
	}

	"One page of a pick list's lines."
	type PickListLinesConnection {
		edges: [PickListLinesEdge!]!
		nodes: [PickListLine!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One line inside a page of a pick list's lines."
	type PickListLinesEdge {
		cursor: String!
		node: PickListLine!
	}

	"One page of pack slips."
	type PackSlipConnection {
		edges: [PackSlipEdge!]!
		nodes: [PackSlip!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One pack slip inside a page."
	type PackSlipEdge {
		cursor: String!
		node: PackSlip!
	}

	"One page of manifests."
	type CarrierManifestConnection {
		edges: [CarrierManifestEdge!]!
		nodes: [CarrierManifest!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One manifest inside a page."
	type CarrierManifestEdge {
		cursor: String!
		node: CarrierManifest!
	}

	"Filters a page of zones."
	input WarehouseZoneFilter {
		warehouseId: ID
		type: WarehouseZoneType
		code: String
		isPickable: Boolean
		isBlocked: Boolean
	}

	"Filters a page of bins."
	input WarehouseBinFilter {
		warehouseId: ID
		zoneId: ID
		parentId: ID
		code: String
		type: WarehouseBinType
		isPickable: Boolean
		isBlocked: Boolean
	}

	"Filters a page of waves."
	input PickWaveFilter {
		warehouseId: ID
		status: PickWaveStatus
		strategy: PickWaveStrategy
		pickerUserId: ID
		number: String
	}

	"Filters a page of pick lists."
	input PickListFilter {
		warehouseId: ID
		waveId: ID
		zoneId: ID
		fulfillmentId: ID
		status: PickListStatus
		assignedToUserId: ID
		number: String
	}

	"Filters a page of pack slips."
	input PackSlipFilter {
		warehouseId: ID
		pickListId: ID
		fulfillmentId: ID
		status: PackSlipStatus
		number: String
		trackingNumber: String
	}

	"Filters a page of manifests."
	input CarrierManifestFilter {
		warehouseId: ID
		carrier: String
		status: CarrierManifestStatus
		number: String
		manifestDate: DateTime
	}

	"One zone's place in the walking order."
	input WarehouseZonePriorityInput {
		id: ID!
		priority: Int!
	}

	"The definition of a zone."
	input WarehouseZoneInput {		warehouseId: ID
		name: String
		code: String
		type: WarehouseZoneType
		priority: Int
		isPickable: Boolean
		isReceivable: Boolean
		isShippable: Boolean
		isBlocked: Boolean
		minTemperature: Decimal
		maxTemperature: Decimal
		metadata: JSON
	}

	"The definition of a bin."
	input WarehouseBinInput {
		warehouseId: ID
		zoneId: ID
		parentId: ID
		code: String
		barcode: String
		type: WarehouseBinType
		isPickable: Boolean
		isBlocked: Boolean
		capacityUnits: Decimal
		"The unit \`capacityUnits\` is counted in. A capacity without one cannot be compared with a request."
		capacityUnitId: ID
		maxWeight: Decimal
		"The mass unit \`maxWeight\` is expressed in."
		maxWeightUnitId: ID
		maxVolume: Decimal
		"The volume unit \`maxVolume\` is expressed in."
		maxVolumeUnitId: ID
		aisle: String
		rack: String
		level: String
		position: String
		sortOrder: Int
		metadata: JSON
	}

	"What one capacity measurement found."
	type WarehouseBinCapacityCheck {
		binId: ID!
		"The unit the capacity is declared in; null when the bin declares none."
		capacityUnitId: ID
		"The declared capacity, in \`capacityUnitId\`."
		capacityUnits: Decimal
		"The quantity asked for, as it was supplied."
		requestedQuantity: Decimal!
		"The unit the request was supplied in, when the caller named one."
		requestedUnitId: ID
		"The request converted into the capacity's unit; null when there is nothing to convert into."
		requestedInCapacityUnit: Decimal
		"The exact difference \`capacityUnits - requestedInCapacityUnit\`."
		remainingQuantity: Decimal
		"Whether the request is larger than the declared capacity. A warning, never a refusal."
		exceeded: Boolean!
		"The codes a caller acts on."
		notices: [String!]!
	}

	"One bin whose capacity is declared without the unit it is counted in."
	type WarehouseBinCapacityWarning {
		binId: ID!
		code: String!
		warehouseId: ID!
		type: WarehouseBinType!
		capacityUnits: Decimal!
		"The warning code: WAREHOUSE_BIN_CAPACITY_UNIT_UNDECLARED."
		notice: String!
	}

	"The request one capacity measurement is made of."
	input WarehouseBinCapacityInput {
		binId: ID!
		quantity: Decimal!
		unitId: ID
		"How many of the capacity's units one of the request's units is; one when omitted."
		conversionFactor: Decimal
	}

	"A consecutive range of bins."
	input WarehouseBinRangeInput {
		warehouseId: ID!
		zoneId: ID
		parentId: ID
		from: String!
		count: Int!
		type: WarehouseBinType
		isPickable: Boolean
		sortOrder: Int
	}

	"""
	The scope of a bin reconciliation.

	\`version\` is the level counter the run is conditioned on and \`idempotencyKey\` the key a retry
	presents; both are nullable and both answer exactly as the REST route answers, because a run walks
	a batch of levels and a caller cannot name one version for all of them.
	"""
	input ReconcileBinsInput {
		warehouseId: ID!
		zoneId: ID
		binIds: [ID!]
		repair: Boolean
		version: Int
		idempotencyKey: String
	}

	"What one reconciliation found."
	type BinReconciliationLine {
		binId: ID!
		variantId: ID!
		expectedQuantity: Decimal!
		countedQuantity: Decimal!
		difference: Decimal!
		repaired: Boolean!
		"Where the level row says the variant is kept, when it says."
		homeBinId: ID
		"The units the ledger holds at the location with no bin, which the step reports separately."
		unplacedQuantity: Decimal
		"The sum of binQuantity over the bins of the run."
		placedQuantity: Decimal
		"What the bin this line is about holds, as the ledger derives it."
		declaredQuantity: Decimal
		"The quantity the run relocated for this line, when it wrote a pair."
		relocatedQuantity: Decimal
	}

	"What one reconciliation run did."
	type BinReconciliationReport {
		warehouseId: ID!
		binIds: [ID!]!
		lines: [BinReconciliationLine!]!
		driftCount: Int!
		movementIds: [ID!]!
		"The sum of placedQuantity over the run."
		placedQuantity: Decimal
		"The sum of unplacedQuantity over the run."
		unplacedQuantity: Decimal
	}

	"The definition of a wave."
	input PickWaveInput {
		warehouseId: ID!
		channelId: ID
		priority: Int
		plannedAt: DateTime
		strategy: PickWaveStrategy
		pickerUserId: ID
		"The shipments the wave is planned from."
		fulfillmentIds: [ID!]
	}

	"""
	An update to a wave that has not been released.

	Every member is optional because the route's body is: \`PUT /pick-waves/:id\` is typed
	\`UpdatePickWaveDTO & PickWaveDTO\`, so the patch a REST caller may state is the wave's own columns.
	The counters are re-derived by the service rather than supplied, and the route declares no version
	precondition — so \`version\` here is the column the body names and not a compare-and-set. Both are
	stated because the route states them: a GraphQL caller that could set fewer members than a REST
	caller is the difference this wave exists to remove.
	"""
	input UpdatePickWaveInput {
		warehouseId: ID
		channelId: ID
		number: String
		strategy: PickWaveStrategy
		status: PickWaveStatus
		priority: Int
		pickerUserId: ID
		plannedAt: DateTime
		releasedAt: DateTime
		startedAt: DateTime
		completedAt: DateTime
		orderCount: Int
		lineCount: Int
		version: Int
		metadata: JSON
	}

	"The definition of a pick list."
	input PickListInput {
		warehouseId: ID!
		waveId: ID
		zoneId: ID
		priority: Int
		"The shipments the lines are derived from."
		fulfillmentIds: [ID!]
	}

	"""
	An update to a pick list.

	Every member is optional because the route's body is: \`PUT /pick-lists/:id\` is typed
	\`UpdatePickListDTO & PickListDTO\`, so the patch a REST caller may state is the list's own columns.
	The dispatcher's own edits — the assignee, the priority and the picker-facing note — are its
	reason for existing, and the wider column set is mirrored rather than narrowed because the route
	accepts it: a member a REST caller can write and a GraphQL caller cannot is a capability
	asymmetry, not a tidy schema.
	"""
	input UpdatePickListInput {
		waveId: ID
		warehouseId: ID
		zoneId: ID
		fulfillmentId: ID
		orderId: ID
		number: String
		status: PickListStatus
		assignedToUserId: ID
		priority: Int
		lineCount: Int
		pickedCount: Int
		shortCount: Int
		startedAt: DateTime
		completedAt: DateTime
		note: String
		version: Int
		metadata: JSON
	}

	"What sealing a slip recorded. \`idempotencyKey\` is the key a retry of the seal presents."
	input PackSlipContentInput {
		packageCount: Int!
		totalWeight: Decimal
		totalVolume: Decimal
		carrierKey: String
		trackingNumber: String
		labelUrl: String
		note: String
		idempotencyKey: String
	}

	"""
	An update to an open pack slip.

	Every member is optional because the route's body is: \`PUT /pack-slips/:id\` is typed
	\`UpdatePackSlipDTO & PackSlipDTO\`, so the patch a REST caller may state is the slip's own columns.
	The members are the ones an open slip still owns — the parcel count, the weight and volume of
	record, the carrier and the label — and a \`PACKED\` slip is immutable, which is the service's
	refusal rather than this document's: the same refusal answers the route.
	"""
	input UpdatePackSlipInput {
		warehouseId: ID
		pickListId: ID
		orderId: ID
		fulfillmentId: ID
		number: String
		status: PackSlipStatus
		carrierKey: String
		packageCount: Int
		totalWeight: Decimal
		totalVolume: Decimal
		trackingNumber: String
		labelUrl: String
		packedAt: DateTime
		packedByUserId: ID
		note: String
		version: Int
		metadata: JSON
	}

	"The definition of a manifest."
	input CarrierManifestInput {
		warehouseId: ID!
		carrier: String!
		service: String
		manifestDate: DateTime
		windowFrom: DateTime
		windowTo: DateTime
		note: String
	}

	"""
	An update to a draft manifest.

	Every member is optional because the route's body is: \`PUT /carrier-manifests/:id\` is typed
	\`UpdateCarrierManifestDTO & CarrierManifestDTO\`, so the patch a REST caller may state is the
	manifest's own columns. Membership is not among them at any status — a draft resolves it from the
	shipments and a close freezes it — which is why the correction the route exists for is the day,
	the window and the note, and why the counters here are the columns the body names rather than a
	way to state membership.
	"""
	input UpdateCarrierManifestInput {
		warehouseId: ID
		carrier: String
		service: String
		number: String
		status: CarrierManifestStatus
		manifestDate: DateTime
		windowFrom: DateTime
		windowTo: DateTime
		shipmentCount: Int
		packageCount: Int
		totalWeight: Decimal
		closedAt: DateTime
		handedOverAt: DateTime
		canceledAt: DateTime
		documentUrl: String
		documentData: JSON
		note: String
		version: Int
		metadata: JSON
	}

	"What the dock recorded at hand-over. \`idempotencyKey\` is the key a retry of the hand-over presents."
	input HandOverManifestInput {
		scanCount: Int
		"Tracking numbers the carrier scanned that the manifest does not carry."
		scannedTrackingNumbers: [String!]
		note: String
		idempotencyKey: String
	}

	"The outcome of a mutation on a zone."
	type WarehouseZonePayload {
		warehouseZone: WarehouseZone
		userErrors: [UserError!]!
	}

	"The outcome of a mutation on a bin."
	type WarehouseBinPayload {
		warehouseBin: WarehouseBin
		userErrors: [UserError!]!
	}

	"The outcome of creating a range of bins."
	type WarehouseBinRangePayload {
		warehouseBins: [WarehouseBin!]
		userErrors: [UserError!]!
	}

	"The outcome of a bin reconciliation."
	type BinReconciliationPayload {
		report: BinReconciliationReport
		userErrors: [UserError!]!
	}

	"""
	One home-bin declaration: the variant and the location it is kept at.

	\`version\` is the level counter the declaration is conditioned on — the address is part of the
	state a caller reads, so a declaration overwriting a concurrent one is the same lost update as a
	quantity — and \`idempotencyKey\` is the key a retry presents.
	"""
	input AssignWarehouseBinInput {
		variantId: ID!
		warehouseId: ID!
		"The level row, when the caller has it."
		levelId: ID
		reason: String
		version: Int
		idempotencyKey: String
	}

	"The outcome of declaring a home bin. Nothing moved, so there is no movement to report."
	type AssignWarehouseBinPayload {
		"Whether a level row was found and named."
		assigned: Boolean!
		userErrors: [UserError!]!
	}

	"""
	One put-away: the units being placed, and where they walk from.

	\`version\` is the level counter the walk is conditioned on, so units are never walked into an
	address whose state the caller has not seen, and \`idempotencyKey\` is the key a retry presents —
	a second walk of the same units is a second arrival.
	"""
	input PutAwayWarehouseBinInput {
		variantId: ID!
		warehouseId: ID!
		"The positive quantity being placed, as an exact decimal string."
		quantity: String!
		"The bin the units walk from, when they were recorded in one."
		fromBinId: ID
		"The movement the units were received by."
		stockMovementId: ID
		"The row that asked for the walk."
		referenceId: ID
		reason: String
		version: Int
		idempotencyKey: String
	}

	"What a put-away wrote."
	type PutAwayResult {
		"The leg out of the receiving area, when the units were recorded in a bin."
		transferOutMovementId: ID
		"The leg into the target bin."
		transferInMovementId: ID!
		"The bin the level row now names as the variant's home."
		binId: ID!
		"The level after the walk."
		quantityAfter: Decimal!
	}

	"The outcome of a put-away."
	type PutAwayWarehouseBinPayload {
		putAway: PutAwayResult
		userErrors: [UserError!]!
	}

	"The outcome of a mutation on a wave."
	type PickWavePayload {
		pickWave: PickWave
		userErrors: [UserError!]!
	}

	"The outcome of a mutation on a pick list."
	type PickListPayload {
		pickList: PickList
		userErrors: [UserError!]!
	}

	"The outcome of recording an outcome against a line."
	type PickListLinePayload {
		pickListLine: PickListLine
		userErrors: [UserError!]!
	}

	"The outcome of a mutation on a pack slip."
	type PackSlipPayload {
		packSlip: PackSlip
		userErrors: [UserError!]!
	}

	"The outcome of a mutation on a carrier manifest."
	type CarrierManifestPayload {
		carrierManifest: CarrierManifest
		userErrors: [UserError!]!
	}

	extend type Query {
		"Zones of the caller's organization."
		warehouseZones(filter: WarehouseZoneFilter, page: PageInput, withDeleted: Boolean): WarehouseZoneConnection!
		"One zone, with the positions inside it."
		warehouseZone(id: ID!): WarehouseZone
		"Bins of the caller's organization."
		warehouseBins(filter: WarehouseBinFilter, page: PageInput, withDeleted: Boolean): WarehouseBinConnection!
		"One bin, with its place in the hierarchy."
		warehouseBin(id: ID!): WarehouseBin
		"Everything under a bin, itself included, read through the closure table."
		warehouseBinSubtree(id: ID!, page: PageInput, withDeleted: Boolean): WarehouseBinSubtreeConnection!
		"The derived contents of a bin."
		warehouseBinContents(id: ID!, page: PageInput): WarehouseBinContentsConnection!
		"Measures a requested quantity against a bin's declared capacity, in the capacity's own unit."
		warehouseBinCapacity(input: WarehouseBinCapacityInput!): WarehouseBinCapacityCheck!
		"Bins whose capacity is declared without the unit it is counted in; pallet positions first."
		warehouseBinCapacityWarnings(warehouseId: ID): [WarehouseBinCapacityWarning!]!
		"Pick waves of the caller's organization."
		pickWaves(filter: PickWaveFilter, page: PageInput, withDeleted: Boolean): PickWaveConnection!
		"One wave, with its pick lists."
		pickWave(id: ID!): PickWave
		"Pick lists of the caller's organization."
		pickLists(filter: PickListFilter, page: PageInput, withDeleted: Boolean): PickListConnection!
		"One pick list, with its lines and their bins."
		pickList(id: ID!): PickList
		"The lines of a pick list, in the order the pick path visits them."
		pickListLines(pickListId: ID!, page: PageInput, withDeleted: Boolean): PickListLinesConnection!
		"One pick line."
		pickListLine(id: ID!): PickListLine
		"Pack slips of the caller's organization."
		packSlips(filter: PackSlipFilter, page: PageInput, withDeleted: Boolean): PackSlipConnection!
		"One pack slip, with the lines it covers."
		packSlip(id: ID!): PackSlip
		"Carrier manifests of the caller's organization."
		carrierManifests(filter: CarrierManifestFilter, page: PageInput, withDeleted: Boolean): CarrierManifestConnection!
		"One manifest, with the shipments it covers."
		carrierManifest(id: ID!): CarrierManifest
	}

	extend type Mutation {
		"Creates a zone inside a location."
		createWarehouseZone(input: WarehouseZoneInput!): WarehouseZonePayload!
		"Updates a zone."
		updateWarehouseZone(id: ID!, input: WarehouseZoneInput!): WarehouseZonePayload!
		"Rewrites the visiting order of a location's zones."
		reorderWarehouseZones(warehouseId: ID!, zones: [WarehouseZonePriorityInput!]!): [WarehouseZone!]!
		"Blocks a zone, or puts it back into service."
		setWarehouseZoneBlocked(id: ID!, isBlocked: Boolean!): WarehouseZonePayload!
		"Deletes a zone that holds no bin."
		deleteWarehouseZone(id: ID!): WarehouseZonePayload!
		"Retires a zone recoverably, so the bins inside it keep the area they were addressed in."
		softDeleteWarehouseZone(id: ID!): WarehouseZonePayload!
		"Restores a soft-deleted zone."
		recoverWarehouseZone(id: ID!): WarehouseZonePayload!
		"Creates a bin."
		createWarehouseBin(input: WarehouseBinInput!): WarehouseBinPayload!
		"Creates a consecutive range of bins."
		createWarehouseBinRange(input: WarehouseBinRangeInput!): WarehouseBinRangePayload!
		"Updates a bin."
		updateWarehouseBin(id: ID!, input: WarehouseBinInput!): WarehouseBinPayload!
		"Moves a bin and its subtree inside its zone."
		reparentWarehouseBin(id: ID!, parentId: ID, idempotencyKey: String): WarehouseBinPayload!
		"Blocks a bin, or puts it back into service."
		setWarehouseBinBlocked(id: ID!, isBlocked: Boolean!): WarehouseBinPayload!
		"Deletes a bin that is empty and holds no position under it."
		deleteWarehouseBin(id: ID!): WarehouseBinPayload!
		"Retires a bin recoverably, so the rows that name it as their address stay readable."
		softDeleteWarehouseBin(id: ID!): WarehouseBinPayload!
		"Restores a soft-deleted bin."
		recoverWarehouseBin(id: ID!): WarehouseBinPayload!
		"Reconciles the bins of a location against the movement ledger."
		reconcileWarehouseBins(input: ReconcileBinsInput!): BinReconciliationPayload!
		"Declares a bin as the home bin of a variant at a location. No movement is written."
		assignWarehouseBinHome(id: ID!, input: AssignWarehouseBinInput!): AssignWarehouseBinPayload!
		"Walks received units from the receiving area into a bin."
		putAwayWarehouseBin(id: ID!, input: PutAwayWarehouseBinInput!): PutAwayWarehouseBinPayload!
		"Creates a wave and the picking work it covers."
		createPickWave(input: PickWaveInput!): PickWavePayload!
		"Updates a wave that has not been released, while its contents may still be amended."
		updatePickWave(id: ID!, input: UpdatePickWaveInput!): PickWavePayload!
		"Releases a wave to the floor."
		releasePickWave(id: ID!, pickerUserId: ID, idempotencyKey: String): PickWavePayload!
		"Marks a released wave as being walked."
		startPickWave(id: ID!): PickWavePayload!
		"Completes a wave whose lists are all done."
		completePickWave(id: ID!): PickWavePayload!
		"Closes a wave whose output was packed and manifested."
		closePickWave(id: ID!, idempotencyKey: String): PickWavePayload!
		"Closes a wave short, releasing the work that will not be done."
		closePickWaveShort(id: ID!, reason: String): PickWavePayload!
		"Cancels a wave nothing has been picked from."
		cancelPickWave(id: ID!, reason: String): PickWavePayload!
		"Deletes a wave outright, destroying the work it records. \`softDeletePickWave\` retires it recoverably instead."
		deletePickWave(id: ID!): PickWavePayload!
		"Retires a wave recoverably, so its lists and the work they record stay explainable."
		softDeletePickWave(id: ID!): PickWavePayload!
		"Restores a soft-deleted wave."
		recoverPickWave(id: ID!): PickWavePayload!
		"Creates a pick list from shipments."
		createPickList(input: PickListInput!): PickListPayload!
		"Updates a pick list: the assignee, the priority and the picker-facing note a dispatcher still owns."
		updatePickList(id: ID!, input: UpdatePickListInput!): PickListPayload!
		"Assigns a pick list to a picker."
		assignPickList(id: ID!, assignedToUserId: ID!): PickListPayload!
		"Marks a pick list as being walked."
		startPickList(id: ID!): PickListPayload!
		"Completes a pick list whose lines all reached an outcome."
		completePickList(id: ID!): PickListPayload!
		"Cancels a pick list nothing has been picked from."
		cancelPickList(id: ID!, reason: String): PickListPayload!
		"Deletes a pick list outright, destroying the lines and outcomes it holds. \`softDeletePickList\` retires it recoverably instead."
		deletePickList(id: ID!): PickListPayload!
		"Retires a pick list recoverably, so the lines it was walked with keep their list."
		softDeletePickList(id: ID!): PickListPayload!
		"Restores a soft-deleted pick list."
		recoverPickList(id: ID!): PickListPayload!
		"Records what was taken from the bin."
		pickPickListLine(
			pickListId: ID!
			lineId: ID!
			pickedQuantity: Decimal!
			binId: ID
			lotNumber: String
			serialNumbers: [String!]
			note: String
			"The level counter the outcome is conditioned on, stated as the input member \`version\`."
			version: Int
			idempotencyKey: String
		): PickListLinePayload!
		"Records a substitute: a different unit was taken."
		substitutePickListLine(
			pickListId: ID!
			lineId: ID!
			substituteVariantId: ID!
			substituteQuantity: Decimal!
			substitutionReason: String
			binId: ID
			note: String
			version: Int
			idempotencyKey: String
		): PickListLinePayload!
		"Records a line the picker deliberately did not collect."
		skipPickListLine(pickListId: ID!, lineId: ID!, note: String): PickListLinePayload!
		"Retires a line recoverably, so a packing record that names it stays complete."
		softDeletePickListLine(id: ID!): PickListLinePayload!
		"Restores a soft-deleted pick line."
		recoverPickListLine(id: ID!): PickListLinePayload!
		"Creates a pack slip from a picked list."
		createPackSlip(warehouseId: ID!, pickListId: ID, fulfillmentId: ID, packageCount: Int): PackSlipPayload!
		"Updates an open pack slip: its parcel count, its weight and volume of record, its carrier and its label."
		updatePackSlip(id: ID!, input: UpdatePackSlipInput!): PackSlipPayload!
		"Records the packing and seals the slip."
		packPackSlip(id: ID!, input: PackSlipContentInput!): PackSlipPayload!
		"Voids a slip that was never packed."
		voidPackSlip(id: ID!, reason: String): PackSlipPayload!
		"Deletes a pack slip outright, destroying the packing record a carrier claim reads. \`softDeletePackSlip\` retires it recoverably instead."
		deletePackSlip(id: ID!): PackSlipPayload!
		"Retires a slip recoverably, so the lines it covers keep the parcel they went into."
		softDeletePackSlip(id: ID!): PackSlipPayload!
		"Restores a soft-deleted pack slip."
		recoverPackSlip(id: ID!): PackSlipPayload!
		"Builds a draft manifest for a carrier."
		createCarrierManifest(input: CarrierManifestInput!): CarrierManifestPayload!
		"Updates a draft manifest: the dispatch day, the collection window and the note. Membership is never stated."
		updateCarrierManifest(id: ID!, input: UpdateCarrierManifestInput!): CarrierManifestPayload!
		"Submits a draft manifest, freezing its membership."
		submitCarrierManifest(id: ID!): CarrierManifestPayload!
		"Hands the parcels over to the carrier."
		handOverCarrierManifest(id: ID!, input: HandOverManifestInput): CarrierManifestPayload!
		"Cancels a manifest before hand-over."
		cancelCarrierManifest(id: ID!, reason: String): CarrierManifestPayload!
		"Deletes a manifest outright, destroying the hand-over record the carrier accepted. \`softDeleteCarrierManifest\` retires it recoverably instead."
		deleteCarrierManifest(id: ID!): CarrierManifestPayload!
		"Retires a manifest recoverably, so the shipments it covered keep their hand-over record."
		softDeleteCarrierManifest(id: ID!): CarrierManifestPayload!
		"Restores a soft-deleted manifest."
		recoverCarrierManifest(id: ID!): CarrierManifestPayload!
	}
`;
