import { Injectable, InternalServerErrorException, NotFoundException, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EntityManager, FindManyOptions, In, MoreThan, MoreThanOrEqual } from 'typeorm';
import { EntityManager as MikroOrmEntityManager, TransactionContext } from '@mikro-orm/core';
import {
	AdjustmentOwnerType,
	FulfillmentStatus,
	ID,
	IOrderTotals,
	IOutboxWriteInput,
	IPagination,
	OrderStatus,
	OrderTransactionType,
	OrderPaymentStatus,
	TaxLineOwnerType
} from '@gauzy/contracts';
import {
	Adjustment,
	AdjustmentService,
	ApiErrorCode,
	ApiException,
	CrudService,
	IVersionedWriter,
	TaxLine,
	TaxLineService,
	EventOutboxService,
	addDecimalStrings,
	commitVersionedUpdate,
	compareDecimalStrings,
	normalizeDecimalString,
	subtractDecimalStrings
} from '@gauzy/core';
import { ITotalsAdjustment, ITotalsContext, ITotalsSnapshot, ITotalsTaxLine, TotalsCalculator } from '@gauzy/plugin-cart';
import { Order } from '../order/order.entity';
import {
	ANY_ORDER_VERSION,
	ORDER_AGGREGATE_TYPE,
	ORDER_AGGREGATE_WRITER,
	ORDER_TOTALS_AUDIT_WINDOW_DAYS,
	ORDER_TOTALS_RECONCILED_REASON,
	OrderVersionExpectation
} from '../order.types';
import { OrderCreditLine } from '../order-credit-line/order-credit-line.entity';
import { OrderCreditLineService } from '../order-credit-line/order-credit-line.service';
import { OrderLine } from '../order-line/order-line.entity';
import { OrderLineService } from '../order-line/order-line.service';
import { OrderShippingMethod } from '../order-shipping-method/order-shipping-method.entity';
import { OrderShippingMethodService } from '../order-shipping-method/order-shipping-method.service';
import { OrderSummaryService } from '../order-summary/order-summary.service';
import { scopeOfOrderRow } from '../order-history/order-row-scope';
import { OrderTransaction } from '../order-transaction/order-transaction.entity';
import { OrderTransactionService } from '../order-transaction/order-transaction.service';
import { OrderStateMachine } from '../order-state-machine/order-state-machine';
import { TypeOrmOrderRepository } from '../order/repository/type-orm-order.repository';
import { OrderUnitOfWork, chunk, inOwnUnitOfWork } from './order-unit-of-work';

/**
 * One `order.*` fact, as the move that caused it states it.
 *
 * The name is `<aggregate>.<action>` — the form the outbox, the webhook subscriptions and the
 * consumer registry all match on — and the payload is a projection rather than an entity dump: a
 * consumer that needs the order reads the order, and an event that carried the row would promise a
 * shape this package would then be unable to change.
 */
export interface IOrderEvent {
	/** `order.placed`, `order.confirmed`, `order.canceled`, `order.completed`, `order.archived`. */
	name: string;
	/** What a consumer receives beside the order's identity. */
	data?: Record<string, unknown>;
}

/**
 * What a recalculation is told beyond the order it acts on.
 */
export interface IOrderRecalculation {
	/**
	 * The fact this write announces, when the move that triggered it announces one.
	 *
	 * Stated here rather than published by the caller afterwards, because the announcement has to be
	 * bound to the write that earned it: a conditional update that was refused throws out of this
	 * method, so an event stated for it is never appended, and a caller that published on its own
	 * would have announced a placement the statement declined. A recalculation that announces nothing
	 * — a totals refresh, a subscription cycle's second pass — states no event and appends no row.
	 */
	event?: IOrderEvent;

	/**
	 * The version the caller read the order at.
	 *
	 * A route passes what its `If-Match` header stated, so a recalculation reasoned about from an
	 * order that has moved on is refused rather than applied on top of someone else's change. A caller
	 * inside the package states nothing and the write is predicated on the version the row holds when
	 * the statement runs.
	 */
	expectation?: OrderVersionExpectation;

	/**
	 * The columns the triggering operation commits in the same statement as the totals.
	 *
	 * A lifecycle move and the totals it produces are one write, not two that a reader could observe
	 * apart: the state machine's own columns ride here, so the order's version advances exactly once
	 * per move and exactly one summary row describes each version. A patch that stated a version would
	 * be ignored — the conditional update decides the version, never the caller.
	 */
	patch?: Record<string, unknown>;

	/**
	 * The transaction the triggering move runs in, when its caller opened one.
	 *
	 * **This is what makes ADR-26's "inside the same transaction" expressible.** The ADR requires the order's
	 * derived columns to be "recomputed by a single function from the ledgers every time a transaction,
	 * fulfillment, return, claim or exchange changes, inside the same transaction". Without this the
	 * re-derivation could only ever be a second write after the move had committed — every read and write
	 * here went through this service's own injected repositories — so a failure between the two left the
	 * order's cached status stale until the nightly reconciliation noticed (handover §7.65 item 22).
	 *
	 * **The manager decides the ORM, as the outbox's does**, and it has to be the configured one:
	 *
	 * - a **TypeORM** manager — a `DataSource.transaction` callback's, or a query runner's — carries every
	 *   statement of the re-derivation: the order's read, every ledger read (lines, delivery choices, credit
	 *   lines, money ledger, adjustments, tax lines), the version-predicated update, the summary row, the
	 *   `order.*` outbox row and the final read. Nothing goes through an injected repository, which on
	 *   PostgreSQL and MySQL would be another pooled connection: reading outside the caller's transaction
	 *   derives the order from ledgers that do not yet hold the caller's move, and writing a row the
	 *   transaction has locked from another connection waits on it forever;
	 * - a **MikroORM** manager — the fork `em.transactional` hands its callback — is made the transaction
	 *   context the re-derivation runs in (`TransactionContext.create`), so every repository the platform holds
	 *   resolves to it, which is how MikroORM joins a transaction (`EntityManager.getContext` prefers the
	 *   transaction context over the request's).
	 *
	 * A manager of the other ORM is refused (`ORDER_RECOMPUTE_MANAGER_ORM_MISMATCH`): under MikroORM the
	 * TypeORM entity metadata carries the base columns only, and silently ignoring the manager would run the
	 * write outside the transaction the caller believes it is in. Omitted, nothing changes: every caller that
	 * opens no transaction runs exactly as it always did.
	 *
	 * **On MySQL the caller's transaction must be `READ COMMITTED`.** The order is read `FOR UPDATE`, but the
	 * ledgers are plain reads, and under MySQL's default `REPEATABLE READ` those come from the snapshot of the
	 * transaction's first plain read: a caller that waited for the order's lock would derive the status from
	 * ledgers that miss what the transaction it waited for committed (Greptile on #10555; reproduced on MySQL
	 * 8.0). `FulfillmentService.cancel` opens its transaction that way; PostgreSQL defaults to it.
	 */
	manager?: EntityManager | MikroOrmEntityManager;
}

/**
 * Where one re-derivation reads its order and its ledgers from.
 *
 * Two implementations, chosen per call: the injected services (the path every caller without a transaction
 * takes, unchanged), and a caller's TypeORM transaction (`IOrderRecalculation.manager`). They read the same
 * rows — the transaction reader scopes each ledger read by the order's own tenant and organization, which is
 * what the ledger rows carry — so the derivation cannot tell them apart, and only the connection changes.
 */
interface IOrderLedgerReader {
	order(orderId: ID): Promise<Order | null>;
	lines(order: Order): Promise<OrderLine[]>;
	shippingMethods(order: Order): Promise<OrderShippingMethod[]>;
	creditLines(order: Order): Promise<OrderCreditLine[]>;
	transactions(order: Order): Promise<OrderTransaction[]>;
	adjustments(order: Order, ownerType: AdjustmentOwnerType, ownerId: ID): Promise<Adjustment[]>;
	taxLines(order: Order, ownerType: TaxLineOwnerType, ownerId: ID): Promise<TaxLine[]>;
}

/** Where one re-derivation writes the order, its summary row and its event. */
interface IOrderTotalsWriter {
	/** The writer the version-predicated update runs through. */
	order: IVersionedWriter<Order>;
	/** The transaction the summary row and the outbox row join, when the caller opened one. */
	manager?: EntityManager;
}

/**
 * The order columns the reconciliation derives and compares.
 *
 * They are the columns `recompute` writes from the ledgers, less `promisedAt`, `sellerCount` and
 * `version`: the first is a policy answer rather than a derivation, the second is a count of sellers
 * a read answers afresh on every request, and the third is the write's own pointer. A column the
 * ledger does not determine has no expectation to compare against, and comparing one would mean
 * inventing a second definition of what the sweep is checking.
 */
