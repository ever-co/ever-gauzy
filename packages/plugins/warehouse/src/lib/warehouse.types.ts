import { DecimalString, ID, IBasePerTenantAndOrganizationEntityModel } from '@gauzy/contracts';

/**
 * Warehouse management.
 *
 * A stock location says *how much* of a variant is on hand. This domain says *where inside the
 * building* it sits, *who* walks to fetch it, what went into the parcel and what was handed to the
 * carrier. It therefore owns the inside of the building — zones, bins, the work of picking and
 * packing, and the manifest that ends the platform's custody — and it owns no quantity of its own:
 * the ledger stays the single authority for stock, and every physical move this domain causes is a
 * movement written through the inventory capability.
 *
 * The flow, end to end:
 *
 * ```
 * shipment due        --(PICK_GENERATE)-->  pick_wave / pick_list / pick_list_line (bin, position)
 * pick_list_line      --(PICK_CONFIRM)--->  PICKED | SHORT | SKIPPED   (+ ADJUSTMENT on a short)
 * pick_list_line      --(PACK_SEAL)----->  pack_slip                    (weight, tracking, label)
 * fulfillment         --(MANIFEST_SUBMIT)-> carrier_manifest            (members frozen at close)
 * ```
 */

/*
|--------------------------------------------------------------------------
| Enums
|--------------------------------------------------------------------------
*/

/**
 * What a zone is for.
 *
 * The type is not a label: put-away, pick-path generation, allocation and the returns triage each
 * select zones by type, so a new type means a new behaviour rather than a new row.
 */
export enum WarehouseZoneType {
	/** Where inbound goods are unloaded and booked in. */
	RECEIVING = 'RECEIVING',
	/** Bulk or shelved reserve stock that picking does not normally visit. */
	STORAGE = 'STORAGE',
	/** Forward-pick area that pick lists are routed through. */
	PICKING = 'PICKING',
	/** Where a picked order is packed into a pack slip. */
	PACKING = 'PACKING',
	/** Where packed parcels wait for their carrier manifest. */
	STAGING = 'STAGING',
	/** The dock area a manifest is handed over at. */
	SHIPPING = 'SHIPPING',
	/** Where returned goods are received and triaged. */
	RETURNS = 'RETURNS',
	/** Stock held out of availability pending a quality or compliance decision. */
	QUARANTINE = 'QUARANTINE',
	/** Stock recorded as unsellable and awaiting disposal. */
	DAMAGE = 'DAMAGE'
}

/**
 * The kind of addressable position a bin is.
 *
 * The type constrains the handling unit and therefore which capacity and put-away checks apply, and
 * `DOCK` / `STAGING` are excluded from pick-path generation.
 */
export enum WarehouseBinType {
	/** A shelf position picked or put away by hand. */
	SHELF = 'SHELF',
	/** A racked position, usually pallet-fed and reachable only from a level. */
	RACK = 'RACK',
	/** A whole-pallet position: the unit of handling is the pallet, not the item. */
	PALLET = 'PALLET',
	/** A small-batch container position, typically one product each. */
	BIN = 'BIN',
	/** Bulk floor stack; addressable but not a pick face. */
	FLOOR = 'FLOOR',
	/** A dock or staging position at the building edge; never a long-term holder. */
	DOCK = 'DOCK',
	/** A transient position used by a wave or a manifest and expected to empty. */
	STAGING = 'STAGING'
}

/**
 * How a wave grouped the work it was generated from.
 *
 * The strategy is recorded rather than recomputed, because it explains why the wave holds the lists
 * it holds: a batch wave covers several orders in one pass, a zone wave splits one order across the
 * areas of the building it touches.
 */
export enum PickWaveStrategy {
	/** One wave and one list per shipment. */
	SINGLE_ORDER = 'SINGLE_ORDER',
	/** One wave per pickup window; its lists take lines from every shipment in the window. */
	BATCH = 'BATCH',
	/** One list per cluster of bins in the same walking sequence. */
	CLUSTER = 'CLUSTER',
	/** One list per zone the wave's lines touch. */
	ZONE = 'ZONE',
	/** Work released in a timed cycle rather than per order or per batch. */
	WAVE = 'WAVE'
}

