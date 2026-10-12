import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import {
	Money,
	MultiORMEnum,
	RequestContext,
	STORAGE_SCALE,
	compareDecimalStrings,
	formatDecimalUnits,
	getORMType,
	normalizeDecimalString,
	quoteIdentifier,
	readAffectedRows,
	toPositionalStatement,
	toUnitsAtScale
} from '@gauzy/core';
import { IOrderLineFulfillment, IOrderLineReceiptMove } from '../order.types';
import { Order } from '../order/order.entity';
import { MikroOrmOrderRepository } from '../order/repository/mikro-orm-order.repository';
import { TypeOrmOrderRepository } from '../order/repository/type-orm-order.repository';
import { OrderLine } from '../order-line/order-line.entity';
import { MikroOrmOrderLineRepository } from '../order-line/repository/mikro-orm-order-line.repository';
import { TypeOrmOrderLineRepository } from '../order-line/repository/type-orm-order-line.repository';

/**
 * One movement of an order line's requested-return counter, as a post-purchase flow states it.
 *
 * The counter is `order_line.returnRequestedQuantity`: the cache of the units every live return of
 * the line asks for. The shape is the receipt move's own — an order line and a signed delta — because
 * the two counters are moved by the same statement and refused by the same floor; a second shape would
 * be a second contract for one act.
 */
export type IOrderLineReturnRequestMove = IOrderLineReceiptMove;

/**
 * The counters of an order line that are moved rather than set, and what a refusal of each is called.
 *
 * The column is a closed set rather than a parameter a caller names, because it is interpolated into
 * a statement: a counter this class does not list is not one any caller can reach.
 *
 * The first two are the post-purchase flows' own. The last two are the order change's: a
 * `DISMISS_ITEM_RETURN` and a `WRITE_OFF_ITEM` are the only writers of theirs, and an `ITEM_RETURN` moves
 * the requested counter the returns flow moves too. They are listed here because the change used to move
 * them as a set — it read the line, added the delta in JavaScript and wrote the sum back — which is the
 * lost update this class's single statement exists to prevent, and on `returnRequestedQuantity` it
 * overwrote whatever a return had moved between that read and that write.
 */
const RETURN_COUNTERS = {
	/** What came back: sound and damaged units alike, since both arrived. */
	received: { column: 'returnReceivedQuantity', belowZero: 'ORDER_LINE_RECEIPT_BELOW_ZERO', noun: 'received' },
	/** What every live return of the line asks for. */
	requested: {
		column: 'returnRequestedQuantity',
		belowZero: 'ORDER_LINE_RETURN_REQUEST_BELOW_ZERO',
		noun: 'requested for return'
	},
	/** What was asked back and will not come back, which the order no longer owes either. */
	dismissed: {
		column: 'returnDismissedQuantity',
		belowZero: 'ORDER_LINE_RETURN_DISMISSAL_BELOW_ZERO',
		noun: 'dismissed from return'
	},
	/** What the order gave up shipping. */
	writtenOff: { column: 'writtenOffQuantity', belowZero: 'ORDER_LINE_WRITE_OFF_BELOW_ZERO', noun: 'written off' }
} as const;

/** One of the counters above. */
type ReturnCounter = (typeof RETURN_COUNTERS)[keyof typeof RETURN_COUNTERS];

/** The order a move is confined to, as the scoped read of it answered. */
interface IOrderScope {
	orderId: ID;
	tenantId: ID;
	organizationId: ID;
}

/** One move, once its delta was read as an exact decimal at the column's scale. */
interface IStatedMove {
	orderLineId: ID;
	/** The delta at the storage scale, never zero. */
	delta: DecimalString;
}