export const ORDER_TOTALS_MONEY_COLUMNS = [
	'itemSubtotal',
	'itemDiscountTotal',
	'itemTaxTotal',
	'shippingSubtotal',
	'shippingDiscountTotal',
	'shippingTaxTotal',
	'discountTotal',
	'taxTotal',
	'grandTotal',
	'creditTotal',
	'paidTotal',
	'refundedTotal',
	'outstandingTotal'
] as const;

/** The two materialised statuses, compared as values rather than as amounts. */
const ORDER_TOTALS_STATUS_COLUMNS = ['paymentStatus', 'fulfillmentStatus'];

/**
 * How many orders the reconciliation reads at once, and how many candidate rows one page of the window
 * read returns.
 *
 * **Both are bounds the pass did not have.** It read every order row the window touched in full, then
 * every line and every transaction the window touched, all into memory, and then read the orders it had
 * collected with one `IN (...)` naming all of them — and every member of an `IN` list is a bound
 * parameter, which Postgres caps at 65,535 per statement. An installation that touched more orders than
 * that in a week had the read refused, the pass throw, and not one order examined or repaired, every
 * night. The window is now read a page of ids at a time, keyed on the row id, and the orders it names
 * are read and examined in slices of this size — so the statement is the same size on a quiet week and
 * a busy one.
 */
export const ORDER_TOTALS_AUDIT_BATCH_SIZE = 500;

/**
 * How many times one recomputation that states no version is attempted before its lost race is reported.
 *
 * A caller that states the wildcard has no stale state to protect: it asks for the order to be re-derived
 * from ledgers it has already moved, and the write is predicated on whatever version the row holds when the
 * write runs. Two such writes of one order at the same instant — a refund beside a receipt, a payment beside
 * a shipment — still race on that row between the version's read and the conditional update, and the loser
 * was answered `ENTITY_VERSION_CONFLICT` for a write that had nothing to conflict with. Each attempt reads the
 * order afresh and derives it again from the ledgers as they now stand, the winner's write included, so a
 * retry is a new derivation rather than a replay of the one that lost. Three attempts outlast any race short
 * of a sustained stampede on one order, which is what the nightly reconciliation repairs. A caller that also
 * retries on its own side — the fulfilment package does — multiplies the bound; it does not remove it.
 */
export const ORDER_RECOMPUTE_ATTEMPTS = 3;

/**
 * One order whose stored derived columns disagree with the ledgers they are derived from.
 *
 * It carries both sides rather than a verdict, because the reader of a drift report is deciding
 * whether the sweep's arithmetic or the writer that missed is the one at fault, and a report that
 * said only "this order drifted" would send them to the code to find out what the two values were.
 */
export interface IOrderTotalsDrift {
	/** The order that disagrees. */
	orderId: ID;
	/** The columns that disagree, in the order the sweep compares them. */
	columns: string[];
	/** What the order row holds, for those columns. */
	stored: Record<string, string>;
	/** What the ledgers derive, for those columns. */
	derived: Record<string, string>;
}

/** One order the sweep could not examine, and why. */
export interface IOrderTotalsAuditFailure {
	/** The order the derivation failed for. */
	orderId: ID;
	/** The failure, as one line. */
	message: string;
}

/**
 * What one reconciliation pass examined, found and repaired.
 *
 * `examined` is reported beside `drifted` because the two answer different questions: an empty drift
 * list over an empty window is not evidence of agreement, and a report that carried only the drift
 * would let a sweep that read nothing look like a sweep that found nothing wrong.
 */
export interface IOrderTotalsAuditReport {
	/** How far back the pass looked, in days. */
	windowDays: number;
	/** The instant the window opened at, as the query stated it. */
	since: string;
	/** How many orders the pass read. */
	examined: number;
	/** The orders that disagreed with their ledgers, examined rather than repaired. */
	drifted: IOrderTotalsDrift[];
	/** The orders the pass repaired, in the order it repaired them. */
	repaired: ID[];
	/** The orders the pass could not examine. */
	failed: IOrderTotalsAuditFailure[];
}

/**
 * What one order line contributes to its order's totals, as the totals function computes it.
 *
 * Every figure is exact decimal text. `subtotal` is the line's value net of any tax its price contained,
 * fees included and before discount; `discount` is a positive magnitude; `total` is
 * `subtotal - discount + tax`.
 */
export interface IOrderLineFigures {
	/** The line. */
	line: OrderLine;
	/** The line's quantity. */
	quantity: string;
	/** The price one unit was sold at, as the line's snapshot holds it. */
	unitPrice: string;
	subtotal: string;
	discount: string;
	tax: string;
	total: string;
}

/** What one delivery choice contributes to its order's totals, on the same terms as a line. */
export interface IOrderShippingFigures {
	/** The delivery choice. */
	method: OrderShippingMethod;
	/** The amount the choice was placed at. */
	amount: string;
	subtotal: string;
	discount: string;
	tax: string;
	total: string;
}

/** An order's totals, and the parts they are the sum of. */
export interface IOrderTotalsBreakdown {
	/** The order's totals, exactly as `computeTotals` answers them. */
	totals: IOrderTotals;
	/** One entry per line, in the order the lines were read. */
	lines: IOrderLineFigures[];
	/** One entry per delivery choice. */
	shippingMethods: IOrderShippingFigures[];
	/** The order's money totals as exact decimal text, column by column. */
	exactTotals: Record<(typeof ORDER_TOTALS_MONEY_COLUMNS)[number], string>;
}

/**
 * The only writer of an order's total columns.
 *
 * The chain itself is not implemented here: it is `TotalsCalculator` — one function, shared with the
 * cart, so a cart and the order it becomes cannot compute a total differently. What this service adds is
 * everything an order has and a cart does not: the credit lines, the money ledger, the two materialised
 * statuses, the version bump and the summary row that makes each version's totals answerable later.
 *
 * **The version bump is a version-predicated write.** The totals, the materialised statuses, the
 * columns the triggering move carries and the version are written by one `UPDATE … WHERE id = :id AND
 * version = :expected`, through `commitVersionedUpdate`, so the comparison and the increment cannot be
 * separated by another writer. The `order_summary` row is then written for the version that statement
 * returned, which is what keeps "one row per committed version, never skipped" true.
 *
 * Everything happens in one call and is meant to run inside the transaction of the write that triggered
 * it, so a reader never sees a total that disagrees with the lines it was computed from. A caller that opened
 * a transaction states it (`IOrderRecalculation.manager`) and every statement of the call joins it; a caller
 * that opened none gets the re-derivation as a write of its own after its move, which the nightly
 * reconciliation (`auditRecent`) is the safety net for.
 *
 * **The order's events leave from here too, for the same reason the summary row does.** The package's
 * README says observable changes are emitted through the core `event_outbox`, and this is the one
 * method that knows a lifecycle move actually committed: the conditional update either returned a
 * version or threw. A caller that published afterwards would announce placements the statement had
 * declined, and a caller that published over a bus rather than into the outbox would lose the event to
 * any crash between the commit and the publish — which is the failure the outbox exists to remove. The
 * move states the fact it announces in `options.event`; this method appends it beside the row.
 */
@Injectable()
export class OrderTotalsService {
	constructor(
		private readonly typeOrmOrderRepository: TypeOrmOrderRepository,
		private readonly lineService: OrderLineService,
		private readonly shippingMethodService: OrderShippingMethodService,
		private readonly creditLineService: OrderCreditLineService,
		private readonly transactionService: OrderTransactionService,
		private readonly summaryService: OrderSummaryService,
		private readonly adjustmentService: AdjustmentService,
		private readonly taxLineService: TaxLineService,
		private readonly outbox: EventOutboxService,
		private readonly moduleRef: ModuleRef,
		/**
		 * The persistence context each unit of a request-less pass runs in, and the answer to which ORM an
		 * order row is read through. Optional so a service constructed by hand behaves as it always did,
		 * which is the TypeORM behaviour; the module always supplies it.
		 */
		@Optional() private readonly unitOfWork?: OrderUnitOfWork
	) {}