/** Where a wave is in its lifecycle. */
export enum PickWaveStatus {
	/** Being assembled. Shipments may be added or removed and no bin is pinned. */
	DRAFT = 'DRAFT',
	/** Frozen and handed to the floor: its pick lists exist and the bins they name are pinned. */
	RELEASED = 'RELEASED',
	/** At least one of its pick lists has been started. */
	IN_PROGRESS = 'IN_PROGRESS',
	/** Every pick list in the wave reached a terminal picked state. */
	PICKED = 'PICKED',
	/** Closed by an operator with at least one line short. Terminal. */
	PARTIALLY_PICKED = 'PARTIALLY_PICKED',
	/** The wave's output was packed and manifested or otherwise handed off. Terminal. */
	CLOSED = 'CLOSED',
	/** Withdrawn before any pick was recorded; its pins are released. Terminal. */
	CANCELED = 'CANCELED'
}

/** Where a pick list is in its lifecycle. */
export enum PickListStatus {
	/** Generated and unassigned. */
	PENDING = 'PENDING',
	/** A picker owns it; the route and the bin order are frozen. */
	ASSIGNED = 'ASSIGNED',
	/** At least one line has a recorded outcome. */
	IN_PROGRESS = 'IN_PROGRESS',
	/** Every line reached an outcome, so the list is complete. Terminal. */
	PICKED = 'PICKED',
	/** Withdrawn before it was picked. Terminal. */
	CANCELED = 'CANCELED'
}

/**
 * What happened to one line on the floor.
 *
 * A substituted pick is a `PICKED` line that names a different variant — the pick succeeded, and the
 * substitution is recorded on the line rather than in the state machine, because the state machine
 * answers "is this list finished?" and a substitution does not make that answer ambiguous.
 */
export enum PickListLineStatus {
	/** Not yet visited by the picker. */
	PENDING = 'PENDING',
	/** The requested quantity was taken from the named bin. */
	PICKED = 'PICKED',
	/** The bin held less than requested; the shortfall drives a decision downstream. */
	SHORT = 'SHORT',
	/** Deliberately not picked — the stock is damaged, blocked or inaccessible. */
	SKIPPED = 'SKIPPED',
	/** Withdrawn with its list before being picked. */
	CANCELED = 'CANCELED'
}

/** Where a pack slip is in its lifecycle. Two transitions and nothing between. */
export enum PackSlipStatus {
	/** Created from a picked list; contents may still change. */
	OPEN = 'OPEN',
	/** The packages and the weights are recorded. Immutable from here. */
	PACKED = 'PACKED',
	/** Abandoned before packing. Terminal. */
	CANCELED = 'CANCELED'
}

/** Where a carrier manifest is in its lifecycle. */
export enum CarrierManifestStatus {
	/** Being assembled. Its members are derived rather than linked. */
	DRAFT = 'DRAFT',
	/** Membership is frozen: every member is claimed in one transaction. */
	CLOSED = 'CLOSED',
	/** The carrier took custody at the dock. Terminal. */
	HANDED_OVER = 'HANDED_OVER',
	/** Withdrawn from draft or closed, returning its members to the pool. Terminal. */
	CANCELED = 'CANCELED'
}

/**
 * The stock movement kinds this domain produces.
 *
 * Declared here so a pick or a reconciliation can name what it needs without owning the ledger: a
 * short pick corrects a level with an `ADJUSTMENT`, a bin-to-bin relocation is the `TRANSFER_OUT` /
 * `TRANSFER_IN` pair, and a count that disagrees with the ledger is closed with a `COUNT`.
 */
export enum WarehouseStockMovementKind {
	/** The level is corrected to what was physically found. */
	ADJUSTMENT = 'ADJUSTMENT',
	/** Units left one bin of the location. */
	TRANSFER_OUT = 'TRANSFER_OUT',
	/** Units arrived in another bin of the same location. */
	TRANSFER_IN = 'TRANSFER_IN',
	/** Units left the building against a shipment. */
	SALE = 'SALE',
	/** A counted number replaced the ledger's expectation. */
	COUNT = 'COUNT'
}

/*
|--------------------------------------------------------------------------
| Cross-domain ports
|--------------------------------------------------------------------------
*/