/**
 * The fulfilled quantities of an order, read from the order's own columns.
 *
 * A post-purchase flow — a return, a claim, an exchange — may only act on what was actually
 * fulfilled, and only this package knows that number: it is the `fulfilledQuantity` counter the
 * fulfilment rows maintain, which is the sum of the line's fulfilments that were never cancelled.
 * Two writers of that number would be two answers to "how much of this line left the building", so
 * the counter is read here and never recomputed from a shipment: the caller states which order
 * line it is asking about, and this service answers with the line's ceiling and the price the line
 * was sold at.
 *
 * Three properties are deliberate:
 *
 * 1. **Only lines with something fulfilled are reported.** The report is the set of lines a
 *    post-purchase flow may act on, so a line that was never fulfilled is absent from it. That is
 *    the honest answer to "can this be returned?": the caller's map lookup fails, and the flow
 *    refuses with "this was never fulfilled" rather than with an arithmetic comparison against a
 *    zero it would have to special-case.
 * 2. **Both numbers are exact decimals.** The quantity is the column's exact decimal text, never a
 *    floating-point number — a ceiling compared in floating point is wrong exactly at its boundary,
 *    which is where a return of the last available unit sits. The price is read through the
 *    platform money layer, so it is the price the ledger would also compute, at the storage scale.
 * 3. **The read is scoped to the caller's tenant and organization**, like every other read of this
 *    package. An order that is not the caller's is not found, which is the same answer whether it
 *    does not exist or belongs to somebody else.
 *
 * The class owns no table and no rule of its own: it is the seam through which a package that does
 * not own the order reaches the facts it needs about one — what a line has shipped, which is the
 * ceiling it is measured against, what is asked back and what came back, which is what the
 * derivation decides the order's fulfilment status from — and it exists so that no other package ever
 * reads **or writes** `order_line`.
 *
 * **It runs on whichever ORM is configured.** The TypeORM entity carries its columns only when
 * `DB_ORM` names TypeORM — `@MultiORMColumn` emits the decorator of the configured ORM alone — so a
 * read through the TypeORM repository under MikroORM filters on columns its metadata does not have.
 * Every read here therefore goes through the repository of the configured ORM, and every write is one
 * raw statement run on that ORM's connection.
 */
@Injectable()
export class OrderLineFulfillmentService {
	/** Where a reversal that did not land — a failure that must not replace the original — is reported. */
	private readonly logger = new Logger(OrderLineFulfillmentService.name);

	constructor(
		readonly typeOrmOrderRepository: TypeOrmOrderRepository,
		readonly typeOrmOrderLineRepository: TypeOrmOrderLineRepository,
		readonly mikroOrmOrderRepository: MikroOrmOrderRepository,
		readonly mikroOrmOrderLineRepository: MikroOrmOrderLineRepository
	) {}

	/**
	 * Reads what each line of an order has fulfilled, and at what price it was sold.
	 *
	 * @param orderId The order to read.
	 * @returns One entry per line that has something fulfilled, in the order the lines are presented
	 * in. A line that was never fulfilled is absent.
	 * @throws BadRequestException when no order was named.
	 * @throws NotFoundException when the order is not the caller's, which is also the answer for an
	 * order that does not exist.
	 */
	public async getFulfilledLines(orderId: ID): Promise<IOrderLineFulfillment[]> {
		if (!orderId) {
			throw new BadRequestException(
				'ORDER_FULFILLMENT_ORDER_REQUIRED: the fulfilled quantities of an order are read for one named order.'
			);
		}

		const order = await this.findOrder(orderId);

		if (!order) {
			throw new NotFoundException(`ORDER_NOT_FOUND: no order exists with id ${orderId}.`);
		}

		const lines = await this.findLines({ orderId, ...this.callerScope() });

		const fulfilled: IOrderLineFulfillment[] = [];

		for (const line of lines ?? []) {
			const quantity = this.quantityOf(line.fulfilledQuantity);

			// A presentation row — a section heading or a note — carries no quantity and no price, and
			// a real line that never shipped carries a zero: neither is something a post-purchase flow
			// may act on, and both are therefore absent from the report rather than reported as zero.
			if (compareDecimalStrings(quantity, '0') <= 0) {
				continue;
			}

			fulfilled.push({
				orderLineId: line.id,
				...(line.variantId ? { variantId: line.variantId } : {}),
				fulfilledQuantity: quantity,
				unitPrice: Money.fromStorage(line.unitPrice, order.currency as CurrencyCode).toStorageString()
			});
		}

		return fulfilled;
	}