	/**
	 * Recomputes an order's totals, statuses and version.
	 *
	 * **A write that states no version is retried when it loses the version race**, up to
	 * {@link ORDER_RECOMPUTE_ATTEMPTS} times, each attempt reading the order afresh. Two kinds of write are
	 * never retried, because each carries a decision made from the row as its caller read it and a fresh
	 * read would apply that decision to a row it was never checked against: a write predicated on a version
	 * the caller stated — its `If-Match` — and a write that carries a `patch`, which is a lifecycle move the
	 * state machine admitted from the status the caller read, or the order properties a change states. Both
	 * answer the conflict as they always did. What is retried is the re-derivation alone, which is what the
	 * returns flow, a payment, a fulfilment and a change's decision ask for; an attempt that lost wrote
	 * nothing — the conditional update refused it before the summary row and the event — so asking again is
	 * safe.
	 *
	 * @param orderId The order.
	 * @param reason Why the totals moved, recorded on the summary row: `PLACED`, `CHANGE_CONFIRMED`,
	 * `PAYMENT_RECONCILED`, `FULFILLMENT_COMMITTED`, `RETURN_RECEIVED`, `DRIFT_REPAIRED`, `CASH_ROUNDED`.
	 * @param options The version the caller read the order at, and the columns the move commits with
	 * the totals.
	 * @returns The order, as written.
	 * @throws ApiException with `ENTITY_VERSION_CONFLICT` when a stated version, or a move, lost the race,
	 * or when a re-derivation lost it on every attempt.
	 */
	public async recompute(orderId: ID, reason: string, options: IOrderRecalculation = {}): Promise<Order> {
		const { manager, ...rest } = options;

		if (manager) {
			const usesMikroOrm = this.unitOfWork?.usesMikroOrm === true;

			if (isMikroOrmManager(manager) !== usesMikroOrm) {
				throw new InternalServerErrorException(
					`ORDER_RECOMPUTE_MANAGER_ORM_MISMATCH: the order is re-derived through ${
						usesMikroOrm ? 'MikroORM' : 'TypeORM'
					}, and the transaction handed to it is not that ORM's.`
				);
			}

			if (isMikroOrmManager(manager)) {
				// MikroORM joins a transaction through its context: inside it every repository the platform
				// holds resolves to this fork, so the re-derivation below runs as it always does and lands in
				// the caller's transaction.
				return TransactionContext.create(manager, () => this.recompute(orderId, reason, rest));
			}
		}

		// What is left is a TypeORM transaction, or none.
		const transaction = manager as EntityManager | undefined;
		const reader = transaction ? this.transactionReader(transaction) : this.serviceReader();
		const writer: IOrderTotalsWriter = transaction
			? { order: this.transactionOrderWriter(transaction), manager: transaction }
			: { order: this.orderWriter() };
		const retried =
			(rest.expectation ?? ANY_ORDER_VERSION).wildcard === true && Object.keys(rest.patch ?? {}).length === 0;

		for (let attempt = 1; ; attempt++) {
			try {
				return await this.recomputeOnce(orderId, reason, rest, reader, writer);
			} catch (error) {
				if (!retried || attempt >= ORDER_RECOMPUTE_ATTEMPTS || !isVersionConflict(error)) {
					throw error;
				}
			}
		}
	}

	/**
	 * One attempt at {@link recompute}: a fresh read of the order, the derivation from its ledgers, and the
	 * one conditional write of the columns the derivation produced.
	 *
	 * @param orderId The order.
	 * @param reason Why the totals moved, recorded on the summary row.
	 * @param options The version the caller read the order at, and the columns the move commits with the
	 * totals.
	 * @param reader Where the order and its ledgers are read from.
	 * @param writer Where the order, its summary row and its event are written.
	 * @returns The order, as written.
	 */
	private async recomputeOnce(
		orderId: ID,
		reason: string,
		options: IOrderRecalculation,
		reader: IOrderLedgerReader,
		writer: IOrderTotalsWriter
	): Promise<Order> {
		const order = await reader.order(orderId);

		if (!order) {
			throw new NotFoundException(`ORDER_NOT_FOUND: no order exists with id ${orderId}.`);
		}

		// The row as the triggering move will leave it. The money and fulfilment states are derived from
		// the order's own status, so a placement or a cancellation has to be read through the columns it
		// is about to write rather than from the row as it still stands.
		const moved: Order = { ...order, ...(options.patch ?? {}) } as Order;
		const snapshot = this.totalsOf((await this.readTotalsContext(moved, reader)).context);
		const paymentStatus = await this.paymentStatusFrom(moved, snapshot, reader);
		const fulfillmentStatus = await this.fulfillmentStatusFrom(moved, reader);
		const promisedAt = await this.promisedDate(moved, reader);

		// `version` is deliberately absent: the conditional update writes the next version in the same
		// statement that checks the current one, and a patch that carried one would move the row past
		// the version the write was predicated on.
		//
		// The tenancy columns are stated as criteria rather than left to the service layer. A
		// conditional write whose criteria name only the row id is a write one identifier is the whole
		// key to, and the identifier travels — it is in a URL, a webhook payload, an exported report —
		// so the statement has to say whose row it is allowed to touch as well as which row. The values
		// come from the row this call just read, which is the same source `OrderReturnService` and
		// `FulfillmentService` take theirs from, and it is the only source available on the paths that
		// run with no request behind them: the checkout handler, a recurrence and the staleness sweep.
		const { version } = await commitVersionedUpdate<Order>(writer.order, {
			id: orderId,
			expectation: options.expectation ?? ANY_ORDER_VERSION,
			where: {
				...(order.tenantId ? { tenantId: order.tenantId } : {}),
				...(order.organizationId ? { organizationId: order.organizationId } : {})
			},
			patch: {
				...(options.patch ?? {}),
				itemSubtotal: snapshot.itemSubtotal,
				itemDiscountTotal: snapshot.itemDiscountTotal,
				itemTaxTotal: snapshot.itemTaxTotal,
				shippingSubtotal: snapshot.shippingSubtotal,
				shippingDiscountTotal: snapshot.shippingDiscountTotal,
				shippingTaxTotal: snapshot.shippingTaxTotal,
				discountTotal: snapshot.discountTotal,
				taxTotal: snapshot.taxTotal,
				grandTotal: snapshot.grandTotal,
				creditTotal: snapshot.creditTotal,
				paidTotal: snapshot.paidTotal,
				refundedTotal: snapshot.refundedTotal,
				outstandingTotal: snapshot.outstandingTotal,
				paymentStatus,
				fulfillmentStatus,
				sellerCount: await this.countSellers(moved, reader),
				promisedAt
			} as Record<string, unknown>
		});

		// One row per committed version, written in the same transaction as the columns it describes.
		// The row for the current version therefore equals the denormalised totals by construction —
		// unless a write bypassed this method, and that class is what the reconciliation catches: it
		// compares the columns against the ledgers they are derived from, which is the check a
		// summary-row comparison would only approximate.
		//
		// The row carries the order's own tenancy, read from the row this call just read, for the same
		// reason the conditional update above does: on the paths with no request behind them — the
		// reconciliation, the staleness sweep — the tenant-aware create had no caller to take a tenant
		// from, and wrote the summary of a repair with no tenant at all.
		await this.summaryService.append(
			{ orderId, version, totals: { ...snapshot }, currency: order.currency, reason },
			scopeOfOrderRow(order),
			writer.manager
		);

		if (options.event) {
			await this.announce(moved, version, snapshot, options.event, writer.manager);
		}

		return reader.order(orderId);
	}

	/**
	 * The reader every caller without a transaction uses: the injected services and repositories, exactly
	 * the calls this service has always made.
	 *
	 * @returns The reader.
	 */
	private serviceReader(): IOrderLedgerReader {
		const items = async <R>(read: Promise<unknown>): Promise<R[]> => ((await read) as IPagination<R>).items;

		return {
			order: (orderId) => this.readOrder(orderId),
			lines: (order) => items<OrderLine>(this.lineService.findAll({ where: { orderId: order.id } })),
			shippingMethods: (order) =>
				items<OrderShippingMethod>(this.shippingMethodService.findAll({ where: { orderId: order.id } })),
			creditLines: (order) =>
				items<OrderCreditLine>(this.creditLineService.findAll({ where: { orderId: order.id } })),
			transactions: (order) =>
				items<OrderTransaction>(this.transactionService.findAll({ where: { orderId: order.id } })),
			adjustments: (_order, ownerType, ownerId) => this.adjustmentService.findByOwner(ownerType, ownerId),
			taxLines: (_order, ownerType, ownerId) => this.taxLineService.findByOwner(ownerType, ownerId)
		};
	}