/** What the ledger knows about one variant in one bin, or at one location when no bin is named. */
export interface IWarehouseBinBalance {
	/** The variant the balance is for. */
	readonly variantId: ID;
	/** The bin the balance is held in; absent when the balance is the whole location's. */
	readonly binId?: ID;
	/** On-hand quantity, derived from the movement ledger. */
	readonly quantity: DecimalString;
	/** Quantity of it already promised to a shipment. */
	readonly reservedQuantity?: DecimalString;
}

/** A question about one variant at one location. */
export interface IWarehouseBalanceQuery {
	/** The location the question is about. */
	readonly warehouseId: ID;
	/** The variant the question is about. */
	readonly variantId: ID;
	/** The bin the question is about; absent means the whole location. */
	readonly binId?: ID;
}

/**
 * Where a variant is normally kept at a location, and how much of it is there.
 *
 * The home bin is `warehouse_product_variant.binId` — a column on a core level row this domain must
 * not write — so it is read through the capability that owns the row rather than mapped here.
 */
export interface IWarehouseHomeBin {
	/** The bin the level row names as home, when it names one. */
	readonly binId?: ID;
	/** What the ledger says is on hand at the location. */
	readonly quantity?: DecimalString;
}

/** One request to record a movement in the platform stock ledger. */
export interface IWarehouseStockMovementRequest {
	/** The location the movement happened at. */
	readonly warehouseId: ID;
	/** The variant that moved. */
	readonly variantId: ID;
	/** Signed quantity; positive adds to stock, negative removes from it. */
	readonly quantity: DecimalString;
	/** What kind of movement this is. */
	readonly kind: WarehouseStockMovementKind;
	/** The bin the movement physically happened in, when the location addresses stock by bin. */
	readonly binId?: ID;
	/** The concept that asked for the movement, e.g. `PICK_LIST_LINE`. */
	readonly referenceType: string;
	/** The row that asked for the movement. */
	readonly referenceId: ID;
	/** Free-text explanation kept beside the movement. */
	readonly reason?: string;
	/** Instant the movement happened; defaults to now. */
	readonly occurredAt?: Date;
}

/** What the ledger answers with once a movement is written. */
export interface IWarehouseStockMovementResult {
	/** The movement row that was written. */
	readonly movementId: ID;
	/** The level after the movement, as the ledger computed it. */
	readonly quantityAfter: DecimalString;
}

/**
 * The inventory capability as this domain sees it.
 *
 * Injected under `WAREHOUSE_STOCK_LEDGER`. The warehouse never writes a level itself: a short pick, a
 * relocation and a reconciliation all state the movement they want and the ledger decides the level,
 * because two writers of one level is how a level drifts. The port is optional, and an operation that
 * has quantities to move without a ledger registered fails loudly instead of adjusting a level here.
 */
export interface IWarehouseStockLedgerPort {
	/** Reads the derived balance of one variant at one location, or in one bin. */
	readBinBalance(query: IWarehouseBalanceQuery): Promise<IWarehouseBinBalance | undefined>;
	/** Reads every derived balance the ledger holds for a set of bins. */
	readBinBalances(binIds: ID[]): Promise<IWarehouseBinBalance[]>;
	/** Reads what the level rows of a location *claim* sits in a set of bins, which is what a count compares against. */
	readExpectedBinBalances(query: { warehouseId: ID; binIds: ID[] }): Promise<IWarehouseBinBalance[]>;
	/** Reads where a variant is normally kept at a location, and how much of it is there. */
	resolveHomeBin(query: { warehouseId: ID; variantId: ID }): Promise<IWarehouseHomeBin | undefined>;
	/** Writes a movement. */
	recordMovement(request: IWarehouseStockMovementRequest): Promise<IWarehouseStockMovementResult>;
	/** Relocates units between two bins of one location as a balanced pair. */
	relocate(request: {
		warehouseId: ID;
		variantId: ID;
		fromBinId: ID;
		toBinId: ID;
		quantity: DecimalString;
		referenceType: string;
		referenceId: ID;
		reason?: string;
	}): Promise<IWarehouseStockMovementResult[]>;
}

