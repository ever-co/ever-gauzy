import { gql } from 'graphql-tag';

/**
 * The GraphQL surface of the purchasing domain.
 *
 * Types, inputs, enums and the domain's root fields, declared as one document that is composed into
 * the platform schema at boot. The root operation types belong to the kernel, so this file only
 * extends them — a second declaration of `type Query` would be a duplicate definition and would fail
 * the schema build — and the kernel's scalars (`Decimal`, `DateTime`, `JSON`) and its pagination
 * types are referenced rather than restated.
 *
 * Money and quantities are `Decimal`, never `Float`: an amount read here and the same amount read over
 * REST are the same string, and a binary fraction cannot hold a cent exactly.
 *
 * **Every resource of this domain carries the `DELETE /:id/soft` and `PUT /:id/recover` pair its
 * controller inherits, under the names the composed schema uses for that act: `softDelete<Resource>` and
 * `recover<Resource>`.** Each controller here serves those two routes over REST and overrides them only
 * to state a permission the inherited declaration leaves unstated, so without these fields a caller could
 * withdraw a purchase order, one of its lines, a goods receipt, one of its lines or a negotiated term on
 * one protocol and not on the other. Every one of them takes the identifier its route takes and answers
 * what the resource's own mutations answer: the resource's write payload where it has one, and the row
 * for the two line resources, which no payload of this document carries.
 *
 * References into other domains — the supplier, the receiving location, the sellable unit, the storage
 * bin, the stock movement — travel as ids. Each of those concepts is owned by the capability that
 * models it, and this domain states which row it points at rather than restating another domain's
 * type.
 */