	/**
	 * The reader a caller's TypeORM transaction gives: every read through the transaction's own manager.
	 *
	 * The ledger reads are scoped by the order's own tenant — the criterion the tenant-aware services add inside
	 * a request, and the one every ledger row carries (the tenant-aware create stamps the tenant and not always
	 * the organization, so an organization criterion could miss a row the services find). The rows are keyed by
	 * the order or by an owner row of it, so the tenant is a guard rather than the selector. The order itself is
	 * read by id, as {@link readOrder} reads it, and the two ledgers keyed by owner are ordered as their
	 * services order them.
	 *
	 * @param manager The caller's transaction.
	 * @returns The reader.
	 */
	private transactionReader(manager: EntityManager): IOrderLedgerReader {
		const scope = (order: Order): Record<string, unknown> => (order.tenantId ? { tenantId: order.tenantId } : {});
		const ownerOrder = { createdAt: 'ASC', id: 'ASC' } as const;

		// The order is read under a row lock where the dialect has one (see `rowLockOf`): it is the row this
		// re-derivation writes, and a retry after a lost race has to see the version that won.
		const locked = rowLockOf(manager);

		return {
			order: (orderId) => manager.getRepository(Order).findOne({ where: { id: orderId }, ...locked } as never),
			lines: (order) =>
				manager.getRepository(OrderLine).find({ where: { orderId: order.id, ...scope(order) } as never }),
			shippingMethods: (order) =>
				manager
					.getRepository(OrderShippingMethod)
					.find({ where: { orderId: order.id, ...scope(order) } as never }),
			creditLines: (order) =>
				manager.getRepository(OrderCreditLine).find({ where: { orderId: order.id, ...scope(order) } as never }),
			transactions: (order) =>
				manager.getRepository(OrderTransaction).find({ where: { orderId: order.id, ...scope(order) } as never }),
			adjustments: (order, ownerType, ownerId) =>
				manager
					.getRepository(Adjustment)
					.find({ where: { ownerType, ownerId, ...scope(order) } as never, order: ownerOrder as never }),
			taxLines: (order, ownerType, ownerId) =>
				manager
					.getRepository(TaxLine)
					.find({ where: { ownerType, ownerId, ...scope(order) } as never, order: ownerOrder as never })
		};
	}

	/**
	 * The order's versioned writer inside a caller's TypeORM transaction.
	 *
	 * It is the two members `commitVersionedUpdate` uses, run on the transaction's manager: the update by
	 * criteria answers the affected-row count the conflict decision is read from, and the read by id answers
	 * `NotFoundException` for an order that is not there, as the CRUD service's read does. The criteria are the
	 * ones the kernel builds — the id, the version it is predicated on, the caller's scope and the order's own
	 * tenancy — so the statement is the one the service would have run, on the caller's connection.
	 *
	 * @param manager The caller's transaction.
	 * @returns The writer.
	 */
	private transactionOrderWriter(manager: EntityManager): IVersionedWriter<Order> {
		const orders = manager.getRepository(Order);

		const locked = rowLockOf(manager);

		return {
			update: (criteria, patch) => orders.update(criteria as never, patch as never),
			findOneByIdString: async (id) => {
				const order = await orders.findOne({ where: { id }, ...locked } as never);

				if (!order) {
					throw new NotFoundException(`ORDER_NOT_FOUND: no order exists with id ${id}.`);
				}

				return order;
			}
		} as IVersionedWriter<Order>;
	}

	/**
	 * Examines the orders the last window touched, reports every disagreement it finds and repairs it.
	 *
	 * **This is the compensating measure for a materialised column, and ADR-26 names it as such.** The
	 * contract the ADR states is that `paymentStatus` and `fulfillmentStatus` are recomputed by one
	 * function every time a transaction, fulfilment, return, claim or exchange changes — and the
	 * contract it states beside that is this job, which exists because the first half is an obligation
	 * every writer has to keep rather than something the schema can enforce. A writer that forgets
	 * leaves a status that disagrees with the ledgers it is derived from, nothing errors, and every
	 * read of the order reports it as fact. This is what turns that class of failure from a latent
	 * defect into a measured one.
	 *
	 * **The comparison is derived-from-the-ledgers against stored-on-the-row, and the derivation is the
	 * same one a write performs.** `computeTotals`, `derivePaymentStatus` and `deriveFulfillmentStatus`
	 * are the functions `recompute` calls, and this method calls them without writing: the expected
	 * values are computed from the rows the order's own ledgers hold, compared against the columns the
	 * order carries, and only an order that disagrees is written. **A sweep that recomputed every order
	 * it read would be a different and worse job**: `recompute` bumps `order.version` and appends a
	 * summary row, so a nightly pass over a week of orders would spend a version and a history row per
	 * order per night to write the values those orders already hold — and the version is a public
	 * concurrency token, so every client holding an `ETag` would see every recent order move while
	 * nothing about it changed.
	 *
	 * **`promisedAt` is deliberately not compared.** The ADR names the two statuses and the totals, and
	 * the promise date is a policy answer — the lead time a warehouse's calendar gives — rather than a
	 * derivation from a ledger: a disagreement there is a configuration change, not a missed write.
	 *
	 * **One order's failure does not end the sweep.** A row the derivation cannot be computed for is
	 * recorded and the pass continues, because a sweep that stops at the first bad row leaves every
	 * order after it unexamined for as long as that row exists — and the failing row is reported rather
	 * than swallowed, which is the whole reason the report has a `failed` list.
	 *
	 * The read carries no tenant criterion, deliberately: this runs with no request behind it, over
	 * every tenant, which is the same position `recompute` is written for — the tenancy columns of each
	 * order's own write are read from the row rather than from a context. The core CRUD service leaves
	 * a filter untouched when there is no current user, so an unscoped read here is the platform's own
	 * behaviour on a request-less path rather than a criterion this service had to defeat.
	 *
	 * **It is bounded, and each order runs in a persistence context of its own.** The window is read a
	 * page of ids at a time and the orders it names are read in slices of `batchSize`, so no statement's
	 * size depends on how busy the week was (see {@link ORDER_TOTALS_AUDIT_BATCH_SIZE}); and each read and
	 * each order's examination and repair runs through {@link OrderUnitOfWork}, which under MikroORM is
	 * what lets the pass run at all outside a request — and what keeps a repair that failed from being
	 * flushed again with the next order.
	 *
	 * @param windowDays How far back to look. Defaults to the ADR's window.
	 * @param batchSize How many orders are read at once, and how many candidate rows one page returns.
	 * @returns What the pass examined, what it found, what it repaired and what it could not examine.
	 */
	public async auditRecent(
		windowDays: number = ORDER_TOTALS_AUDIT_WINDOW_DAYS,
		batchSize: number = ORDER_TOTALS_AUDIT_BATCH_SIZE
	): Promise<IOrderTotalsAuditReport> {
		const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
		const candidates = await inOwnUnitOfWork(this.unitOfWork, () => this.candidateOrderIds(since, batchSize));
		const drifted: IOrderTotalsDrift[] = [];
		const repaired: ID[] = [];
		const failed: IOrderTotalsAuditFailure[] = [];
		let examined = 0;

		for (const slice of chunk(candidates, batchSize)) {
			const orders = await inOwnUnitOfWork(this.unitOfWork, () => this.readOrders(slice));

			for (const order of orders) {
				examined++;

				try {
					await inOwnUnitOfWork(this.unitOfWork, async () => {
						const drift = await this.detectDrift(order);

						if (!drift) {
							return;
						}

						drifted.push(drift);

						await this.recompute(order.id, ORDER_TOTALS_RECONCILED_REASON);
						repaired.push(order.id);
					});
				} catch (error) {
					failed.push({ orderId: order.id, message: describe(error) });
				}
			}
		}

		return { windowDays, since: since.toISOString(), examined, drifted, repaired, failed };
	}

	/**
	 * The orders the window touched, read from the ledgers that move them rather than from the order row.
	 *
	 * **This is the difference between a sweep that finds drift and one that finds only agreement, and
	 * the first draft of this method had it wrong.** The failure ADR-26 exists to catch is a writer
	 * that moved a ledger and did not recompute the order — or recomputed it and failed — and in both
	 * cases **the order row is the one row the move did not write**: its `updatedAt` still says when the
	 * last *successful* write happened, so a window over that column selects the orders that were
	 * recomputed and misses precisely the ones that were not. An order placed three weeks ago and
	 * shipped this morning, with a re-derivation that failed in between, is exactly the case, and an
	 * `order.updatedAt` window never looks at it.
	 *
	 * So the candidates are the orders whose *ledgers* moved: an order whose own row was written in the
	 * window, an order with a line written in the window, and an order with a transaction that occurred
	 * in it. **The three together are the five writers the ADR names.** A fulfilment, a return, a claim
	 * and an exchange all move an `order_line` counter — the line is where "how much of this actually
	 * left the building, came back or was written off" is recorded — and a payment moves an
	 * `order_transaction`; the order row's own window is kept as well, because a write that changed only
	 * the totals still has to be checked against the ledgers it was derived from.
	 *
	 * **Each source is read for the order reference alone, a page at a time.** The sweep derives each
	 * order in full later, so a row's other columns would be read to be discarded — and the reference
	 * is projected the way the configured ORM can answer it. Under TypeORM that is the `orderId` column.
	 * Under MikroORM it is **not**: `orderId` is the relation's id (`relationId: true`), which the kernel
	 * maps `persist: false`, and MikroORM drops a non-persistent property from a projection — so a read
	 * that asked for `orderId` came back with the primary key alone, every line and transaction
	 * contributed nothing, and the pass examined only the orders whose own row moved, which is exactly
	 * the case it exists to go beyond. On that ORM the `order` relation is projected instead, which
	 * selects the foreign key and answers the order's id.
	 *
	 * @param since The instant the window opens at.
	 * @param pageSize How many rows one page of a source returns.
	 * @returns The distinct orders to examine.
	 */
	private async candidateOrderIds(since: Date, pageSize: number): Promise<ID[]> {
		const ids = new Set<ID>();
		const window = (column: string, after: ID | undefined) => ({
			[column]: MoreThanOrEqual(since),
			...(after ? { id: MoreThan(after) } : {})
		});
		const orderReference = this.unitOfWork?.usesMikroOrm ? { id: true, order: true } : { id: true, orderId: true };

		await collectPaged<Order>(
			(after, take) =>
				this.readOrderRows({
					where: window('updatedAt', after),
					select: { id: true },
					order: { id: 'ASC' },
					take
				}),
			(row) => row.id,
			ids,
			pageSize
		);
		await collectPaged<OrderLine>(
			(after, take) =>
				this.lineService.find({
					where: window('updatedAt', after),
					select: orderReference,
					order: { id: 'ASC' },
					take
				} as FindManyOptions<OrderLine>),
			orderIdOf,
			ids,
			pageSize
		);
		await collectPaged<OrderTransaction>(
			(after, take) =>
				this.transactionService.find({
					where: window('occurredAt', after),
					select: orderReference,
					order: { id: 'ASC' },
					take
				} as FindManyOptions<OrderTransaction>),
			orderIdOf,
			ids,
			pageSize
		);

		return [...ids];
	}