/** One line of a shipment that is due to leave, as the warehouse reads it. */
export interface IWarehouseShippableLine {
	/** The fulfilment line. */
	readonly fulfillmentLineId: ID;
	/** The shipment it belongs to. */
	readonly fulfillmentId: ID;
	/** The order line it satisfies, when the fulfilment domain reports it. */
	readonly orderLineId?: ID;
	/** The order it satisfies, when the fulfilment domain reports it. */
	readonly orderId?: ID;
	/** The variant expected in the bin. */
	readonly variantId: ID;
	/** What the shipment still asks for, which is the quantity a pick list may request. */
	readonly quantity: DecimalString;
	/** The location the shipment leaves from. */
	readonly warehouseId?: ID;
}

/** One shipment, as the manifest reads it. */
export interface IWarehouseShippedFulfillment {
	/** The shipment. */
	readonly fulfillmentId: ID;
	/** The location it left from. */
	readonly warehouseId?: ID;
	/** The order it satisfies. */
	readonly orderId?: ID;
	/** The carrier that took it. */
	readonly carrier?: string;
	/** The service level it was sent on. */
	readonly service?: string;
	/** When it left the building. */
	readonly shippedAt?: Date;
	/** The carrier's tracking number. */
	readonly trackingNumber?: string;
	/** How many parcels it is packed into, when the fulfilment domain reports it. */
	readonly packageCount?: number;
	/** What it weighs, when the fulfilment domain reports it. */
	readonly packedWeight?: DecimalString;
}

/**
 * The fulfilment capability as this domain sees it.
 *
 * Injected under `WAREHOUSE_FULFILLMENT`. Picking is generated from the shipment side, never from the
 * cart, and a manifest's members are the shipments the carrier took — so this domain reads shipments
 * and claims them by writing `fulfillment.metadata.manifestId`, which is the membership link and the
 * reason the manifest needs no column on the fulfilment table.
 *
 * The port is optional: a tenant that ships without picking can still maintain zones and bins, and a
 * request for work with no fulfilment capability registered is refused rather than invented.
 */
export interface IWarehouseFulfillmentPort {
	/** Reads the lines of the shipments that are due to leave a location. */
	listShippableLines(query: {
		warehouseId: ID;
		fulfillmentIds?: ID[];
		orderId?: ID;
	}): Promise<IWarehouseShippableLine[]>;
	/** Reads the shipments a manifest covers. */
	listShipped(query: {
		warehouseId: ID;
		carrier?: string;
		service?: string;
		windowFrom?: Date;
		windowTo?: Date;
		unclaimedOnly?: boolean;
	}): Promise<IWarehouseShippedFulfillment[]>;
	/** Writes `metadata.manifestId` on each named shipment, which is what freezes membership. */
	claimForManifest(request: { manifestId: ID; fulfillmentIds: ID[] }): Promise<number>;
	/** Clears `metadata.manifestId` on each named shipment, returning it to the pool. */
	releaseFromManifest(request: { manifestId: ID; fulfillmentIds: ID[] }): Promise<number>;
}

/*
|--------------------------------------------------------------------------
| Injection tokens
|--------------------------------------------------------------------------
*/

/**
 * Token the stock ledger is injected under.
 *
 * Optional on purpose: a tenant that has not adopted zones and bins can still plan waves and print
 * pick lists, while a tenant that has gets every physical move written by the ledger.
 */
export const WAREHOUSE_STOCK_LEDGER = Symbol('WAREHOUSE_STOCK_LEDGER');

/** Token the shipment capability is injected under. */
export const WAREHOUSE_FULFILLMENT = Symbol('WAREHOUSE_FULFILLMENT');

/** The sequence key pick numbers are allocated from. */
export const PICK_NUMBER_KEY = 'PICK';

/** The sequence key pack-slip numbers are allocated from. */
export const PACK_NUMBER_KEY = 'PACK';

/** The sequence key manifest numbers are allocated from. */
export const MANIFEST_NUMBER_KEY = 'MANIFEST';

/*
|--------------------------------------------------------------------------
| Contracts
|--------------------------------------------------------------------------
*/

/** A named area of one location. */
export interface IWarehouseZone extends IBasePerTenantAndOrganizationEntityModel {
	warehouseId?: ID;
	name: string;
	code: string;
	type: WarehouseZoneType;
	priority: number;
	isPickable: boolean;
	isReceivable: boolean;
	isShippable: boolean;
	isBlocked: boolean;
	minTemperature?: DecimalString;
	maxTemperature?: DecimalString;
	version: number;
	metadata?: Record<string, unknown>;
	bins?: IWarehouseBin[];
}