	/**
	 * Reads a quantity column as an exact decimal.
	 *
	 * The counter is a `numeric(20,6)` read through the platform's numeric transformer, so it
	 * arrives as the value the transformer produced. Normalising it is not an arithmetic step: it
	 * turns that value into the canonical decimal text the contract promises, and it refuses a value
	 * that is not an exact decimal instead of handing the caller something its own parser would have
	 * to guess at.
	 *
	 * @param value The stored quantity.
	 * @returns The quantity as an exact decimal string.
	 */
	private quantityOf(value: number | DecimalString | null | undefined): DecimalString {
		return normalizeDecimalString(value ?? 0);
	}

	/**
	 * Moves the received-return counter of an order's lines.
	 *
	 * **This is the writer `order_line.returnReceivedQuantity` never had.** The column is read by
	 * `deriveFulfillmentStatus`, which decides `PARTIALLY_RETURNED` and `RETURNED` from it — and until
	 * this method existed, nothing in the repository assigned it: the three counters beside it are
	 * moved by `OrderChangeService.applyAction` (through {@link recordReturnRequest},
	 * {@link recordReturnDismissal} and {@link recordWriteOff}), and this one was written by nobody, so
	 * the derivation could never see goods come back and doc 10 §11.6 step 2 ("order line
	 * `returnReceivedQuantity` updated") described an update that did not happen.
	 *
	 * **It is a move, not a set, and the move is one statement.** The counter is the order's cache of
	 * what came back, so a delivery increases it by the units it brought and the receipt's compensation
	 * decreases it by the same units. The first version of this method read the counter, added the delta
	 * in JavaScript and wrote the sum back — which is exactly the lost update the move form exists to
	 * prevent: two returns of one line received at the same moment both read `0`, wrote `1` and `2`, and
	 * the line ended at one of them rather than at `3`. The counter is now moved by
	 * `SET col = ROUND(col + :delta, 6) … WHERE … AND ROUND(col + :delta, 6) >= 0`, so the addition, the
	 * floor and the write are one statement the database serialises, and the affected-row count is the
	 * answer (see {@link moveCounter}).
	 *
	 * **Three things are refused rather than written through**, because each would leave the order's
	 * cache disagreeing with the goods it describes: an order or a line that is not the caller's (the
	 * same scoped read the reader above performs, so a foreign line is not found at all), and a move
	 * that would take the counter below zero — a negative "received" is not a state the column can be
	 * in, and a compensation that overshot would otherwise write one. A delta that is not an exact
	 * decimal at the column's scale is refused before anything is written.
	 *
	 * **A call is all or nothing.** The moves of one call are separate statements — no transaction is
	 * open across two packages — so a move refused part-way reverses the moves of the same call that
	 * already landed before the refusal is raised. A caller that sees the call fail therefore has no
	 * move of it to undo, which is what lets that caller's compensation undo only what it knows landed.
	 *
	 * @param orderId The order whose lines are moved, and the scope the write is checked in.
	 * @param moves One entry per order line this delivery touched. An empty list moves nothing.
	 * @throws BadRequestException when no order was named, a delta is not exact, or a move would take a
	 * counter below zero.
	 * @throws NotFoundException when the order, or a named line of it, is not the caller's.
	 */
	public async recordReturnReceipt(orderId: ID, moves: readonly IOrderLineReceiptMove[]): Promise<void> {
		await this.moveCounters(RETURN_COUNTERS.received, orderId, moves);
	}

	/**
	 * Moves the requested-return counter of an order's lines.
	 *
	 * `order_line.returnRequestedQuantity` is the order's cache of what its live returns ask for, and
	 * doc 10 invariant I-12 — `returnReceivedQuantity + returnDismissedQuantity <=
	 * returnRequestedQuantity` — is stated against it. Nothing in the returns flow wrote it, so the
	 * invariant compared what came back against a zero. A return raised or edited moves it up (or down)
	 * by the units its lines ask for, and a return rejected or cancelled moves it back by the units it no
	 * longer asks for (doc 10 §11.7: "returnRequestedQuantity reverted").
	 *
	 * It is the same statement as {@link recordReturnReceipt} on the other column, with the same floor,
	 * the same scope and the same all-or-nothing call.
	 *
	 * @param orderId The order whose lines are moved, and the scope the write is checked in.
	 * @param moves One entry per order line whose requested quantity changed. An empty list moves nothing.
	 * @throws BadRequestException when no order was named, a delta is not exact, or a move would take a
	 * counter below zero.
	 * @throws NotFoundException when the order, or a named line of it, is not the caller's.
	 */
	public async recordReturnRequest(orderId: ID, moves: readonly IOrderLineReturnRequestMove[]): Promise<void> {
		await this.moveCounters(RETURN_COUNTERS.requested, orderId, moves);
	}