	/**
	 * Reads one order row whole, through the ORM the installation runs on.
	 *
	 * Under TypeORM that is the order repository, as it always was. Under MikroORM it is **not**: both
	 * connections are opened, but the kernel's column decorators apply one ORM's decorator, so the
	 * TypeORM entity for `order` carries its base columns and nothing else — a row read through it has
	 * no status, no currency and no tenant, and a derivation from it would compute every status from an
	 * order that is in none. The order's own service reads through the configured ORM.
	 *
	 * @param orderId The order.
	 * @returns The row, or `null` when there is none.
	 */
	private async readOrder(orderId: ID): Promise<Order | null> {
		const [order] = await this.readOrderRows({ where: { id: orderId }, take: 1 });

		return order ?? null;
	}

	/**
	 * Reads a slice of orders whole, oldest write first.
	 *
	 * @param orderIds The orders, at most one slice of them.
	 * @returns The rows that exist.
	 */
	private async readOrders(orderIds: ID[]): Promise<Order[]> {
		if (orderIds.length === 0) {
			return [];
		}

		return this.readOrderRows({ where: { id: In(orderIds) }, order: { updatedAt: 'ASC' } });
	}

	/**
	 * Runs one read of the order table through the ORM the installation runs on.
	 *
	 * A single-row read goes through `findOne` on the TypeORM path, which is the call this service has
	 * always made there.
	 *
	 * @param options The read, in the platform's find-options vocabulary.
	 * @returns The rows.
	 */
	private async readOrderRows(options: FindManyOptions<Order>): Promise<Order[]> {
		if (this.unitOfWork?.usesMikroOrm) {
			return this.orderWriter().find(options as never);
		}

		if (options.take === 1 && !options.order && !options.select) {
			const order = await this.typeOrmOrderRepository.findOne({ where: options.where });

			return order ? [order] : [];
		}

		return this.typeOrmOrderRepository.find(options);
	}

	/**
	 * Reports how an order's stored derived columns disagree with the ledgers they are derived from.
	 *
	 * The two materialised statuses are compared as the values they are, and the money columns are
	 * compared through the platform's exact-decimal comparison rather than as numbers: `10.000000` and
	 * `10` are the same amount, and a reconciliation that reported them as drift would report every
	 * order whose totals were read back at a different scale.
	 *
	 * @param order The order to examine, as the row holds it.
	 * @returns The disagreement, or `null` when the row agrees with its ledgers.
	 */
	private async detectDrift(order: Order): Promise<IOrderTotalsDrift | null> {
		const snapshot = await this.computeTotals(order);
		const paymentStatus = await this.derivePaymentStatus(order, snapshot);
		const fulfillmentStatus = await this.deriveFulfillmentStatus(order);

		const derived: Record<string, string> = {
			paymentStatus: String(paymentStatus),
			fulfillmentStatus: String(fulfillmentStatus)
		};

		for (const column of ORDER_TOTALS_MONEY_COLUMNS) {
			derived[column] = amountOf((snapshot as unknown as Record<string, unknown>)[column]);
		}

		const columns = Object.keys(derived).filter((column) => {
			const stored = amountOf((order as unknown as Record<string, unknown>)[column]);

			return (ORDER_TOTALS_STATUS_COLUMNS as string[]).includes(column)
				? stored !== derived[column]
				: compareDecimalStrings(stored, derived[column]) !== 0;
		});

		if (columns.length === 0) {
			return null;
		}

		const stored: Record<string, string> = {};

		for (const column of columns) {
			stored[column] = amountOf((order as unknown as Record<string, unknown>)[column]);
		}

		return {
			orderId: order.id,
			columns,
			stored,
			derived: Object.fromEntries(columns.map((column) => [column, derived[column]]))
		};
	}

	/**
	 * Appends one `order.*` event to the platform outbox.
	 *
	 * **The append rides the write, and that is the whole point of the outbox.** An event published
	 * after a commit is an event a crash between the two loses, and nothing afterwards knows it is
	 * missing; an event written as a row beside the state change is delivered by the dispatcher
	 * whenever the process comes back. It is appended through the order repository's own entity
	 * manager — the manager the conditional update and the summary row were written through — and only
	 * after that update returned, so an event is never produced for a write the version predicate
	 * refused: that refusal throws before this line is reached.
	 *
	 * The projection carries the order's identity, the version the write produced and the two
	 * materialised statuses, because those are what a consumer routes on — a search index reindexes,
	 * a notification decides whether to send, a webhook subscriber filters. It deliberately does not
	 * carry the order row: an event that shipped the entity would freeze its shape into every
	 * consumer.
	 *
	 * **The row is written through the ORM the installation runs on.** Under `DB_ORM=mikro-orm` the TypeORM
	 * entity for `event_outbox` carries its base columns and nothing else — `@MultiORMColumn` registers the
	 * active ORM's decorator alone — so an append through the TypeORM manager wrote a row with no event id, no
	 * name and no sequence, the database refused it, and every move that announces itself failed after the
	 * order's own write had committed. The platform's `append` takes either ORM's manager, so under MikroORM it
	 * is handed the MikroORM manager, which it resolves to the persistence context the move runs in — a
	 * request's fork, or the unit a request-less pass opened (`OrderUnitOfWork`) — and writes the row there,
	 * with the same partition, sequence and tenancy.
	 *
	 * @param order The order as the move left it.
	 * @param version The version the conditional update produced.
	 * @param snapshot The totals written with it.
	 * @param event The fact to announce.
	 * @param manager The caller's TypeORM transaction, when the re-derivation runs inside one; the row then
	 * joins it like every other statement of the re-derivation.
	 */
	private async announce(
		order: Order,
		version: number,
		snapshot: IOrderTotals,
		event: IOrderEvent,
		manager?: EntityManager
	): Promise<void> {
		const input: IOutboxWriteInput = {
			name: event.name,
			aggregateType: ORDER_AGGREGATE_TYPE,
			aggregateId: order.id,
			data: {
				orderId: order.id,
				number: order.number,
				status: order.status,
				paymentStatus: order.paymentStatus,
				fulfillmentStatus: order.fulfillmentStatus,
				currency: order.currency,
				grandTotal: this.decimalOf(snapshot.grandTotal),
				outstandingTotal: this.decimalOf(snapshot.outstandingTotal ?? 0),
				channelId: order.channelId ?? null,
				customerId: order.customerId ?? null,
				version,
				...(event.data ?? {})
			},
			tenantId: order.tenantId,
			organizationId: order.organizationId
		};

		await this.outbox.append(
			manager ??
				(this.unitOfWork?.usesMikroOrm
					? this.outbox.mikroOrmEventOutboxRepository.getEntityManager()
					: this.typeOrmOrderRepository.manager),
			input
		);
	}

	/**
	 * The service that owns the order row.
	 *
	 * Resolved when a write runs rather than injected: `OrderService` is constructed *from* this
	 * service and calls it for every move it makes, so an injected dependency would close a cycle the
	 * container cannot express. The token is registered by the order module and aliases the order
	 * service — the same late lookup the concurrency kernel's own guard performs for the service a
	 * route names. A missing registration is reported rather than absorbed, because a write that
	 * silently stopped being version-predicated would leave every caller believing it was.
	 *
	 * @returns The order aggregate's service.
	 */
	private orderWriter(): CrudService<Order> {
		const writer = this.moduleRef?.get<CrudService<Order>>(ORDER_AGGREGATE_WRITER, { strict: false });

		if (!writer || typeof writer.update !== 'function' || typeof writer.findOneByIdString !== 'function') {
			throw new InternalServerErrorException(
				'ORDER_WRITER_UNAVAILABLE: the order aggregate has no versioned writer registered.'
			);
		}

		return writer;
	}