/** One addressable storage position inside a zone. */
export interface IWarehouseBin extends IBasePerTenantAndOrganizationEntityModel {
	warehouseId?: ID;
	zoneId?: ID;
	parentId?: ID;
	code: string;
	barcode?: string;
	type: WarehouseBinType;
	isPickable: boolean;
	isBlocked: boolean;
	capacityUnits?: DecimalString;
	capacityUnitId?: ID;
	maxWeight?: DecimalString;
	maxWeightUnitId?: ID;
	maxVolume?: DecimalString;
	maxVolumeUnitId?: ID;
	aisle?: string;
	rack?: string;
	level?: string;
	position?: string;
	sortOrder: number;
	version: number;
	metadata?: Record<string, unknown>;
	parent?: IWarehouseBin;
	children?: IWarehouseBin[];
}

/** A batch of picking work released to the floor together. */
export interface IPickWave extends IBasePerTenantAndOrganizationEntityModel {
	warehouseId?: ID;
	channelId?: ID;
	number: string;
	strategy: PickWaveStrategy;
	status: PickWaveStatus;
	priority: number;
	pickerUserId?: ID;
	plannedAt?: Date;
	releasedAt?: Date;
	startedAt?: Date;
	completedAt?: Date;
	orderCount: number;
	lineCount: number;
	version: number;
	metadata?: Record<string, unknown>;
	pickLists?: IPickList[];
}

/** One list of work for one picker. */
export interface IPickList extends IBasePerTenantAndOrganizationEntityModel {
	waveId?: ID;
	warehouseId?: ID;
	zoneId?: ID;
	fulfillmentId?: ID;
	orderId?: ID;
	number: string;
	status: PickListStatus;
	assignedToUserId?: ID;
	priority: number;
	lineCount: number;
	pickedCount: number;
	shortCount: number;
	startedAt?: Date;
	completedAt?: Date;
	note?: string;
	version: number;
	metadata?: Record<string, unknown>;
	lines?: IPickListLine[];
}

/** One line to pick: what, how much, from which bin, and what actually happened. */
export interface IPickListLine extends IBasePerTenantAndOrganizationEntityModel {
	pickListId?: ID;
	orderLineId?: ID;
	fulfillmentLineId?: ID;
	variantId?: ID;
	binId?: ID;
	zoneId?: ID;
	quantityRequested: DecimalString;
	quantityPicked: DecimalString;
	quantityShort: DecimalString;
	status: PickListLineStatus;
	substituteVariantId?: ID;
	substituteQuantity?: DecimalString;
	substitutionReason?: string;
	packSlipId?: ID;
	position: number;
	pickedAt?: Date;
	pickedByUserId?: ID;
	lotNumber?: string;
	expiryDate?: Date;
	serialNumbers?: string[];
	note?: string;
	metadata?: Record<string, unknown>;
}

/** The packing record: which picked lines went into which package. */
export interface IPackSlip extends IBasePerTenantAndOrganizationEntityModel {
	warehouseId?: ID;
	pickListId?: ID;
	orderId?: ID;
	fulfillmentId?: ID;
	number: string;
	status: PackSlipStatus;
	carrierKey?: string;
	packageCount: number;
	totalWeight?: DecimalString;
	totalVolume?: DecimalString;
	trackingNumber?: string;
	labelUrl?: string;
	packedAt?: Date;
	packedByUserId?: ID;
	note?: string;
	version: number;
	metadata?: Record<string, unknown>;
}

/** The document a carrier accepts: the parcels handed over at one dock, at one time. */
export interface ICarrierManifest extends IBasePerTenantAndOrganizationEntityModel {
	warehouseId?: ID;
	carrier: string;
	service?: string;
	number: string;
	status: CarrierManifestStatus;
	manifestDate: Date;
	windowFrom?: Date;
	windowTo?: Date;
	shipmentCount: number;
	packageCount: number;
	totalWeight: DecimalString;
	closedAt?: Date;
	handedOverAt?: Date;
	canceledAt?: Date;
	documentUrl?: string;
	documentData?: Record<string, unknown>;
	note?: string;
	version: number;
	metadata?: Record<string, unknown>;
}

