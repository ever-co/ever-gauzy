import { gql } from 'graphql-tag';

/**
 * The GraphQL surface of the returns domain.
 *
 * Types, inputs, enums and the domain's root fields, declared as one document that is composed into
 * the platform schema at boot. The root operation types belong to the kernel, so this file only
 * extends them — a second declaration of `type Query` would be a duplicate definition and would fail
 * the schema build.
 *
 * **Each of the seven resources carries the `DELETE /:id/soft` and `PUT /:id/recover` pair its
 * controller inherits, under the names the composed schema uses for that act: `softDelete<Resource>`
 * and `recover<Resource>`.** Every controller in this plugin serves those two routes over REST and
 * overrides them only to state the permission the inherited pair leaves unstated, so without these
 * fields a caller could retire a return, a claim, an exchange, a reason or any of their lines
 * recoverably on one protocol and not on the other — where the only deletion-shaped field it held was
 * the destructive one, which is exactly what the soft routes exist to avoid on rows that money, stock
 * and history point at.
 *
 * Money and quantities are `Decimal`, never `Float`: an amount read here and the same amount read
 * over REST are the same string, and a binary fraction cannot hold a cent exactly.
 */
export const schemaExtensions = gql`
	"Where a return is in its lifecycle."
	enum OrderReturnStatus {
		OPEN
		REQUESTED
		APPROVED
		RECEIVED
		PARTIALLY_RECEIVED
		REJECTED
		CANCELED
		CLOSED
	}

	"The resolution a claim asks for."
	enum OrderClaimType {
		REFUND
		REPLACE
	}

	"Where a claim is in its lifecycle."
	enum OrderClaimStatus {
		OPEN
		REQUESTED
		APPROVED
		REJECTED
		CANCELED
		CLOSED
	}

	"Why a claim line is being claimed."
	enum OrderClaimReason {
		MISSING_ITEM
		WRONG_ITEM
		PRODUCTION_FAILURE
		DAMAGED
		OTHER
	}

	"Where an exchange is in its lifecycle."
	enum OrderExchangeStatus {
		OPEN
		REQUESTED
		APPROVED
		REJECTED
		CANCELED
		CLOSED
	}

	"Goods coming back against a delivered order."
	type OrderReturn {
		id: ID!
		"The order the goods came from."
		orderId: ID
		"The allocated return number."
		number: String!
		status: OrderReturnStatus!
		"Receiving location."
		warehouseId: ID
		"The governed reason the return was filed under."
		reasonId: ID
		reasonCode: OrderReturnReason
		"Free-text explanation kept beside the governed reason."
		reason: String
		"What the tenant expects to refund."
		refundAmount: Decimal
		currency: String!
		requestedAt: DateTime
		approvedAt: DateTime
		receivedAt: DateTime
		canceledAt: DateTime
		closedAt: DateTime
		"The claim this return was created by, when it was."
		claimId: ID
		"The exchange this return is the inbound half of, when it is."
		exchangeId: ID
		shippingOptionId: ID
		noNotification: Boolean!
		note: String
		metadata: JSON
		lines: [OrderReturnLine!]!
		"The quantity still expected back across the return's lines."
		outstandingQuantity: Decimal!
		"""
		The version of the return, which every write of it moves on. A client states the version it
		read so its write can be refused when someone else moved the return on in between, and reads
		the new one back from the payload of the write.
		"""
		version: Int!
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One line of a return."
	type OrderReturnLine {
		id: ID!
		returnId: ID
		orderLineId: ID
		quantity: Decimal!
		receivedQuantity: Decimal!
		damagedQuantity: Decimal!
		reasonId: ID
		restock: Boolean!
		warehouseId: ID
		note: String
		metadata: JSON
		"The quantity still expected back on this line."
		outstandingQuantity: Decimal!
	}

	"A governed reason code for returns."
	type OrderReturnReason {
		id: ID!
		code: String!
		label: String!
		description: String
		parentId: ID
		isActive: Boolean
		children: [OrderReturnReason!]!
	}

	"A complaint about a delivered order and the resolution chosen for it."
	type OrderClaim {
		id: ID!
		orderId: ID
		number: String!
		type: OrderClaimType!
		status: OrderClaimStatus!
		refundAmount: Decimal
		currency: String!
		"The return created for this claim, when the goods have to come back."
		returnId: ID
		returnOfClaim: OrderReturn
		reason: String
		note: String
		canceledAt: DateTime
		metadata: JSON
		lines: [OrderClaimLine!]!
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One line of a claim."
	type OrderClaimLine {
		id: ID!
		claimId: ID
		orderLineId: ID
		variantId: ID
		quantity: Decimal!
		reason: OrderClaimReason!
		isAdditionalItem: Boolean!
		note: String
		metadata: JSON
	}

	"A return that immediately becomes a new shipment."
	type OrderExchange {
		id: ID!
		orderId: ID
		number: String!
		status: OrderExchangeStatus!
		"Outbound value minus inbound value: positive when the customer owes money."
		differenceDue: Decimal
		currency: String!
		"The inbound half."
		returnId: ID
		returnOfExchange: OrderReturn
		allowBackorder: Boolean!
		note: String
		canceledAt: DateTime
		metadata: JSON
		lines: [OrderExchangeLine!]!
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One outbound line of an exchange."
	type OrderExchangeLine {
		id: ID!
		exchangeId: ID
		orderLineId: ID
		variantId: ID
		quantity: Decimal!
		"The replacement price, snapshotted so the difference stays explainable."
		unitPrice: Decimal!
		note: String
		metadata: JSON
		"""
		The value of this line: quantity multiplied by the snapshotted unit price, expressed in the
		currency the caller states. The currency is an argument rather than a stored field because a
		line belongs to an exchange, and the exchange is where the currency lives.
		"""
		lineTotal(currency: String!): Decimal!
	}

	"One page of returns."
	type OrderReturnConnection {
		edges: [OrderReturnEdge!]!
		nodes: [OrderReturn!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One return inside a page."
	type OrderReturnEdge {
		cursor: String!
		node: OrderReturn!
	}

	"One page of return reasons."
	type OrderReturnReasonConnection {
		edges: [OrderReturnReasonEdge!]!
		nodes: [OrderReturnReason!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One return reason inside a page."
	type OrderReturnReasonEdge {
		cursor: String!
		node: OrderReturnReason!
	}

	"One page of claims."
	type OrderClaimConnection {
		edges: [OrderClaimEdge!]!
		nodes: [OrderClaim!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One claim inside a page."
	type OrderClaimEdge {
		cursor: String!
		node: OrderClaim!
	}

	"One page of exchanges."
	type OrderExchangeConnection {
		edges: [OrderExchangeEdge!]!
		nodes: [OrderExchange!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One exchange inside a page."
	type OrderExchangeEdge {
		cursor: String!
		node: OrderExchange!
	}

	"One page of return lines."
	type OrderReturnLineConnection {
		edges: [OrderReturnLineEdge!]!
		nodes: [OrderReturnLine!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One return line inside a page."
	type OrderReturnLineEdge {
		cursor: String!
		node: OrderReturnLine!
	}

	"One page of claim lines."
	type OrderClaimLineConnection {
		edges: [OrderClaimLineEdge!]!
		nodes: [OrderClaimLine!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One claim line inside a page."
	type OrderClaimLineEdge {
		cursor: String!
		node: OrderClaimLine!
	}

	"One page of exchange lines."
	type OrderExchangeLineConnection {
		edges: [OrderExchangeLineEdge!]!
		nodes: [OrderExchangeLine!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One exchange line inside a page."
	type OrderExchangeLineEdge {
		cursor: String!
		node: OrderExchangeLine!
	}

	"Filters a page of returns."
	input OrderReturnFilter {
		status: OrderReturnStatus
		orderId: ID
		number: String
		warehouseId: ID
	}

	"Filters a page of return reasons."
	input OrderReturnReasonFilter {
		isActive: Boolean
		parentId: ID
		code: String
	}

	"Filters a page of claims."
	input OrderClaimFilter {
		status: OrderClaimStatus
		type: OrderClaimType
		orderId: ID
		number: String
	}

	"Filters a page of exchanges."
	input OrderExchangeFilter {
		status: OrderExchangeStatus
		orderId: ID
		number: String
	}

	"One requested line of a return."
	input OrderReturnLineInput {
		orderLineId: ID!
		quantity: Decimal!
		reasonId: ID
		restock: Boolean
		warehouseId: ID
		note: String
	}

	"The request that opens a return."
	input RequestOrderReturnInput {
		orderId: ID!
		lines: [OrderReturnLineInput!]!
		warehouseId: ID
		reasonId: ID
		reason: String
		currency: String!
		shippingOptionId: ID
		noNotification: Boolean
		note: String
		"""
		The client's own key for this request, honoured when one is presented. A request that is
		retried under the same key is answered with the first attempt's response instead of raising a
		second return.
		"""
		idempotencyKey: String
	}

	"One line as it is received back."
	input ReceiveOrderReturnLineInput {
		lineId: ID!
		receivedQuantity: Decimal!
		damagedQuantity: Decimal
		restock: Boolean
	}

	"The receipt of a return's goods."
	input ReceiveOrderReturnInput {
		lines: [ReceiveOrderReturnLineInput!]!
		warehouseId: ID
		refund: Decimal
		note: String
		"The version of the return the caller read, which this receipt is predicated on."
		version: Int
		"""
		The client's own key for this request, which this operation requires. A receipt is refused
		without one, because receiving the same goods twice restocks and refunds them twice.
		"""
		idempotencyKey: String
	}

	"The definition of a governed return reason."
	input OrderReturnReasonInput {
		code: String!
		label: String!
		description: String
		parentId: ID
		isActive: Boolean
	}

	"One claimed line."
	input OrderClaimLineInput {
		orderLineId: ID
		variantId: ID
		quantity: Decimal!
		reason: OrderClaimReason
		isAdditionalItem: Boolean
		note: String
	}

	"The request that opens a claim."
	input RequestOrderClaimInput {
		orderId: ID!
		type: OrderClaimType!
		currency: String!
		lines: [OrderClaimLineInput!]!
		reason: String
		note: String
	}

	"One requested replacement line."
	input OrderExchangeLineInput {
		orderLineId: ID
		variantId: ID!
		quantity: Decimal!
		unitPrice: Decimal
		note: String
	}

	"The request that opens an exchange."
	input RequestOrderExchangeInput {
		orderId: ID!
		currency: String!
		lines: [OrderExchangeLineInput!]!
		returnId: ID
		allowBackorder: Boolean
		note: String
	}

	"""
	One line as an operator replaces a return's line set.

	It is the request's own line shape rather than a second one, because the edit writes the same
	columns the request wrote — a set replaced with a shape of its own would be two ways to state one
	line, and the ceiling check runs against whichever arrived.
	"""
	input UpdateOrderReturnLineInput {
		orderLineId: ID!
		quantity: Decimal!
		reasonId: ID
		restock: Boolean
		warehouseId: ID
		note: String
	}

	"""
	The edit of a requested return: its header fields, and the line set that replaces the old one.

	The version is a member here rather than an argument of the mutation, because this act takes an
	input and the kernel reads the accepted version from the operation's arguments: a client states it
	beside what it is changing. It is nullable because the refusal is the kernel's to state — a write
	that sends none is answered \`VERSION_REQUIRED\`, which is the answer the REST route's missing
	\`If-Match\` gets — and a document that made the member non-null would refuse the request before the
	kernel could answer it.
	"""
	input UpdateOrderReturnInput {
		lines: [UpdateOrderReturnLineInput!]
		warehouseId: ID
		reason: String
		note: String
		version: Int
	}

	"The amount a received return is refunded, and what explains it."
	input RefundOrderReturnInput {
		amount: Decimal!
		reasonId: ID
		note: String
		version: Int
	}

	"The return leg: the shipment that brings the goods back."
	input ShipOrderReturnInput {
		shippingOptionId: ID
		warehouseId: ID
		trackingNumber: String
		version: Int
	}

	"""
	One line as an operator replaces a claim's line set.

	\`orderLineId\` and \`variantId\` are both optional because a claim line is one of two things — the
	defective or missing original, or a replacement unit to be shipped — and the service refuses a line
	that states both or neither. Stating both here would let the document imply a shape the service
	rejects.
	"""
	input UpdateOrderClaimLineInput {
		orderLineId: ID
		variantId: ID
		quantity: Decimal
		reason: OrderClaimReason
		isAdditionalItem: Boolean
		note: String
	}

	"The edit of an open claim: what explains it, and the line set that replaces the old one."
	input UpdateOrderClaimInput {
		lines: [UpdateOrderClaimLineInput!]
		reason: String
		note: String
	}

	"""
	One line as an operator replaces an exchange's line set.

	\`variantId\` is required and \`unitPrice\` is not, which is the route's own body: a replacement is
	always for a named variant, and a line that states no price is priced by the service against the
	resolved price of the day.
	"""
	input UpdateOrderExchangeLineInput {
		orderLineId: ID
		variantId: ID!
		quantity: Decimal
		unitPrice: Decimal
		note: String
	}

	"The edit of an open exchange: the backorder allowance, a note, and the line set that replaces the old one."
	input UpdateOrderExchangeInput {
		lines: [UpdateOrderExchangeLineInput!]
		allowBackorder: Boolean
		note: String
	}

	"The outcome of a mutation on a return."
	type RequestOrderReturnPayload {
		orderReturn: OrderReturn
		userErrors: [UserError!]!
	}

	"The outcome of receiving a return's goods."
	type ReceiveOrderReturnPayload {
		orderReturn: OrderReturn
		"The stock movements the receipt wrote."
		movementIds: [ID!]!
		"The refund that was issued, when one was."
		refundId: ID
		refundAmount: Decimal
		"Completed quantity across the received lines."
		receivedQuantity: Decimal!
		"Quantity still expected back."
		outstandingQuantity: Decimal!
		userErrors: [UserError!]!
	}

	"The outcome of a mutation on a claim."
	type RequestOrderClaimPayload {
		orderClaim: OrderClaim
		"The refund that was issued, when the resolution settled in money."
		refundId: ID
		userErrors: [UserError!]!
	}

	"The outcome of a mutation on an exchange."
	type RequestOrderExchangePayload {
		orderExchange: OrderExchange
		userErrors: [UserError!]!
	}

	"The outcome of a mutation on a return reason."
	type OrderReturnReasonPayload {
		orderReturnReason: OrderReturnReason
		userErrors: [UserError!]!
	}

	"The outcome of removing a return reason."
	type DeleteOrderReturnReasonPayload {
		id: ID
		userErrors: [UserError!]!
	}

	"""
	The outcome of refunding a received return.

	It answers the return beside the refund because the write moves two rows: the refund is what the
	provider settled, and the return is where the running refund total and the version moved on. A
	payload carrying only the refund would leave a client to re-read the return to learn the version
	its next write has to state.
	"""
	type RefundOrderReturnPayload {
		orderReturn: OrderReturn
		"The refund that was written."
		refundId: ID
		"The amount actually paid back, which is what was recorded rather than what was asked for."
		refundAmount: Decimal
		currency: String
		userErrors: [UserError!]!
	}

	"""
	The outcome of creating a return's inbound shipment.

	The leg is a fulfillment of another domain, so it is named by its identifier rather than carried as
	an object graph this document does not own; the label, when the carrier issued one, travels with it
	because re-fetching it is another call to the carrier.
	"""
	type ShipOrderReturnPayload {
		orderReturn: OrderReturn
		"The fulfillment that carries the goods back."
		fulfillmentId: ID
		trackingNumber: String
		labelUrl: String
		userErrors: [UserError!]!
	}

	"""
	The outcome of removing a return destructively.

	It carries the identifier and nothing else, because there is no row left to carry: the deletion is
	physical, and a payload shaped like the resource's others would promise a row that no longer exists.
	"""
	type DeleteOrderReturnPayload {
		id: ID
		userErrors: [UserError!]!
	}

	"The outcome of removing a claim destructively."
	type DeleteOrderClaimPayload {
		id: ID
		userErrors: [UserError!]!
	}

	"The outcome of removing an exchange destructively."
	type DeleteOrderExchangePayload {
		id: ID
		userErrors: [UserError!]!
	}

	extend type Query {
		"Returns of the caller's organization."
		orderReturns(filter: OrderReturnFilter, page: PageInput, withDeleted: Boolean): OrderReturnConnection!
		"One return, with its lines and its governed reason."
		orderReturn(id: ID!): OrderReturn
		"Governed return reasons, as a two-level tree."
		orderReturnReasons(
			filter: OrderReturnReasonFilter
			page: PageInput
			withDeleted: Boolean
		): OrderReturnReasonConnection!
		"One governed return reason."
		orderReturnReason(id: ID!): OrderReturnReason
		"Claims of the caller's organization."
		orderClaims(filter: OrderClaimFilter, page: PageInput, withDeleted: Boolean): OrderClaimConnection!
		"One claim, with its lines and its linked return."
		orderClaim(id: ID!): OrderClaim
		"Exchanges of the caller's organization."
		orderExchanges(filter: OrderExchangeFilter, page: PageInput, withDeleted: Boolean): OrderExchangeConnection!
		"One exchange, with its outbound lines and its inbound return."
		orderExchange(id: ID!): OrderExchange
		"The lines of a return."
		orderReturnLines(returnId: ID!, page: PageInput, withDeleted: Boolean): OrderReturnLineConnection!
		"The lines of a claim."
		orderClaimLines(claimId: ID!, page: PageInput, withDeleted: Boolean): OrderClaimLineConnection!
		"The outbound lines of an exchange."
		orderExchangeLines(exchangeId: ID!, page: PageInput, withDeleted: Boolean): OrderExchangeLineConnection!
	}

	extend type Mutation {
		"Requests a return against an order."
		requestOrderReturn(input: RequestOrderReturnInput!): RequestOrderReturnPayload!
		"""
		Edits a requested return: its receiving location, its reason, its note, and the line set that
		replaces the old one.

		The route this mirrors is \`PUT /order-returns/:id\`, and without it a caller could raise a
		return over GraphQL and then not correct it on the protocol that raised it: a line requested in
		the wrong quantity could only be withdrawn and re-requested, which allocates a second return
		number for one correction and leaves the first in the caller's history. The line set is replaced
		wholesale rather than added to, because the service refuses a return whose goods have started
		arriving — the quantities the movements were written against are what a partial rewrite would
		put underneath them.
		"""
		updateOrderReturn(id: ID!, input: UpdateOrderReturnInput!): RequestOrderReturnPayload!
		"""
		Approves a requested return. The version the caller read rides as its own argument rather than
		in an input, because deciding a status takes no other input and one GraphQL request may carry
		several mutations, so a version cannot be stated once for all of them.
		"""
		approveOrderReturn(id: ID!, note: String, version: Int): RequestOrderReturnPayload!
		"Rejects a requested return, under the version the caller read."
		rejectOrderReturn(id: ID!, reason: String, version: Int): RequestOrderReturnPayload!
		"Receives returned goods, writing the stock movements and issuing the refund."
		receiveOrderReturn(id: ID!, input: ReceiveOrderReturnInput!): ReceiveOrderReturnPayload!
		"""
		Refunds a received return, moving its running refund total on.

		It is a capability of its own and not a second door to the receipt: the receipt issues a refund
		when \`returns.refundTrigger\` is \`ON_RECEIVE\` or \`ON_APPROVAL\`, and is skipped when it is
		\`MANUAL\` — which is the setting under which this field is the only way a return's money goes
		back. It also reaches a return the receipt cannot: the service accepts \`RECEIVED\`,
		\`PARTIALLY_RECEIVED\` and \`CLOSED\`, while the receipt is refused on anything that is not
		\`APPROVED\` or \`PARTIALLY_RECEIVED\`, so a refund decided after the last parcel arrived had no
		door at all.

		The grant is the route's own, \`RETURNS_RECEIVE\`, and not the \`REFUNDS_CREATE\` that
		\`06-api-specification.md\` §7.14 states for the route: the two disagree in the repository, and a
		field mirrors what its route *does*. Stating the documented grant here would let a caller holding
		it move money over GraphQL while the same caller is refused the same act over REST — the one
		direction §3.1 forbids. The divergence is recorded rather than resolved, because settling it
		changes the route as well as the field.

		No retry key is declared, because the route declares none. §7.14 writes "Yes (Idempotency-Key,
		required)" for it and the controller's own \`@Idempotent\` decorators sit on the request and the
		receipt only; inventing a scope here would dedupe a GraphQL retry that the REST route lets
		through, which is a difference in behaviour rather than a difference in transport.
		"""
		refundOrderReturn(id: ID!, input: RefundOrderReturnInput!): RefundOrderReturnPayload!
		"""
		Creates the return leg: the shipment that brings the goods back.

		It is not the fulfillment domain's create. \`createFulfillment\` raises an outbound shipment
		whose lines are what a picking list is built from and refuses one without lines; a return leg
		carries none, because goods coming back are not fetched from a bin — they arrive, and the
		quantity that arrived is recorded against the return's own lines. The leg is raised through the
		return, which is what lets the service require the return to be \`APPROVED\` before a label
		exists, stamp the return's identifier onto the shipment, and record the chosen option back on
		the return it belongs to. Without this field a caller could approve a return over GraphQL and
		then have to leave the protocol to send it.

		The grant, the missing retry key and the version member are the route's: \`RETURNS_CREATE\`,
		no \`Idempotent-Key\` despite §7.14 stating one, and the version the caller read.
		"""
		shipOrderReturn(id: ID!, input: ShipOrderReturnInput!): ShipOrderReturnPayload!
		"Cancels a return, under the version the caller read."
		cancelOrderReturn(id: ID!, reason: String, version: Int): RequestOrderReturnPayload!
		"Closes a fully received return, under the version the caller read."
		closeOrderReturn(id: ID!, version: Int): RequestOrderReturnPayload!
		"Retires a return recoverably, keeping the receipt, the stock movements and the refund it wrote."
		softDeleteOrderReturn(id: ID!): RequestOrderReturnPayload!
		"Restores a soft-deleted return."
		recoverOrderReturn(id: ID!): RequestOrderReturnPayload!
		"""
		Removes a return destructively.

		Two facts meet here and a reader should meet both rather than one. The withdrawal this domain
		wants is \`softDeleteOrderReturn\`: the receipt wrote stock movements and the refund wrote money,
		and both point back at the row, so retiring a return recoverably keeps them explainable while
		taking it out of every live read. This field mirrors the *destructive* route the controller
		inherits from \`CrudController\` — \`06-api-specification.md\` §2 declares \`DELETE /:id\` in the
		inherited route set for every entity resource §7 lists, returns' row does not say otherwise, and
		the marketplace row names six \`delete*\` fields for its own — and it is delivered so the two
		protocols offer the same acts rather than the safe one twice. What it costs is stated rather
		than hidden: \`order_return_line\` cascades from the return, so the rows it removes include the
		lines the receipt recorded against, and the refunds raised for it keep their identifier but lose
		the return they were attributed to.
		"""
		deleteOrderReturn(id: ID!): DeleteOrderReturnPayload!
		"Retires a return line recoverably, so the quantities the return was received against survive."
		softDeleteOrderReturnLine(id: ID!): OrderReturnLine!
		"Restores a soft-deleted return line."
		recoverOrderReturnLine(id: ID!): OrderReturnLine!
		"Creates a governed return reason."
		createOrderReturnReason(input: OrderReturnReasonInput!): OrderReturnReasonPayload!
		"Updates a governed return reason."
		updateOrderReturnReason(id: ID!, input: OrderReturnReasonInput!): OrderReturnReasonPayload!
		"Deactivates a governed return reason."
		deleteOrderReturnReason(id: ID!): DeleteOrderReturnReasonPayload!
		"""
		Removes a return reason that was never used, which is a different act from deactivating it.

		\`deleteOrderReturnReason\` deactivates: the row stays, and the returns already filed under it
		keep explaining themselves in a report. This field is the physical removal, and it is what
		\`DELETE /order-return-reasons/:id\` serves — §7.14 declares that route's answer as
		\`DeleteResult\`, which is a deletion's shape rather than a row's, while the controller answers
		the same path by deactivating and keeps this one at \`/:id/hard\`. The reason the two must not be
		confused is the one the service does not enforce: \`order_return.reasonId\` is \`SET NULL\`, so
		removing a reason that *has* explained a return nulls the reason on every return filed under it.
		"""
		hardDeleteOrderReturnReason(id: ID!): DeleteOrderReturnReasonPayload!
		"Retires a governed return reason recoverably, so the returns filed under it stay explainable."
		softDeleteOrderReturnReason(id: ID!): OrderReturnReasonPayload!
		"Restores a soft-deleted return reason."
		recoverOrderReturnReason(id: ID!): OrderReturnReasonPayload!
		"Raises a claim against an order."
		requestOrderClaim(input: RequestOrderClaimInput!): RequestOrderClaimPayload!
		"""
		Edits an open claim: what explains it, and the line set that replaces the old one.

		The service refuses the edit once the claim is decided, because changing a claim after a refund
		was issued would leave the refund explaining a claim that no longer says what it said. Without
		this field a claim raised over GraphQL in error could only be withdrawn, which loses the
		complaint the corrected one would have recorded.
		"""
		updateOrderClaim(id: ID!, input: UpdateOrderClaimInput!): RequestOrderClaimPayload!
		"Approves and settles a claim."
		approveOrderClaim(id: ID!, refundAmount: Decimal, note: String): RequestOrderClaimPayload!
		"Rejects a claim."
		rejectOrderClaim(id: ID!, reason: String): RequestOrderClaimPayload!
		"""
		Cancels a claim.

		Cancelling and rejecting are separate acts on the same row and the plugin grants them
		separately: a rejection is a decision — the complaint was examined and refused — while a
		cancellation is the caller abandoning its own, which is why the route states \`CLAIMS_CREATE\`
		where the rejection states \`CLAIMS_RESOLVE\`. Without this field a claim could reach \`CANCELED\`
		over REST and only \`REJECTED\` over GraphQL, so a customer withdrawing a claim would be recorded
		as having had it refused.
		"""
		cancelOrderClaim(id: ID!, reason: String): RequestOrderClaimPayload!
		"Retires a claim recoverably, keeping the refund it settled and the lines it raised."
		softDeleteOrderClaim(id: ID!): RequestOrderClaimPayload!
		"Restores a soft-deleted claim."
		recoverOrderClaim(id: ID!): RequestOrderClaimPayload!
		"""
		Removes a claim destructively.

		\`softDeleteOrderClaim\` is the withdrawal this domain wants — a claim that settled in money is
		the record of that money — and this field mirrors the destructive route \`CrudController\`
		inherits (\`06-api-specification.md\` §2), delivered so both protocols offer the same acts. It
		takes the claim's lines with it, which is what \`order_claim_line\` cascading from \`order_claim\`
		means.
		"""
		deleteOrderClaim(id: ID!): DeleteOrderClaimPayload!
		"Retires a claim line recoverably, keeping the complaint the claim records."
		softDeleteOrderClaimLine(id: ID!): OrderClaimLine!
		"Restores a soft-deleted claim line."
		recoverOrderClaimLine(id: ID!): OrderClaimLine!
		"Requests an exchange against an order."
		requestOrderExchange(input: RequestOrderExchangeInput!): RequestOrderExchangePayload!
		"""
		Edits an open exchange: its backorder allowance, a note, and the line set that replaces the old
		one.

		A replacement line's price is snapshotted when the set is written, so an exchange edited after
		approval would re-price lines the customer was already charged the difference on — which is why
		the service refuses the edit then, and why the capability exists at all: before approval the
		difference is not settled and the set is still the caller's to state.
		"""
		updateOrderExchange(id: ID!, input: UpdateOrderExchangeInput!): RequestOrderExchangePayload!
		"Approves an exchange and prices the difference."
		approveOrderExchange(id: ID!, settleDifference: Boolean, note: String): RequestOrderExchangePayload!
		"Rejects an exchange."
		rejectOrderExchange(id: ID!, reason: String): RequestOrderExchangePayload!
		"""
		Cancels an exchange.

		A cancellation releases the reservations the exchange holds for its replacement units, which a
		rejection does not: rejecting decides the exchange was not warranted, while cancelling abandons
		one that was approved and reserved stock that nobody is going to ship. The route states
		\`EXCHANGES_CREATE\` for that reason, and a GraphQL caller without this field could reserve stock
		and then have no way to give it back.
		"""
		cancelOrderExchange(id: ID!, reason: String): RequestOrderExchangePayload!
		"Retires an exchange recoverably, keeping the difference it priced and the customer was charged."
		softDeleteOrderExchange(id: ID!): RequestOrderExchangePayload!
		"Restores a soft-deleted exchange."
		recoverOrderExchange(id: ID!): RequestOrderExchangePayload!
		"""
		Removes an exchange destructively.

		\`softDeleteOrderExchange\` is the withdrawal this domain wants — the difference was priced once
		and charged, and the row is the explanation of that charge — and this field mirrors the
		destructive route \`CrudController\` inherits (\`06-api-specification.md\` §2), delivered so both
		protocols offer the same acts. It takes the exchange's outbound lines with it.
		"""
		deleteOrderExchange(id: ID!): DeleteOrderExchangePayload!
		"Retires an exchange line recoverably, so the priced difference stays explainable."
		softDeleteOrderExchangeLine(id: ID!): OrderExchangeLine!
		"Restores a soft-deleted exchange line."
		recoverOrderExchangeLine(id: ID!): OrderExchangeLine!
	}
`;