	/**
	 * Computes an order's totals without writing anything.
	 *
	 * The calculator marks the four order-only totals optional, because a cart runs neither the credit
	 * lines nor the money ledger step and has no such totals. An order always runs both, so they are
	 * stated here rather than left for every reader to narrow.
	 *
	 * @param order The order.
	 * @returns The computed totals, including the order-only tail.
	 */
	public async computeTotals(order: Order): Promise<IOrderTotals> {
		const { context } = await this.readTotalsContext(order, this.serviceReader());

		return this.totalsOf(context);
	}

	/**
	 * Computes an order's totals and what each line and each delivery choice contributes to them, without
	 * writing anything.
	 *
	 * **The parts are computed by the one totals function, one owner at a time.** The calculator rounds each
	 * line's value at the line and sums already-rounded components, so running it over one line and that
	 * line's own ledger rows yields exactly that line's share of the order's figures — and the shares then
	 * add up to the order's totals by construction rather than by apportioning a total after the fact,
	 * which is where a cent goes missing. The sum is still checked rather than assumed: a document that
	 * bills the parts of an order has to bill the order, and a breakdown that does not add up is refused
	 * here instead of being written into an accounting document.
	 *
	 * Every figure is exact decimal text.
	 *
	 * @param order The order.
	 * @returns The order's totals, and the figures of each line and each delivery choice.
	 * @throws InternalServerErrorException with `ORDER_TOTALS_BREAKDOWN_UNSETTLED` when the parts do not
	 * sum to the totals.
	 */
	public async computeBreakdown(order: Order): Promise<IOrderTotalsBreakdown> {
		const { lines, shippingMethods, context } = await this.readTotalsContext(order, this.serviceReader());
		const totals = this.totalsOf(context);
		const alone = (part: Partial<ITotalsContext>): ITotalsSnapshot =>
			TotalsCalculator.compute({
				currency: context.currency,
				currencyDecimals: context.currencyDecimals,
				lines: [],
				shippingMethods: [],
				lineAdjustments: [],
				shippingAdjustments: [],
				lineTaxLines: [],
				shippingTaxLines: [],
				...part
			});
		const figures = (subtotal: unknown, discount: unknown, tax: unknown) => {
			const exact = {
				subtotal: this.decimalOf(subtotal),
				discount: this.decimalOf(discount),
				tax: this.decimalOf(tax)
			};
			const net = subtractDecimalStrings(exact.subtotal, exact.discount);

			return { ...exact, total: normalizeDecimalString(addDecimalStrings(net, exact.tax)) };
		};
		const ownedBy = <R extends { ownerId: string }>(rows: R[], ownerId: string): R[] =>
			rows.filter((row) => row.ownerId === ownerId);

		const lineFigures = lines.map((line) => {
			const part = alone({
				lines: context.lines.filter((candidate) => candidate.id === line.id),
				lineAdjustments: ownedBy(context.lineAdjustments, line.id),
				lineTaxLines: ownedBy(context.lineTaxLines, line.id)
			});

			return {
				line,
				quantity: this.decimalOf(line.quantity ?? 0),
				unitPrice: this.decimalOf(line.unitPrice ?? 0),
				...figures(part.itemSubtotal, part.itemDiscountTotal, part.itemTaxTotal)
			};
		});
		const shippingFigures = shippingMethods.map((method) => {
			const part = alone({
				shippingMethods: context.shippingMethods.filter((candidate) => candidate.id === method.id),
				shippingAdjustments: ownedBy(context.shippingAdjustments, method.id),
				shippingTaxLines: ownedBy(context.shippingTaxLines, method.id)
			});

			return {
				method,
				amount: this.decimalOf(method.amount ?? 0),
				...figures(part.shippingSubtotal, part.shippingDiscountTotal, part.shippingTaxTotal)
			};
		});

		const sum = (values: string[]): string =>
			values.reduce<string>((total, value) => addDecimalStrings(total, value), '0');
		const unsettled = [
			['itemSubtotal', sum(lineFigures.map((part) => part.subtotal)), totals.itemSubtotal],
			['itemDiscountTotal', sum(lineFigures.map((part) => part.discount)), totals.itemDiscountTotal],
			['itemTaxTotal', sum(lineFigures.map((part) => part.tax)), totals.itemTaxTotal],
			['shippingSubtotal', sum(shippingFigures.map((part) => part.subtotal)), totals.shippingSubtotal],
			['shippingDiscountTotal', sum(shippingFigures.map((part) => part.discount)), totals.shippingDiscountTotal],
			['shippingTaxTotal', sum(shippingFigures.map((part) => part.tax)), totals.shippingTaxTotal]
		].filter(([, parts, total]) => compareDecimalStrings(parts as string, this.decimalOf(total)) !== 0);

		if (unsettled.length) {
			const stated = unsettled.map(([column, parts, total]) => `${column}: ${parts} ≠ ${this.decimalOf(total)}`);

			throw new InternalServerErrorException(
				`ORDER_TOTALS_BREAKDOWN_UNSETTLED: the parts of order ${order.id} do not sum to its totals ` +
					`(${stated.join('; ')}).`
			);
		}

		const columns = totals as unknown as Record<string, unknown>;
		const exactTotals = Object.fromEntries(
			ORDER_TOTALS_MONEY_COLUMNS.map((column) => [column, this.decimalOf(columns[column] ?? 0)])
		) as IOrderTotalsBreakdown['exactTotals'];

		return { totals, lines: lineFigures, shippingMethods: shippingFigures, exactTotals };
	}

	/**
	 * The one call the calculator is answered with for an order, and the order-only tail it marks optional.
	 *
	 * @param context What the chain reads.
	 * @returns The computed totals, including the order-only tail.
	 */
	private totalsOf(context: ITotalsContext): IOrderTotals {
		const snapshot = TotalsCalculator.compute(context);

		return {
			...snapshot,
			creditTotal: snapshot.creditTotal ?? 0,
			paidTotal: snapshot.paidTotal ?? 0,
			refundedTotal: snapshot.refundedTotal ?? 0,
			outstandingTotal: snapshot.outstandingTotal ?? 0
		};
	}

	/**
	 * Reads what an order's totals are computed from — its lines, its delivery choices, their ledger rows,
	 * its credit lines and its money ledger — and states it as the calculator's context.
	 *
	 * @param order The order.
	 * @param reader Where the rows are read from.
	 * @returns The rows read, and the context built from them.
	 */
	private async readTotalsContext(
		order: Order,
		reader: IOrderLedgerReader
	): Promise<{ lines: OrderLine[]; shippingMethods: OrderShippingMethod[]; context: ITotalsContext }> {
		const lines = await reader.lines(order);
		const shippingMethods = await reader.shippingMethods(order);
		const creditLines = await reader.creditLines(order);
		const transactions = await reader.transactions(order);

		const lineAdjustments: ITotalsAdjustment[] = [];
		const shippingAdjustments: ITotalsAdjustment[] = [];
		const lineTaxLines: ITotalsTaxLine[] = [];
		const shippingTaxLines: ITotalsTaxLine[] = [];

		for (const line of lines) {
			for (const adjustment of await reader.adjustments(order, AdjustmentOwnerType.ORDER_LINE, line.id)) {
				lineAdjustments.push({
					ownerId: line.id,
					amount: Number(adjustment.amount),
					isTaxInclusive: Boolean(adjustment.isTaxInclusive),
					netAmount: this.netAmountOf(adjustment.metadata)
				});
			}

			for (const taxLine of await reader.taxLines(order, TaxLineOwnerType.ORDER_LINE, line.id)) {
				lineTaxLines.push({ ownerId: line.id, amount: Number(taxLine.amount) });
			}
		}

		for (const method of shippingMethods) {
			for (const adjustment of await reader.adjustments(order, AdjustmentOwnerType.ORDER_SHIPPING, method.id)) {
				shippingAdjustments.push({
					ownerId: method.id,
					amount: Number(adjustment.amount),
					isTaxInclusive: Boolean(adjustment.isTaxInclusive),
					netAmount: this.netAmountOf(adjustment.metadata)
				});
			}

			for (const taxLine of await reader.taxLines(order, TaxLineOwnerType.ORDER_SHIPPING, method.id)) {
				shippingTaxLines.push({ ownerId: method.id, amount: Number(taxLine.amount) });
			}
		}

		// The order-level ledger: `AdjustmentOwnerType.ORDER` is "the order-level counterpart of `CART`" — an
		// order-wide discount, a fee, a rounding correction. A checkout now carries the cart's document rows
		// onto it (Q7-W1a), and a row that is written and then read by nothing is a discount the buyer was
		// quoted and the order forgot, which is exactly the defect the cart's own chain had before it read
		// its `CART` rows. Nothing wrote an `ORDER` row before the carry-over, so no existing order moves.
		const documentAdjustments: ITotalsAdjustment[] = (
			(await reader.adjustments(order, AdjustmentOwnerType.ORDER, order.id)) ?? []
		).map((adjustment) => ({
			ownerId: order.id,
			amount: Number(adjustment.amount),
			isTaxInclusive: Boolean(adjustment.isTaxInclusive),
			netAmount: this.netAmountOf(adjustment.metadata)
		}));

		const context: ITotalsContext = {
			currency: order.currency,
			currencyDecimals: order.currencyDecimals ?? 2,
			lines: lines.map((line) => ({
				id: line.id,
				quantity: Number(line.quantity),
				unitPrice: Number(line.unitPrice),
				isTaxInclusive: Boolean(line.isTaxInclusive)
			})),
			shippingMethods: shippingMethods.map((method) => ({
				id: method.id,
				amount: Number(method.amount),
				isTaxInclusive: Boolean(method.isTaxInclusive)
			})),
			lineAdjustments,
			shippingAdjustments,
			documentAdjustments,
			lineTaxLines,
			shippingTaxLines,
			creditLines: creditLines.map((creditLine) => Number(creditLine.amount)),
			transactions: transactions.map((transaction) => ({
				amount: Number(transaction.amount),
				type: transaction.type as string
			}))
		};

		return { lines, shippingMethods, context };
	}