export const schemaExtensions = gql`
	"Where a purchase order is in its lifecycle."
	enum PurchaseOrderStatus {
		DRAFT
		SENT
		ACKNOWLEDGED
		PARTIALLY_RECEIVED
		RECEIVED
		CANCELED
		CLOSED
	}

	"Where a goods receipt is in its lifecycle."
	enum GoodsReceiptStatus {
		POSTED
		CANCELED
	}

	"Where a negotiated vendor term is in its life."
	enum VendorTermStatus {
		DRAFT
		ACTIVE
		INACTIVE
	}

	"What a supplier's bill is matched against."
	enum PurchaseBillingPolicy {
		ON_ORDERED
		ON_RECEIVED
	}

	"A document ordering goods from a supplier."
	type PurchaseOrder {
		id: ID!
		"The allocated order number, unique inside the organization."
		number: String!
		"The supplier the goods are ordered from."
		vendorId: ID!
		"The location the goods are expected at."
		warehouseId: ID!
		"The supplier's own order number, which their acknowledgement and their bill quote."
		vendorReference: String
		"Who owns this order - the routing key for every approval and follow-up."
		buyerUserId: ID
		status: PurchaseOrderStatus!
		"Currency every amount on this order is expressed in."
		currency: String!
		"Sum of the line amounts before the header-level adjustments."
		subtotal: Decimal!
		"Sum of the line discounts."
		discountTotal: Decimal!
		"Sum of the line taxes."
		taxTotal: Decimal!
		"Freight and handling charged for the order as a whole."
		shippingTotal: Decimal!
		"subtotal - discountTotal + taxTotal + shippingTotal, derived on every write."
		grandTotal: Decimal!
		"The settlement schedule the order runs on."
		paymentTermId: ID
		"The simple settlement form as it stood at order time, snapshotted."
		paymentTermsDaysSnapshot: Int
		"Computed once, at order time, from the resolved term. A dunning report reads this."
		dueDate: DateTime
		expectedAt: DateTime
		"When the order was sent, which is when its quantities start counting as incoming."
		orderedAt: DateTime
		sentAt: DateTime
		acknowledgedAt: DateTime
		"When the order was approved internally."
		approvedAt: DateTime
		approvedByUserId: ID
		"The platform approval request the order is waiting on, when the tenant requires one."
		approvalId: ID
		"Non-null exactly when the status is RECEIVED or CLOSED."
		receivedAt: DateTime
		canceledAt: DateTime
		closedAt: DateTime
		"The optimistic-lock counter, which every transition bumps."
		version: Int!
		note: String
		metadata: JSON
		"The ordered lines. A draft's set may be rewritten; once goods arrived it is frozen."
		lines: [PurchaseOrderLine!]!
		"What actually arrived against this order, once per delivery."
		receipts: [GoodsReceipt!]!
		"The quantity still expected: the ordered quantity minus everything received and damaged."
		outstandingQuantity: Decimal!
		"Whether the order carries an internal approval."
		isApproved: Boolean!
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One ordered line: a sellable unit, how many are expected, and what it costs."
	type PurchaseOrderLine {
		id: ID!
		"The order this line belongs to."
		purchaseOrderId: ID!
		"The order this line belongs to, as an object."
		purchaseOrder: PurchaseOrder
		"The variant being bought."
		variantId: ID!
		"How many units were ordered."
		quantity: Decimal!
		"The unit the buyer ordered in, when the line states one."
		unitId: ID
		"Snapshot of the unit factor at entry, never re-read."
		conversionFactor: Decimal!
		"How many good units have arrived."
		receivedQuantity: Decimal!
		"How many units arrived unsellable."
		damagedQuantity: Decimal!
		"Cache re-derived from the bill lines, never incremented."
		billedQuantity: Decimal!
		"Purchase cost of one unit, in the order's currency."
		unitCost: Decimal!
		"The supplier container the term priced, snapshotted at order time."
		orderedPackSize: Decimal
		"Which term row priced this line. Provenance only: the line never re-reads it."
		vendorTermId: ID
		"Tax rate applied to the line total, as a fraction."
		taxRate: Decimal
		"Discount negotiated for this line."
		discountTotal: Decimal!
		"quantity x unitCost - discountTotal + tax, derived on every write."
		total: Decimal!
		expectedAt: DateTime
		note: String
		metadata: JSON
		"The quantity still expected on this line."
		outstandingQuantity: Decimal!
		"What is still unbilled, derived at read and never stored."
		toBillQuantity(policy: PurchaseBillingPolicy!): Decimal!
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One physical delivery. Its order is optional: a consolidated delivery covers several, and goods may arrive with no order at all."
	type GoodsReceipt {
		id: ID!
		"The order this delivery is anchored to, when it is anchored to one."
		purchaseOrderId: ID
		"The location the goods arrived at."
		warehouseId: ID!
		"The allocated receipt number, unique inside the organization."
		number: String!
		status: GoodsReceiptStatus!
		"When the goods physically arrived."
		receivedAt: DateTime!
		receivedByUserId: ID
		"When the receipt was reversed."
		canceledAt: DateTime
		"The optimistic-lock counter, which a reversal bumps."
		version: Int!
		note: String
		metadata: JSON
		"What arrived, line by line."
		lines: [GoodsReceiptLine!]!
		"The stock movements this receipt wrote, one per line and disposition."
		stockMovementIds: [ID!]!
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One line of a goods receipt: what arrived and how much of it is sellable."
	type GoodsReceiptLine {
		id: ID!
		"The receipt this line belongs to."
		receiptId: ID!
		"The receipt this line belongs to, as an object."
		receipt: GoodsReceipt
		"The order line this delivery is against."
		purchaseOrderLineId: ID!
		"The variant that arrived."
		variantId: ID!
		"Good units that go into sellable stock."
		quantity: Decimal!
		"Units that arrived unsellable and are recorded but never sellable."
		damagedQuantity: Decimal!
		"Actual landed cost per unit, which may differ from the ordered cost."
		unitCost: Decimal!
		"Lot or batch the units belong to."
		batchNumber: String
		expiresAt: DateTime
		"The bin the units are to be placed into, when the line asked for put-away."
		warehouseBinId: ID
		"The RECEIPT movement this line produced, written once and never rewritten."
		stockMovementId: ID
		note: String
		metadata: JSON
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One page of purchase orders."
	type PurchaseOrderConnection {
		edges: [PurchaseOrderEdge!]!
		nodes: [PurchaseOrder!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One purchase order inside a page."
	type PurchaseOrderEdge {
		cursor: String!
		node: PurchaseOrder!
	}

	"One page of goods receipts."
	type GoodsReceiptConnection {
		edges: [GoodsReceiptEdge!]!
		nodes: [GoodsReceipt!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One goods receipt inside a page."
	type GoodsReceiptEdge {
		cursor: String!
		node: GoodsReceipt!
	}

	"The commercial agreement with one supplier, for one sellable unit."
	type VendorProductTerm {
		id: ID!
		"The supplier the agreement is with."
		vendorId: ID!
		"The sellable unit the agreement is about."
		variantId: ID!
		"ISO 4217 code the price is stated in."
		currency: String!
		"Price for one base unit excluding tax, at or above minQuantity."
		unitCost: Decimal!
		"Negotiated fraction off the price; null means none."
		discountPercent: Decimal
		"The quantity from which this price applies."
		minQuantity: Decimal!
		"The supplier's selling container, e.g. a case of twelve."
		packSize: Decimal
		"What the supplier calls that container."
		packLabel: String
		"Days from order confirmation to receipt for this product; null inherits the supplier's."
		leadTimeDays: Int
		"The supplier's own code for our variant."
		vendorProductCode: String
		"The supplier's own name for it."
		vendorProductName: String
		"Negotiated over-shipment allowance; null falls through to the organization's setting."
		overReceiptTolerancePercent: Decimal
		"Lower wins between two rows that both match."
		priority: Int!
		"Validity window; null is open-ended on that side."
		startsAt: DateTime
		endsAt: DateTime
		status: VendorTermStatus!
		metadata: JSON
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One page of vendor terms."
	type VendorProductTermConnection {
		edges: [VendorProductTermEdge!]!
		nodes: [VendorProductTerm!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One vendor term inside a page."
	type VendorProductTermEdge {
		cursor: String!
		node: VendorProductTerm!
	}

	"What a caller asks a vendor term to price."
	input ResolveVendorProductTermInput {
		vendorId: ID!
		variantId: ID!
		"The quantity in the reference unit."
		quantity: Decimal!
		"The currency the answer is wanted in."
		currency: String!
		"The instant the term's window must contain; now when omitted."
		date: DateTime
	}

	"What the resolution answered with."
	type VendorProductTermResolution {
		"The row that priced the line, when one matched."
		term: VendorProductTerm
		"The price to apply, in the requested currency."
		unitCost: Decimal!
		"The negotiated fraction off the price, when the winning row carried one."
		discountPercent: Decimal
		"The currency the price is stated in."
		currency: String!
		"Days from order confirmation to receipt, after the term-then-vendor precedence."
		leadTimeDays: Int!
		"The supplier's container, when the winning row carried one."
		packSize: Decimal
		packLabel: String
		vendorProductCode: String
		vendorProductName: String
		"The allowance the winning row negotiated, when it carried one."
		overReceiptTolerancePercent: Decimal
		"The vendor-level floor on one order, as it stands."
		minimumOrderAmount: Decimal
		"Where the price came from: TERM, VARIANT_COST_PRICE or NONE."
		source: String!
		"What the caller should be told about the outcome."
		warnings: [String!]!
	}

	"Filters a page of vendor terms."
	input VendorProductTermFilter {
		vendorId: ID
		variantId: ID
		currency: String
		status: VendorTermStatus
		vendorProductCode: String
	}

	"One term as a caller writes it."
	input VendorProductTermInput {
		vendorId: ID!
		variantId: ID!
		currency: String
		"The price of one base unit. State this or a pack price."
		unitCost: Decimal
		"The price of the supplier's container, from which the unit price is derived."
		packPrice: Decimal
		packSize: Decimal
		packLabel: String
		discountPercent: Decimal
		minQuantity: Decimal
		leadTimeDays: Int
		vendorProductCode: String
		vendorProductName: String
		overReceiptTolerancePercent: Decimal
		priority: Int
		startsAt: DateTime
		endsAt: DateTime
		status: VendorTermStatus
	}

	"The request that writes several terms at once."
	input BulkVendorProductTermInput {
		terms: [VendorProductTermInput!]!
	}

	"The outcome of a mutation on a vendor term."
	type VendorProductTermPayload {
		vendorProductTerm: VendorProductTerm
		"Every term a bulk write touched."
		vendorProductTerms: [VendorProductTerm!]!
		userErrors: [UserError!]!
	}

	"The outcome of retiring a vendor term."
	type DeleteVendorProductTermPayload {
		id: ID
		userErrors: [UserError!]!
	}

	"Filters a page of purchase orders."
	input PurchaseOrderFilter {
		status: PurchaseOrderStatus
		vendorId: ID
		warehouseId: ID
		number: String
		expectedAt: DateTime
	}

	"Filters a page of goods receipts."
	input GoodsReceiptFilter {
		purchaseOrderId: ID
		warehouseId: ID
		status: GoodsReceiptStatus
		number: String
	}

	"One ordered line as a caller supplies it."
	input PurchaseOrderLineInput {
		variantId: ID!
		quantity: Decimal!
		"The unit the quantity is stated in; the variant's purchase unit when omitted."
		unitId: ID
		"Snapshot of the unit factor, when the caller states one."
		conversionFactor: Decimal
		"Omit to price the line from the standing agreement, then from the variant's own cost price."
		unitCost: Decimal
		taxRate: Decimal
		discountTotal: Decimal
		expectedAt: DateTime
		note: String
	}

	"The request that raises a purchase order."
	input CreatePurchaseOrderInput {
		vendorId: ID!
		warehouseId: ID!
		currency: String!
		"The supplier's own order number, which their acknowledgement and their bill quote."
		vendorReference: String
		"Who owns the order. Defaults to the caller."
		buyerUserId: ID
		"The settlement schedule to snapshot from the supplier's own when it states none."
		paymentTermId: ID
		"The simple settlement form to snapshot, in days."
		paymentTermsDaysSnapshot: Int
		expectedAt: DateTime
		shippingTotal: Decimal
		note: String
		lines: [PurchaseOrderLineInput!]!
		"""
		The client's own key for this request, honoured when one is presented. A request retried under
		the same key is answered with the order the first attempt raised instead of raising a second
		document for the same purchase.
		"""
		idempotencyKey: String
	}

	"An amendment to a draft purchase order."
	input UpdatePurchaseOrderInput {
		vendorReference: String
		buyerUserId: ID
		paymentTermId: ID
		paymentTermsDaysSnapshot: Int
		expectedAt: DateTime
		shippingTotal: Decimal
		note: String
		"Replaces the line set when supplied."
		lines: [PurchaseOrderLineInput!]
	}

	"One received line as a caller supplies it."
	input GoodsReceiptLineInput {
		purchaseOrderLineId: ID!
		quantity: Decimal!
		damagedQuantity: Decimal
		unitCost: Decimal
		batchNumber: String
		expiresAt: DateTime
		warehouseBinId: ID
		note: String
	}

	"The request that records a delivery."
	input CreateGoodsReceiptInput {
		"The order the delivery is anchored to. Omit for a consolidated delivery covering several orders."
		purchaseOrderId: ID
		warehouseId: ID
		receivedAt: DateTime
		"Fraction of the ordered quantity a line may be exceeded by. The line's own standing allowance applies when omitted."
		overReceiptTolerance: Decimal
		note: String
		lines: [GoodsReceiptLineInput!]!
		"""
		The client's own key for this request, which this operation requires. A delivery that is booked
		twice books the stock twice, so the mutation is refused without one.
		"""
		idempotencyKey: String
	}

	"One further line recorded against a receipt that was already posted."
	input RecordGoodsReceiptLineInput {
		purchaseOrderLineId: ID!
		quantity: Decimal!
		damagedQuantity: Decimal
		unitCost: Decimal
		batchNumber: String
		expiresAt: DateTime
		warehouseBinId: ID
		note: String
	}

	"""
	The delivery a caller records against the order the field already names.

	It is the body of \`POST /purchase-orders/:id/receipts\`, and it deliberately states neither of the two
	members the standalone delivery input carries: the order is the field's own argument on this path, and
	the retry key is not demanded here — the order path books a delivery the caller is already looking at
	rather than one raised on its own, so a key the route never asks for would refuse callers the route
	serves. The location is absent for the same reason it is absent from the route: a delivery anchored to
	an order inherits that order's receiving location, and an input that accepted a location the service
	never receives would tell a caller it had moved the goods somewhere it had not.
	"""
	input ReceivePurchaseOrderInput {
		receivedAt: DateTime
		"Fraction of the ordered quantity a line may be exceeded by, e.g. 0.050000 for five percent. The line's own standing allowance applies when omitted."
		overReceiptTolerance: Decimal
		note: String
		lines: [GoodsReceiptLineInput!]!
	}

	"The outcome of a mutation on a purchase order."
	type PurchaseOrderPayload {
		purchaseOrder: PurchaseOrder
		userErrors: [UserError!]!
	}

	"The outcome of deleting a purchase order."
	type DeletePurchaseOrderPayload {
		id: ID
		userErrors: [UserError!]!
	}

	"The outcome of a mutation on a goods receipt."
	type GoodsReceiptPayload {
		goodsReceipt: GoodsReceipt
		"The stock movements the receipt wrote or reversed."
		movementIds: [ID!]!
		"The quantity still expected on the order after this receipt."
		outstandingQuantity: Decimal
		userErrors: [UserError!]!
	}

	"The outcome of deleting a goods receipt."
	type DeleteGoodsReceiptPayload {
		"The receipt that was removed; null when the removal was refused."
		id: ID
		userErrors: [UserError!]!
	}

	"The outcome of deleting a goods receipt line."
	type DeleteGoodsReceiptLinePayload {
		"The line that was removed; null when the removal was refused."
		id: ID
		userErrors: [UserError!]!
	}

	extend type Query {
		"Purchase orders of the caller's organization."
		purchaseOrders(filter: PurchaseOrderFilter, page: PageInput, withDeleted: Boolean): PurchaseOrderConnection!
		"One purchase order, with its lines, its receipts and its supplier."
		purchaseOrder(id: ID!): PurchaseOrder
		"Goods receipts of the caller's organization."
		goodsReceipts(filter: GoodsReceiptFilter, page: PageInput, withDeleted: Boolean): GoodsReceiptConnection!
		"One goods receipt, with its lines and the movements they produced."
		goodsReceipt(id: ID!): GoodsReceipt
		"Standing negotiated terms of the caller's organization."
		vendorProductTerms(filter: VendorProductTermFilter, page: PageInput, withDeleted: Boolean): VendorProductTermConnection!
		"One negotiated term."
		vendorProductTerm(id: ID!): VendorProductTerm
		"What the standing agreement prices a quantity at, and what it says about delivery."
		resolveVendorProductTerm(input: ResolveVendorProductTermInput!): VendorProductTermResolution!
	}

	extend type Mutation {
		"Raises a purchase order against an existing supplier."
		createPurchaseOrder(input: CreatePurchaseOrderInput!): PurchaseOrderPayload!
		"Amends a draft purchase order, replacing its line set when one is supplied."
		updatePurchaseOrder(id: ID!, input: UpdatePurchaseOrderInput!): PurchaseOrderPayload!
		"Deletes a draft purchase order."
		deletePurchaseOrder(id: ID!): DeletePurchaseOrderPayload!
		"Sends an approved purchase order to the supplier."
		sendPurchaseOrder(id: ID!, email: String, note: String): PurchaseOrderPayload!
		"Records the supplier's acknowledgement of a sent order, revising its expected date when one is stated."
		acknowledgePurchaseOrder(id: ID!, expectedAt: DateTime, note: String): PurchaseOrderPayload!
		"Approves a purchase order internally, which is what permits it to be sent."
		approvePurchaseOrder(id: ID!, note: String): PurchaseOrderPayload!
		"Closes a purchase order short of the ordered quantity."
		closePurchaseOrder(id: ID!, reason: String): PurchaseOrderPayload!
		"Cancels a purchase order before anything arrived."
		cancelPurchaseOrder(id: ID!, reason: String): PurchaseOrderPayload!
		"""
		Receives goods against a purchase order, writing the stock movements they produce. The order is
		the one the caller is already looking at, so the field carries it as its own argument and the
		delivery is the input.
		"""
		receivePurchaseOrder(id: ID!, input: ReceivePurchaseOrderInput!): GoodsReceiptPayload!
		"""
		Withdraws a purchase order without removing the row, so the recovery below can read it back. The
		answer is the withdrawn document, as it is on every other soft removal of the platform.
		"""
		softDeletePurchaseOrder(id: ID!): PurchaseOrder!
		"Puts a withdrawn purchase order back."
		recoverPurchaseOrder(id: ID!): PurchaseOrder!
		"""
		Withdraws one line of a purchase order without removing the row. A line is read through its order
		rather than by id, so this pair is the only root field the line answers — and it answers them because
		the line's own controller serves both routes under the order-edit grant.
		"""
		softDeletePurchaseOrderLine(id: ID!): PurchaseOrderLine!
		"Puts a withdrawn purchase order line back."
		recoverPurchaseOrderLine(id: ID!): PurchaseOrderLine!
		"Receives goods against a purchase order, writing the stock movements they produce."
		createGoodsReceipt(input: CreateGoodsReceiptInput!): GoodsReceiptPayload!
		"Records one further line against a receipt that was already posted."
		recordGoodsReceiptLine(receiptId: ID!, input: RecordGoodsReceiptLineInput!): GoodsReceiptPayload!
		"Ends a receipt: its quantities are taken back out of stock and off the order's lines."
		closeGoodsReceipt(id: ID!, reason: String): GoodsReceiptPayload!
		"""
		Deletes a goods receipt outright.

		The row leaves the database rather than being withdrawn, so the movements it wrote stay in the
		ledger with nothing left to explain them — which is why the withdrawal below and the reversal above
		are the removals a caller reaches for. It is mirrored because \`DELETE /goods-receipts/:id\` serves
		it and §3.1 requires one mutation per REST write route; the answer carries the identity, because a
		removed row is not there to answer with.
		"""
		deleteGoodsReceipt(id: ID!): DeleteGoodsReceiptPayload!
		"""
		Withdraws a goods receipt without removing the row, so the recovery below can read it back. The
		receipt controller serves \`DELETE /goods-receipts/:id/soft\` and overrides it only to state a
		permission the inherited declaration leaves unstated — \`GOODS_RECEIPTS_CREATE\`, the grant
		recording a delivery carries — and this field states the same one. It answers the payload the
		resource's own mutations answer rather than the receipt itself, so a client generated from the
		composed schema sees one shape per resource.
		"""
		softDeleteGoodsReceipt(id: ID!): GoodsReceiptPayload!
		"Puts a withdrawn goods receipt back, under the grant its route states."
		recoverGoodsReceipt(id: ID!): GoodsReceiptPayload!
		"""
		Withdraws one line of a goods receipt without removing the row. A receipt line is read through its
		receipt, so this pair is the only root field the line answers — and it answers them because the
		line's own controller serves both routes under the receiving grant. It answers the line, which is
		what those routes answer and what no payload of this document carries.
		"""
		softDeleteGoodsReceiptLine(id: ID!): GoodsReceiptLine!
		"Puts a withdrawn goods receipt line back."
		recoverGoodsReceiptLine(id: ID!): GoodsReceiptLine!
		"""
		Deletes a goods receipt line outright.

		The row leaves the database rather than being withdrawn, so the movement the line was written from
		stays in the ledger with nothing left to explain it — the withdrawal below is the removal a caller
		reaches for. It is mirrored because \`DELETE /goods-receipt-lines/:id\` serves it and §3.1 requires
		one mutation per REST write route; the answer carries the identity, because a removed row is not
		there to answer with.
		"""
		deleteGoodsReceiptLine(id: ID!): DeleteGoodsReceiptLinePayload!
		"Writes a term, which is the standing agreement a purchase line is priced from."
		createVendorProductTerm(input: VendorProductTermInput!): VendorProductTermPayload!
		"Amends a term."
		updateVendorProductTerm(id: ID!, input: VendorProductTermInput!): VendorProductTermPayload!
		"Writes several terms in one call, which is how a product-wide agreement is recorded."
		bulkVendorProductTerms(input: BulkVendorProductTermInput!): VendorProductTermPayload!
		"Retires a term. One a placed order used is kept and moved to INACTIVE."
		deleteVendorProductTerm(id: ID!): DeleteVendorProductTermPayload!
		"""
		Withdraws a term without removing the row, so the recovery below can read it back — the recoverable
		half of the lifecycle, where the field above retires a term the organization no longer wants. The
		term controller serves \`DELETE /vendor-product-terms/:id/soft\` and overrides it only to state
		\`VENDOR_TERMS_EDIT\`, the grant every write route of this resource states, and this field states
		the same one. It answers the payload the resource's write mutations answer.
		"""
		softDeleteVendorProductTerm(id: ID!): VendorProductTermPayload!
		"Puts a withdrawn term back, under the grant its route states."
		recoverVendorProductTerm(id: ID!): VendorProductTermPayload!
	}
`;