	/**
	 * Moves the dismissed-return counter of an order's lines.
	 *
	 * `order_line.returnDismissedQuantity` is what was asked back and will not come back, and
	 * `deriveFulfillmentStatus` subtracts it from what the order still owes. Its one writer is the order
	 * change's `DISMISS_ITEM_RETURN`, which used to read the line and write back the sum it computed — so a
	 * second dismissal of the same line landing between that read and that write was lost. It is now the
	 * same statement as {@link recordReturnReceipt} on this column, with the same floor, the same scope and
	 * the same all-or-nothing call.
	 *
	 * @param orderId The order whose lines are moved, and the scope the write is checked in.
	 * @param moves One entry per order line whose dismissed quantity changed. An empty list moves nothing.
	 * @throws BadRequestException when no order was named, a delta is not exact, or a move would take a
	 * counter below zero.
	 * @throws NotFoundException when the order, or a named line of it, is not the caller's.
	 */
	public async recordReturnDismissal(orderId: ID, moves: readonly IOrderLineReceiptMove[]): Promise<void> {
		await this.moveCounters(RETURN_COUNTERS.dismissed, orderId, moves);
	}

	/**
	 * Moves the written-off counter of an order's lines.
	 *
	 * `order_line.writtenOffQuantity` is what the order gave up shipping: the derivation subtracts it from
	 * what the order owes and completion reads it beside the fulfilled quantity. Its one writer is the order
	 * change's `WRITE_OFF_ITEM`, which moves it by this statement for the reason
	 * {@link recordReturnDismissal} states.
	 *
	 * @param orderId The order whose lines are moved, and the scope the write is checked in.
	 * @param moves One entry per order line whose written-off quantity changed. An empty list moves nothing.
	 * @throws BadRequestException when no order was named, a delta is not exact, or a move would take a
	 * counter below zero.
	 * @throws NotFoundException when the order, or a named line of it, is not the caller's.
	 */
	public async recordWriteOff(orderId: ID, moves: readonly IOrderLineReceiptMove[]): Promise<void> {
		await this.moveCounters(RETURN_COUNTERS.writtenOff, orderId, moves);
	}

	/**
	 * Moves one counter of an order's lines, all or nothing.
	 *
	 * @param counter The counter to move.
	 * @param orderId The order whose lines are moved.
	 * @param moves The moves the caller stated.
	 */
	private async moveCounters(
		counter: ReturnCounter,
		orderId: ID,
		moves: readonly IOrderLineReceiptMove[]
	): Promise<void> {
		if (!orderId) {
			throw new BadRequestException(
				`ORDER_FULFILLMENT_ORDER_REQUIRED: the ${counter.noun} counter of an order is moved for one named order.`
			);
		}

		// Every delta is read before anything is written, so a move the call cannot state leaves every
		// line where it was rather than half of them moved.
		const stated = (moves ?? [])
			.map((move) => this.stateMove(move))
			.filter((move): move is IStatedMove => move !== null);

		if (stated.length === 0) {
			return;
		}

		const scope = await this.readOrderScope(orderId);
		const applied: IStatedMove[] = [];

		try {
			for (const move of stated) {
				const affected = await this.moveCounter(counter, scope, move.orderLineId, move.delta);

				if (affected === 0) {
					await this.refuseMove(counter, scope, move);
				}

				applied.push(move);
			}
		} catch (error) {
			await this.reverse(counter, scope, applied);

			throw error;
		}
	}