	/**
	 * Derives the money state from the order's own ledger.
	 *
	 * **The ledger is summed on the digits, not with `+`.** The state machine compares exactly, but a
	 * comparison can only be as exact as what it is handed, and every member below but `payable` is a
	 * running sum over the order's transaction rows. Accumulated in binary floating point, an order
	 * whose grand total is `0.80` and which was captured by two transactions of `0.10` and `0.70`
	 * produces `0.7999999999999999`, which compares below `0.80`: the fully captured order is stamped
	 * `PARTIALLY_CAPTURED`, and because `PARTIALLY_CAPTURED` is not one of the statuses a confirmation
	 * admits, a fully paid order can then never be confirmed or completed. The accumulation therefore
	 * runs through the platform's decimal kernel and the two aggregate members are combined with
	 * `addDecimalStrings` rather than with `+`; the state machine accepts the digits as digits.
	 *
	 * @param order The order.
	 * @param snapshot The totals just computed, whose `grandTotal` and `creditTotal` the derivation needs.
	 * @returns The payment status.
	 */
	public async derivePaymentStatus(order: Order, snapshot: ITotalsSnapshot): Promise<OrderPaymentStatus> {
		return this.paymentStatusFrom(order, snapshot, this.serviceReader());
	}

	/**
	 * {@link derivePaymentStatus}, reading the money ledger from the reader it is handed.
	 *
	 * @param order The order.
	 * @param snapshot The totals just computed.
	 * @param reader Where the ledger is read from.
	 * @returns The payment status.
	 */
	private async paymentStatusFrom(
		order: Order,
		snapshot: ITotalsSnapshot,
		reader: IOrderLedgerReader
	): Promise<OrderPaymentStatus> {
		const transactions = await reader.transactions(order);

		const sumOf = (types: OrderTransactionType[], positive: boolean): string =>
			transactions
				.filter((transaction) => types.includes(transaction.type))
				.map((transaction) => this.decimalOf(transaction.amount))
				.filter((amount) =>
					positive ? compareDecimalStrings(amount, '0') > 0 : compareDecimalStrings(amount, '0') < 0
				)
				.reduce((total, amount) => addDecimalStrings(total, this.absolute(amount)), '0');

		return OrderStateMachine.derivePaymentStatus({
			orderStatus: order.status,
			grandTotal: this.decimalOf(snapshot.grandTotal),
			creditTotal: this.decimalOf(snapshot.creditTotal ?? 0),
			authorized: sumOf([OrderTransactionType.AUTHORIZATION], true),
			voided: sumOf([OrderTransactionType.VOID], true),
			captured: addDecimalStrings(
				sumOf([OrderTransactionType.CAPTURE], true),
				sumOf([OrderTransactionType.MANUAL], true)
			),
			refunded: addDecimalStrings(
				addDecimalStrings(
					sumOf([OrderTransactionType.REFUND], false),
					sumOf([OrderTransactionType.CHARGEBACK], false)
				),
				sumOf([OrderTransactionType.MANUAL], false)
			),
			hasRequiresMoreSession: false,
			hasPendingSession: false,
			hasFailedAttempt: transactions.some((transaction) => transaction.metadata?.['status'] === 'FAILED'),
			hasTransactions: transactions.length > 0
		});
	}

	/**
	 * Derives the fulfilment state from the order's lines.
	 *
	 * The per-line counters are totalled on their digits for the same reason the ledger above is: a
	 * `numeric(20,6)` quantity summed with `+` lands beside the value it should be, and the derivation
	 * it feeds tests a difference for being *exactly* zero — the one test a floating point sum can never
	 * pass.
	 *
	 * @param order The order.
	 * @returns The fulfilment status.
	 */
	public async deriveFulfillmentStatus(order: Order): Promise<FulfillmentStatus> {
		return this.fulfillmentStatusFrom(order, this.serviceReader());
	}

	/**
	 * {@link deriveFulfillmentStatus}, reading the lines from the reader it is handed.
	 *
	 * @param order The order.
	 * @param reader Where the lines are read from.
	 * @returns The fulfilment status.
	 */
	private async fulfillmentStatusFrom(order: Order, reader: IOrderLedgerReader): Promise<FulfillmentStatus> {
		const lines = await reader.lines(order);

		const total = (field: keyof OrderLine): string =>
			lines.reduce<string>((sum, line) => addDecimalStrings(sum, this.decimalOf(line[field] ?? 0)), '0');

		return OrderStateMachine.deriveFulfillmentStatus({
			orderStatus: order.status,
			orderedQuantity: total('quantity'),
			writtenOffQuantity: total('writtenOffQuantity'),
			dismissedQuantity: total('returnDismissedQuantity'),
			fulfilledQuantity: total('fulfilledQuantity'),
			receivedReturnQuantity: total('returnReceivedQuantity')
		});
	}

	/**
	 * One stored figure as the decimal text it is summed and compared as.
	 *
	 * The column is a `numeric(20,6)` and the transformer hands it back as a `number`, so this is where
	 * the digits are recovered: a `number` is rendered in its shortest round-trip form, and an
	 * exponential rendering — `String(1e-7)` is `'1e-7'`, which the decimal kernel refuses rather than
	 * guesses at — is laid out in full so that a very small credit does not escape a totals
	 * recomputation as a `MONEY_NOT_DECIMAL_STRING` server fault. A value that already arrives as text
	 * is passed through untouched, because re-rendering it through a double is exactly the step that
	 * loses it.
	 *
	 * @param value The figure, as a column or a calculator handed it over.
	 * @returns The figure as exact decimal text.
	 */
	private decimalOf(value: unknown): string {
		if (typeof value === 'string') {
			const text = value.trim();

			return text === '' ? '0' : this.expandExponential(text);
		}

		if (typeof value === 'number') {
			return Number.isFinite(value) ? this.expandExponential(String(value)) : '0';
		}

		if (value === null || value === undefined) {
			return '0';
		}

		return this.decimalOf(String(value));
	}

	/**
	 * @param text A decimal rendering, possibly in exponential form.
	 * @returns The same value written as plain decimal digits, which is the only form the decimal
	 * kernel parses.
	 */
	private expandExponential(text: string): string {
		const match = /^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(text);

		if (!match) {
			return text;
		}

		const [, sign, whole, fraction = '', exponentText] = match;
		const digits = `${whole}${fraction}`;
		const point = whole.length + Number(exponentText);

		if (point <= 0) {
			return `${sign}0.${'0'.repeat(-point)}${digits}`;
		}

		if (point >= digits.length) {
			return `${sign}${digits}${'0'.repeat(point - digits.length)}`;
		}

		return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
	}

	/**
	 * The magnitude of a decimal, taken from its sign rather than through `Math.abs`.
	 *
	 * A ledger row's direction is carried by its sign and its magnitude is what a running total
	 * accumulates, so the sign is dropped as text: routing the value through `Math.abs` would put it
	 * back into a double for no reason other than to remove one character.
	 *
	 * @param value Decimal text.
	 * @returns The same value without its sign.
	 */
	private absolute(value: string): string {
		return value.startsWith('-') ? value.slice(1) : value;
	}