/*
|--------------------------------------------------------------------------
| Service inputs
|--------------------------------------------------------------------------
*/

/** One line as a caller supplies it when a bin range is created. */
export interface IWarehouseBinRangeInput {
	warehouseId: ID;
	zoneId?: ID;
	parentId?: ID;
	/** The code the range starts at, e.g. `A-01-01`. */
	from: string;
	/** How many consecutive codes to create. */
	count: number;
	type?: WarehouseBinType;
	isPickable?: boolean;
	sortOrder?: number;
}

/** One recorded outcome of a pick. */
export interface IPickOutcomeInput {
	/** What was actually taken. */
	pickedQuantity: DecimalString | number;
	/** The bin it was taken from, when the picker corrected the allocation. */
	binId?: ID;
	/** The lot scanned at picking, when the variant is lot-tracked. */
	lotNumber?: string;
	/** The serials scanned at picking, when the variant is serial-tracked. */
	serialNumbers?: string[];
	/** An operator note. */
	note?: string;
}

/** What a substitution replaced, as the picker recorded it. */
export interface ISubstitutionInput {
	substituteVariantId: ID;
	substituteQuantity: DecimalString | number;
	substitutionReason?: string;
	binId?: ID;
	note?: string;
}

/** One counted balance of one bin, as a reconciliation reports it. */
export interface IBinReconciliationLine {
	binId: ID;
	variantId: ID;
	binCode?: string;
	expectedQuantity: DecimalString;
	countedQuantity: DecimalString;
	difference: DecimalString;
	repaired: boolean;
}

/** What one reconciliation run found. */
export interface IBinReconciliationReport {
	warehouseId: ID;
	binIds: ID[];
	lines: IBinReconciliationLine[];
	driftCount: number;
	movementIds: ID[];
}

/**
 * One bin's capacity measured against a request.
 *
 * A capacity is a quantity in a stated unit, and this is the shape that says so: the request arrives
 * in whatever unit the caller entered it in, is converted through the factor it supplies into the unit
 * the capacity is declared in, and is then compared with the capacity itself. Every number below is an
 * exact decimal, and `exceeded` is a **warning** rather than a refusal — a real warehouse overfills a
 * bin and the record has to be able to say so.
 */
export interface IWarehouseBinCapacityCheck {
	binId: ID;
	/** The unit the capacity is declared in; null when the bin declares none. */
	capacityUnitId?: ID;
	/** The declared capacity, in `capacityUnitId`; null when the bin declares none. */
	capacityUnits?: DecimalString;
	/** The quantity asked for, as it was supplied. */
	requestedQuantity: DecimalString;
	/** The unit the request was supplied in, when the caller named one. */
	requestedUnitId?: ID;
	/**
	 * The request converted into `capacityUnitId` through the supplied factor. Null when the bin
	 * declares no capacity or no capacity unit, because a conversion into an undeclared unit would be a
	 * guess rather than a measurement.
	 */
	requestedInCapacityUnit?: DecimalString;
	/** The exact difference `capacityUnits − requestedInCapacityUnit`; null when either is null. */
	remainingQuantity?: DecimalString;
	/** Whether the request is larger than the declared capacity. */
	exceeded: boolean;
	/** The codes a caller acts on: the invariant breach, and the capacity being passed. */
	notices: string[];
}

/**
 * The warning a bin whose capacity is declared without a unit raises.
 *
 * A pallet position is the case the measurement model exists for: the unit of handling is the pallet,
 * and a capacity of `1` compared against a request of 480 pieces is either a wrong refusal or a wrong
 * acceptance. The unit cannot be guessed for a bin that predates the column, so the operator is asked
 * — which makes this a warning the capacity job surfaces rather than a migration-time default.
 */
export const WAREHOUSE_BIN_CAPACITY_UNIT_UNDECLARED = 'WAREHOUSE_BIN_CAPACITY_UNIT_UNDECLARED';

/** The refusal a caller receives when it declares a capacity without the unit it is counted in. */
export const WAREHOUSE_BIN_CAPACITY_UNIT_REQUIRED = 'WAREHOUSE_BIN_CAPACITY_UNIT_REQUIRED';