	/**
	 * Reads one stated move as an exact delta at the column's scale.
	 *
	 * The column is a `numeric(20,6)`, so a delta with a digit below the sixth place is one the column
	 * cannot hold: it is refused rather than rounded, because a rounded delta would move the counter by an
	 * amount the caller never stated. A zero is not a move and is dropped — a statement that changes
	 * nothing is a write on a row a concurrent delivery may be holding, and on MySQL it would also read
	 * back as "no row changed", which is the answer a refusal gives.
	 *
	 * @param move The move the caller stated.
	 * @returns The move, or null when it moves nothing.
	 * @throws BadRequestException when the order line is missing or the delta is not an exact decimal.
	 */
	private stateMove(move: IOrderLineReceiptMove): IStatedMove | null {
		if (!move?.orderLineId) {
			throw new BadRequestException('ORDER_LINE_REQUIRED: every counter move names the order line it moves.');
		}

		let units: bigint;

		try {
			units = toUnitsAtScale(normalizeDecimalString(move.quantityDelta), STORAGE_SCALE);
		} catch {
			throw new BadRequestException(
				`ORDER_LINE_QUANTITY_NOT_EXACT: ${String(move.quantityDelta)} is not an exact decimal at the ` +
					`${STORAGE_SCALE} places an order line's quantities are stored at.`
			);
		}

		return units === 0n ? null : { orderLineId: move.orderLineId, delta: formatDecimalUnits(units, STORAGE_SCALE) };
	}

	/**
	 * Moves one counter of one line by one delta, in one statement.
	 *
	 * `UPDATE "order_line" SET "<col>" = ROUND("<col>" + CAST(:delta AS DECIMAL(20,6)), 6) WHERE "id" =
	 * :orderLineId AND "orderId" = :orderId AND "tenantId" = :tenantId AND "organizationId" =
	 * :organizationId AND "deletedAt" IS NULL AND ROUND("<col>" + CAST(:delta AS DECIMAL(20,6)), 6) >= 0`.
	 *
	 * Each part of it is there for a dialect:
	 *
	 * - the identifiers are quoted for the configured dialect, because MySQL reads `"col"` as the string
	 *   `col` and would assign the delta over the counter instead of adding to it;
	 * - the delta is bound, never interpolated, and cast to the column's own type, because MySQL adds a
	 *   string to a decimal in floating point;
	 * - the sum is rounded at the column's scale, because SQLite keeps a `numeric(20,6)` with a fraction
	 *   as a binary float — `0.3 − 0.1 − 0.2` is `-2.8e-17` there, which the floor would refuse for a
	 *   counter that is exactly empty — and the rounding is a no-op on the two dialects that hold the
	 *   column as an exact decimal;
	 * - the floor is part of the `WHERE`, so a move that would take the counter below zero changes no
	 *   row rather than being checked against a value read earlier.
	 *
	 * @param counter The counter to move.
	 * @param scope The order the line must belong to, and its tenant and organization.
	 * @param orderLineId The line to move.
	 * @param delta The exact delta, never zero.
	 * @returns How many rows the statement changed: one when the move landed, none when it was refused.
	 */
	private async moveCounter(
		counter: ReturnCounter,
		scope: IOrderScope,
		orderLineId: ID,
		delta: DecimalString
	): Promise<number> {
		const q = quoteIdentifier;
		const column = q(counter.column);
		const moved = `ROUND(${column} + CAST(:delta AS DECIMAL(20,6)), 6)`;
		const sql =
			`UPDATE ${q('order_line')} SET ${column} = ${moved} ` +
			`WHERE ${q('id')} = :orderLineId AND ${q('orderId')} = :orderId ` +
			`AND ${q('tenantId')} = :tenantId AND ${q('organizationId')} = :organizationId ` +
			`AND ${q('deletedAt')} IS NULL AND ${moved} >= 0`;

		return await this.execute(sql, {
			delta,
			orderLineId,
			orderId: scope.orderId,
			tenantId: scope.tenantId,
			organizationId: scope.organizationId
		});
	}

	/**
	 * Explains a move no row accepted, and refuses it.
	 *
	 * The statement answers only "no row changed", which is both a line that is not the caller's and a
	 * move below the floor; the line is read in the same scope to tell the caller which it was.
	 *
	 * @param counter The counter that was moved.
	 * @param scope The order the line must belong to.
	 * @param move The refused move.
	 * @throws NotFoundException when the line is not a line of this order in this organization.
	 * @throws BadRequestException when it is, and the move would take the counter below zero.
	 */
	private async refuseMove(counter: ReturnCounter, scope: IOrderScope, move: IStatedMove): Promise<never> {
		const [line] = await this.findLines(
			{
				id: move.orderLineId,
				orderId: scope.orderId,
				tenantId: scope.tenantId,
				organizationId: scope.organizationId
			},
			true
		);

		if (!line) {
			throw new NotFoundException(
				`ORDER_LINE_NOT_FOUND: order ${scope.orderId} has no line ${move.orderLineId} in this organization.`
			);
		}

		const held = this.quantityOf((line as unknown as Record<string, number | DecimalString>)[counter.column]);

		throw new BadRequestException(
			`${counter.belowZero}: moving line ${move.orderLineId} by ${normalizeDecimalString(move.delta)} would ` +
				`take the ${held} units ${counter.noun} below zero, and a line cannot hold less than nothing.`
		);
	}