	/**
	 * The date the order's goods were promised, derived from its lines.
	 *
	 * A promise is made per deliverable — lines ship separately — so the order's own date is the latest
	 * of them and nothing else: it is a cache of the lines, and the totals write is the one place that
	 * already runs whenever a line moves. An order whose lines carry no promise has no promised date
	 * rather than a fabricated one.
	 *
	 * @param order The order.
	 * @param reader Where the lines are read from.
	 * @returns The latest promised date among the lines, or null when none of them carries one.
	 */
	private async promisedDate(order: Order, reader: IOrderLedgerReader): Promise<Date | null> {
		const lines = await reader.lines(order);

		const promised = lines
			.map((line) => line.promisedAt)
			.filter((value): value is Date => value != null)
			.map((value) => new Date(value).getTime());

		return promised.length ? new Date(Math.max(...promised)) : null;
	}

	/**
	 * Counts the distinct sellers among the lines, which is derived and never authored.
	 *
	 * @param order The order.
	 * @param reader Where the lines are read from.
	 * @returns The number of distinct sellers.
	 */
	private async countSellers(order: Order, reader: IOrderLedgerReader): Promise<number> {
		const lines = await reader.lines(order);

		return new Set(lines.map((line) => line.sellerId).filter(Boolean)).size;
	}

	/**
	 * Reads the net part an inclusive adjustment recorded in its metadata.
	 *
	 * @param metadata The ledger row's metadata.
	 * @returns The net amount, or undefined when the row does not carry one.
	 */
	private netAmountOf(metadata: Record<string, unknown> | undefined): number | undefined {
		const netAmount = metadata?.['netAmount'];

		return typeof netAmount === 'number' ? netAmount : undefined;
	}

	/**
	 * Whether an order has any line that still has to ship.
	 *
	 * The comparison decides whether an order may complete, and it is made on the digits for the same
	 * reason the fulfilment status is: a line ordered for `0.3` that shipped `0.1` and was written off
	 * `0.2` has `0.1 + 0.2 = 0.30000000000000004` in binary floating point, which is *not* below `0.3` —
	 * and the mirrored case, where the sum lands just under, reports an open line on an order that has
	 * nothing left to ship and leaves it in the picking queue for ever.
	 *
	 * @param order The order.
	 * @returns True when a shippable line is not fully fulfilled.
	 */
	public async hasOpenShippableLines(order: Order): Promise<boolean> {
		const lines = ((await this.lineService.findAll({
			where: { orderId: order.id }
		})) as IPagination<OrderLine>).items;

		return lines.some((line) => {
			if (!line.requiresShipping) {
				return false;
			}

			const accounted = addDecimalStrings(
				this.decimalOf(line.fulfilledQuantity ?? 0),
				this.decimalOf(line.writtenOffQuantity ?? 0)
			);

			return compareDecimalStrings(accounted, this.decimalOf(line.quantity ?? 0)) < 0;
		});
	}

	/**
	 * Whether the payment side of an order is settled, which is one of the conditions for completion.
	 *
	 * The test is "nothing is outstanding", and an outstanding total that is a rounding error away from
	 * zero is nothing outstanding — but only a comparison on the digits says so. Compared as a double,
	 * an order settled to the last cent can hold an outstanding total of `2.7e-17` and never complete.
	 *
	 * @param order The order.
	 * @returns True when nothing is outstanding.
	 */
	public async isPaymentSettled(order: Order): Promise<boolean> {
		const snapshot = await this.computeTotals(order);

		return compareDecimalStrings(this.decimalOf(snapshot.outstandingTotal ?? 0), '0') <= 0;
	}

	/**
	 * Whether an order is in a status that may still be completed.
	 *
	 * @param order The order.
	 * @returns True when completion is a legal move.
	 */
	public canComplete(order: Order): boolean {
		return [OrderStatus.CONFIRMED, OrderStatus.PROCESSING].includes(order.status);
	}
}

/**
 * A value as the reconciliation prints and compares it.
 *
 * A column that was never written reads as an empty string rather than as `NaN` or `undefined`, so a
 * comparison between a stored zero and a derived zero is a comparison of two amounts and not of two
 * spellings of absence — which is the difference between a sweep that reports real drift and one that
 * reports every order it reads.
 *
 * @param value Whatever the row or the snapshot holds.
 * @returns The value as a string, with absence read as zero.
 */
function amountOf(value: unknown): string {
	if (value === undefined || value === null || value === '') {
		return '0';
	}

	return String(value);
}

/**
 * Reads one source of candidate orders a page at a time, keyed on the row id.
 *
 * Keyset rather than offset paging, because the rows a page skips are the ones already read: a page
 * that asks for the ids after the last one it saw cannot repeat a row or skip one when the table moves
 * underneath it, and it costs the same on the thousandth page as on the first.
 *
 * @param read Answers the page of rows after `after`, at most `take` of them, ordered by id.
 * @param orderOf Reads the order a row names.
 * @param into The set the orders are collected into.
 * @param pageSize How many rows one page returns.
 */
async function collectPaged<R extends { id?: ID }>(
	read: (after: ID | undefined, take: number) => Promise<R[]>,
	orderOf: (row: R) => ID | undefined,
	into: Set<ID>,
	pageSize: number
): Promise<void> {
	const take = Math.max(1, Math.floor(pageSize));
	let after: ID | undefined;

	for (;;) {
		const page = (await read(after, take)) ?? [];

		for (const row of page) {
			const orderId = orderOf(row);

			if (orderId) {
				into.add(orderId);
			}
		}

		const last = page[page.length - 1]?.id;

		// A short page is the last one. A page whose last id is the one it started after would be read
		// again for ever, so it ends the source too rather than trusting the reader to have moved.
		if (page.length < take || !last || last === after) {
			return;
		}

		after = last;
	}
}

/**
 * The order a ledger row names, whichever way the configured ORM projected it.
 *
 * TypeORM answers the `orderId` column. MikroORM answers the `order` relation, which its serializer
 * renders as the referenced id when the relation was not loaded, and as an object when it was.
 *
 * @param row A line or a transaction, as the window read returned it.
 * @returns The order's id, or `undefined` when the row names none.
 */
function orderIdOf(row: { orderId?: ID; order?: unknown }): ID | undefined {
	if (row.orderId) {
		return row.orderId;
	}

	if (typeof row.order === 'string') {
		return row.order;
	}

	return (row.order as { id?: ID } | null | undefined)?.id ?? undefined;
}

/**
 * The row lock a transaction's read of the row it is about to write takes, where the dialect has one.
 *
 * Inside a transaction a plain read is a snapshot: on MySQL's default `REPEATABLE READ` it is the snapshot of
 * the transaction's first read, so a row another transaction changed and committed since is still read as it
 * was — the version a conditional write is then predicated on is stale, the write matches nothing, and the
 * conflict's own read-back sees the same stale row. A locking read (`SELECT … FOR UPDATE`) reads the latest
 * committed row and holds it until the transaction ends, so the version the re-derivation reads is the one its update is predicated on. PostgreSQL and MySQL have it; SQLite has
 * no row locks (TypeORM refuses the option there) and serialises writers on its one connection instead, which
 * is the lock.
 *
 * @param manager The transaction's manager.
 * @returns The find option that takes the lock, or nothing where the dialect has none.
 */
function rowLockOf(manager: EntityManager): { lock?: { mode: 'pessimistic_write' } } {
	const type = String((manager?.connection?.options as { type?: string } | undefined)?.type ?? '');

	return ['postgres', 'cockroachdb', 'mysql', 'mariadb', 'aurora-mysql'].includes(type)
		? { lock: { mode: 'pessimistic_write' } }
		: {};
}

/**
 * Whether a manager a caller handed over is MikroORM's.
 *
 * The same test the platform's outbox makes (`isMikroOrmEntityManager`, which the core package does not
 * export): the class, and the shape for a manager that reached this module through a second copy of
 * `@mikro-orm/core`. A TypeORM manager has neither member.
 *
 * @param manager The manager.
 * @returns True when it is a MikroORM entity manager.
 */
function isMikroOrmManager(manager: unknown): manager is MikroOrmEntityManager {
	if (manager instanceof MikroOrmEntityManager) {
		return true;
	}

	const candidate = manager as { getUnitOfWork?: unknown; nativeUpdate?: unknown } | null | undefined;

	return typeof candidate?.getUnitOfWork === 'function' && typeof candidate?.nativeUpdate === 'function';
}

/**
 * Whether an error is the concurrency kernel's refusal of a write predicated on a version that moved on.
 *
 * @param error What a conditional write threw.
 * @returns True for `ENTITY_VERSION_CONFLICT`, false for anything else — a missing order included.
 */
function isVersionConflict(error: unknown): boolean {
	return error instanceof ApiException && error.code === ApiErrorCode.ENTITY_VERSION_CONFLICT;
}

/**
 * @param error The failure.
 * @returns The failure as one line, so a report row stays a row.
 */
function describe(error: unknown): string {
	return error instanceof Error ? (error.message.split('\n')[0] ?? error.message) : String(error);
}