	/**
	 * Undoes the moves of a call that were applied before one of its moves was refused.
	 *
	 * The reversal is best-effort by nature — it is undoing writes that only partly landed — so a
	 * reversal that fails is logged rather than raised: the failure the caller must see is the move that
	 * was refused, not the undo of the ones before it.
	 *
	 * @param counter The counter that was moved.
	 * @param scope The order the lines belong to.
	 * @param applied The moves that landed, in the order they landed.
	 */
	private async reverse(counter: ReturnCounter, scope: IOrderScope, applied: readonly IStatedMove[]): Promise<void> {
		for (const move of [...applied].reverse()) {
			try {
				const opposite = move.delta.startsWith('-') ? move.delta.slice(1) : `-${move.delta}`;
				const affected = await this.moveCounter(counter, scope, move.orderLineId, opposite);

				if (affected === 0) {
					throw new Error(`the reversal of ${move.delta} was refused`);
				}
			} catch (error) {
				this.logger.error(
					`A ${counter.column} move of order ${scope.orderId} was refused part-way, and the move of line ` +
						`${move.orderLineId} by ${move.delta} could not be reversed: ${
							error instanceof Error ? error.message : String(error)
						}`
				);
			}
		}
	}

	/**
	 * Reads the order a move is confined to, in the caller's scope.
	 *
	 * The statement is predicated on the order's **own** tenant and organization rather than on the
	 * caller's, because those are the values the line rows carry: the order was found in the caller's
	 * scope, so they are the caller's too, and a caller whose credential states no organization still
	 * writes only inside the one organization the order belongs to.
	 *
	 * @param orderId The order.
	 * @returns The order's id, tenant and organization.
	 * @throws NotFoundException when the order is not the caller's.
	 */
	private async readOrderScope(orderId: ID): Promise<IOrderScope> {
		const order = await this.findOrder(orderId);

		if (!order) {
			throw new NotFoundException(`ORDER_NOT_FOUND: no order exists with id ${orderId}.`);
		}

		return { orderId: order.id ?? orderId, tenantId: order.tenantId, organizationId: order.organizationId };
	}

	/**
	 * The caller's tenant and organization, as read criteria.
	 *
	 * A member the credential does not state is left out rather than set to `undefined`, because the two
	 * ORMs read a present-but-undefined criterion differently: TypeORM drops it and MikroORM compares it
	 * with `NULL`. This is the rule the platform's versioned write states for the same reason.
	 *
	 * @returns The scope criteria.
	 */
	private callerScope(): { tenantId?: ID; organizationId?: ID } {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		return {
			...(tenantId ? { tenantId } : {}),
			...(organizationId ? { organizationId } : {})
		};
	}

	/**
	 * @returns Whether MikroORM is the configured ORM, which decides the repository and connection used.
	 */
	private get usesMikroOrm(): boolean {
		return getORMType() === MultiORMEnum.MikroORM;
	}

	/**
	 * Reads one order in the caller's scope, through the configured ORM.
	 *
	 * @param orderId The order.
	 * @returns The order, or null when it is not the caller's.
	 */
	private async findOrder(orderId: ID): Promise<Order | null> {
		const where = { id: orderId, ...this.callerScope() };

		if (this.usesMikroOrm) {
			return (await this.mikroOrmOrderRepository.findOne(where as never)) ?? null;
		}

		return await this.typeOrmOrderRepository.findOne({ where: where as FindOptionsWhere<Order> });
	}

	/**
	 * Reads order lines, in the order they are presented in, through the configured ORM.
	 *
	 * @param where The criteria, which always carry the order and the scope.
	 * @param single Whether only the first matching line is wanted.
	 * @returns The lines.
	 */
	private async findLines(where: Record<string, unknown>, single = false): Promise<OrderLine[]> {
		if (this.usesMikroOrm) {
			if (single) {
				const line = await this.mikroOrmOrderLineRepository.findOne(where as never);

				return line ? [line] : [];
			}

			return await this.mikroOrmOrderLineRepository.find(where as never, { orderBy: { position: 'ASC' } } as never);
		}

		if (single) {
			const line = await this.typeOrmOrderLineRepository.findOne({ where: where as FindOptionsWhere<OrderLine> });

			return line ? [line] : [];
		}

		return await this.typeOrmOrderLineRepository.find({
			where: where as FindOptionsWhere<OrderLine>,
			order: { position: 'ASC' }
		});
	}

	/**
	 * Runs one write statement on the configured ORM's connection and answers how many rows it changed.
	 *
	 * **Both arms read the affected-row count from a shape that carries it.** TypeORM's raw
	 * `Repository.query()` answers whatever its driver's runner returns unstructured — and the
	 * better-sqlite3 runner, which serves both SQLite settings, returns the connection's
	 * `lastInsertRowid` for an `UPDATE`, a number that has nothing to do with the statement. The TypeORM
	 * arm therefore asks the query runner for its structured result, whose `affected` every driver fills.
	 * The MikroORM arm runs the statement in `run` mode, which answers `{ affectedRows }` on every driver.
	 *
	 * **Both arms bind positionally, and not alike.** TypeORM hands the statement to the driver untouched,
	 * so it gets the driver's own placeholders — `$1` on Postgres, `?` elsewhere. MikroORM's connection
	 * inlines the values itself before the driver sees the statement, and it recognises `?` alone, on
	 * every dialect: a `$1` handed to it on Postgres reaches the database unbound.
	 *
	 * @param sql The statement, with `:name` parameters and dialect-quoted identifiers.
	 * @param parameters The values, keyed by name.
	 * @returns The affected-row count.
	 */
	private async execute(sql: string, parameters: Record<string, unknown>): Promise<number> {
		if (this.usesMikroOrm) {
			const bound = toQuestionMarkStatement(sql, parameters);
			const connection = this.mikroOrmOrderLineRepository.getEntityManager().getConnection();

			return readAffectedRows(await connection.execute(bound.sql, bound.parameters, 'run'));
		}

		const bound = toPositionalStatement(sql, parameters);
		const manager = this.typeOrmOrderLineRepository.manager;
		// A manager bound to a transaction carries its runner, and the statement joins that transaction;
		// otherwise a runner of its own is taken from the pool and given back.
		const runner = manager.queryRunner ?? manager.dataSource.createQueryRunner();

		try {
			const result = await runner.query(bound.sql, bound.parameters, true);

			return typeof result?.affected === 'number' ? result.affected : readAffectedRows(result?.raw);
		} finally {
			if (runner !== manager.queryRunner) {
				await runner.release();
			}
		}
	}
}

/**
 * Rewrites a statement's named parameters into the `?` placeholders MikroORM's connection binds.
 *
 * `toPositionalStatement` chooses the placeholder the *driver* binds, which is `$1` on Postgres — the
 * right answer for TypeORM, which hands the statement to `pg` untouched. MikroORM's `execute` formats
 * the values into the statement itself first, and its formatter looks for `?` on every dialect, so the
 * statement it is given carries `?` whatever the database is. A name used twice is bound twice, in the
 * order the occurrences appear, and a `::` cast is left alone.
 *
 * @param sql The statement, with `:name` parameters.
 * @param parameters The values, keyed by name.
 * @returns The statement with `?` placeholders, and its values in matching order.
 */
function toQuestionMarkStatement(
	sql: string,
	parameters: Record<string, unknown>
): { sql: string; parameters: unknown[] } {
	const values: unknown[] = [];
	const positional = sql.replace(/(?<!:):(\w+)\b/g, (match: string, name: string) => {
		if (!Object.prototype.hasOwnProperty.call(parameters, name)) {
			return match;
		}

		values.push(parameters[name]);

		return '?';
	});

	return { sql: positional, parameters: values };
}
