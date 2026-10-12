import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	Optional
} from '@nestjs/common';
import { EntityManager, FindOptionsWhere, In, IsNull, UpdateResult } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import {
	readAffectedRows,
	RequestContext,
	SequenceService,
	TenantAwareCrudService,
	TenantSettingService
} from '@gauzy/core';
import {
	GoodsReceiptStatus,
	IGoodsReceiptInput,
	IGoodsReceiptLineInput,
	IInventoryPort,
	PURCHASING_INVENTORY,
	PurchaseOrderStatus,
	PurchasingCodes,
	StockMovementKind
} from '../purchasing.types';
import {
	isGreaterThanQuantity,
	negateQuantity,
	normalizeQuantity,
	quantityWithTolerance,
	sumQuantity,
	toQuantityUnits
} from '../purchasing.quantity';
import { GoodsReceiptLine } from '../goods-receipt-line/goods-receipt-line.entity';
import { GoodsReceiptLineService } from '../goods-receipt-line/goods-receipt-line.service';
import { PurchaseOrderLine } from '../purchase-order-line/purchase-order-line.entity';
import {
	IPurchaseOrderLineDelta,
	PurchaseOrderLineService,
	ReceivedCountersMovedError
} from '../purchase-order-line/purchase-order-line.service';
import { PurchaseOrder } from '../purchase-order/purchase-order.entity';
import { PurchaseOrderService } from '../purchase-order/purchase-order.service';
import { VendorProductTermService } from '../vendor-product-term/vendor-product-term.service';
import { immutableMembers, movedMembers } from '../purchasing.immutable';
import { GoodsReceipt } from './goods-receipt.entity';
import { MikroOrmGoodsReceiptRepository } from './repository/mikro-orm-goods-receipt.repository';
import { TypeOrmGoodsReceiptRepository } from './repository/type-orm-goods-receipt.repository';

/** The series key goods-receipt numbers are allocated from. */
const GOODS_RECEIPT_NUMBER_KEY = 'RECEIPT';

/**
 * The members of a receipt its posting was decided on: its status and cancellation, which only `reverse()` may move
 * because it writes the compensating movements, and the order and the location its movements and its order lines'
 * received quantities were posted against.
 */
const POSTED_RECEIPT_MEMBERS = ['status', 'canceledAt', 'purchaseOrderId', 'warehouseId'] as const;

/** The concept this domain writes its movements under. */
const MOVEMENT_REFERENCE = 'GOODS_RECEIPT';

/**
 * How many times a receiving transaction is run again from the start when an order line it claimed
 * moved under it. Row locks make that impossible on Postgres and MySQL and SQLite has one writer; the
 * attempts are what a storage with neither falls back on.
 */
const RECEIVING_ATTEMPTS = 3;

/** Why a movement the reversal wrote exists. */
const RECEIPT_CANCELED = 'RECEIPT_CANCELED';

/**
 * The organization setting an over-shipment allowance is configured under.
 *
 * The middle step of the tolerance chain: the allowance a line's own term negotiated comes first, then
 * this tenant-level setting, then none at all. It is a setting rather than a column because it is a
 * policy about receiving in general rather than a fact about one supplier or one product.
 */
const OVER_RECEIPT_SETTING = 'purchasing.overReceiptTolerancePercent';

/** A line of a receipt, resolved against the order line it is against and checked against the ceiling. */
interface IResolvedReceiptLine {
	/** The order the line being received belongs to, which a consolidated receipt needs to write back. */
	orderId: ID;
	purchaseOrderLineId: ID;
	variantId: ID;
	quantity: DecimalString;
	damagedQuantity: DecimalString;
	unitCost: DecimalString;
	batchNumber?: string;
	expiresAt?: Date;
	warehouseBinId?: ID;
	note?: string;
	/** What the order line's two counters may reach together: its quantity within its allowance. */
	ceiling?: DecimalString;
	/** The allowance the ceiling was computed under. */
	tolerance?: DecimalString;
}

/**
 * A receipt as the receiving operation answers with it.
 *
 * The receipt itself — which is what the resource is — plus what the operation did to the ledger and
 * to the order it is against. A caller that recorded a delivery needs all of it: the document number
 * to quote, the movements so the stock change is traceable, and the order's new status and outstanding
 * quantity so it does not have to re-read them. The extra members are attached to the receipt rather
 * than wrapped around it, so the same object is the resource and the outcome — which is what lets the
 * REST route answer with a receipt that is also the record of what receiving did.
 *
 * `purchaseOrderStatus` is the status of the order the delivery was anchored to, and is therefore
 * absent on a consolidated receipt; `purchaseOrderStatuses` carries the status of every order the
 * delivery touched, which is what such a receipt has instead of one.
 */
export type GoodsReceiptPosting = GoodsReceipt & {
	/** The stock movements the operation wrote, one per line and disposition. */
	movementIds: ID[];
	/** The purchase order's status after the operation, when the receipt is anchored to one. */
	purchaseOrderStatus?: PurchaseOrderStatus;
	/** Every order the delivery touched and where it now stands. */
	purchaseOrderStatuses: Record<string, PurchaseOrderStatus>;
	/** Good units this operation received. */
	receivedQuantity: DecimalString;
	/** Damaged units this operation received. */
	damagedQuantity: DecimalString;
	/** What the orders behind this delivery are still waiting for after the operation. */
	outstandingQuantity: DecimalString;
};

/**
 * Goods receipts: what physically arrived, and the stock movements that follow from it.
 *
 * **The rule this service exists for:** receiving is bounded by what was ordered, within the allowance
 * the line is received under. A line may not be pushed past its ordered quantity beyond that allowance,
 * and the check is exact — quantities are compared as scaled integers, on the boundary, where a
 * floating point comparison would give the wrong answer. A receipt that would exceed it is refused with
 * `RECEIPT_OVER_TOLERANCE` and nothing is written.
 *
 * **The allowance is resolved per line**, in this order: what the caller states for this one delivery,
 * then the over-shipment fraction the line's own winning term negotiated, then the organization's
 * `purchasing.overReceiptTolerancePercent` setting, then the order's own configured allowance, and none
 * of them means no allowance at all. Goods that have physically arrived must be recordable — refusing
 * them forces an operator to under-record and post an adjustment, which corrupts the one thing a
 * receipt exists to establish — while the allowance keeps the rule's real purpose, catching a
 * ten-versus-ten-thousand keying error.
 *
 * The second rule is where the stock goes. **This domain never writes an inventory table.** Every
 * movement goes through the inventory capability, injected under `PURCHASING_INVENTORY`: a good unit
 * is a `RECEIPT`, a unit that arrived broken is a `DAMAGE` that leaves the level unchanged, and
 * reversing a receipt is a `WRITE_OFF` of exactly what the receipt added. When no capability is
 * registered the receipt is refused rather than completed without a movement — a receipt whose goods
 * never became sellable is worse than a receipt that did not happen.
 *
 * **The order anchor is optional.** A consolidated delivery covering several orders is routine, and the
 * authoritative relation is the receipt line's own order line. What the header column cannot state the
 * service checks: when it is set, every line has to belong to that order (`RECEIPT_ORDER_MISMATCH`),
 * and the location has to be the location of every order the lines belong to, because receiving
 * elsewhere is a transfer rather than a receipt. Both of those questions are asked of the orders the
 * lines belong to, so a line the caller cannot resolve is refused as a line before either of them —
 * with no order behind it, neither question has an answer, and reporting one of them would name the
 * consequence rather than the line that is actually missing.
 *
 * Put-away is the same seam as the movement: a line that carries a bin asks the capability to walk the
 * units from the receiving area into that bin, linked to the movement the line produced.
 */
@Injectable()
export class GoodsReceiptService extends TenantAwareCrudService<GoodsReceipt> {
	private readonly logger = new Logger(GoodsReceiptService.name);

	constructor(
		readonly typeOrmGoodsReceiptRepository: TypeOrmGoodsReceiptRepository,
		readonly mikroOrmGoodsReceiptRepository: MikroOrmGoodsReceiptRepository,
		private readonly receiptLineService: GoodsReceiptLineService,
		private readonly purchaseOrderService: PurchaseOrderService,
		private readonly purchaseOrderLineService: PurchaseOrderLineService,
		private readonly vendorProductTermService: VendorProductTermService,
		private readonly tenantSettingService: TenantSettingService,
		private readonly sequenceService: SequenceService,
		@Optional()
		@Inject(PURCHASING_INVENTORY)
		private readonly inventory?: IInventoryPort
	) {
		super(typeOrmGoodsReceiptRepository, mikroOrmGoodsReceiptRepository);
	}

	/**
	 * Corrects a receipt's own fields, refusing a change to what its movements were posted against.
	 *
	 * `PUT /goods-receipts/:id` validates a body that declares `status`, `canceledAt`, `purchaseOrderId` and
	 * `warehouseId`, and it reached the generic update, which wrote them as asked (handover 2026-09-20 §7.65 item
	 * 23 (b)). A receipt is born `POSTED`, so every receipt already has the stock movements its lines produced and
	 * has moved its order lines' received counters: setting `CANCELED` here bypassed `reverse()`, so no compensating
	 * movement was written and the stock stayed received; and re-pointing the order or the location left the
	 * movements and the counters naming the old ones. The refusal is made here, below the route, so every caller of
	 * the generic update is held to it; the route, its DTO and every other member — the note, the metadata, the
	 * received-by and received-at facts — are unchanged. `reverse()` writes its own status through the base class
	 * and is not affected.
	 *
	 * @param id The receipt, or the conditions that select the receipts to correct.
	 * @param partialEntity The members to change.
	 * @returns The update result, as the base class answers it.
	 * @throws BadRequestException with `GOODS_RECEIPT_IMMUTABLE` when the correction would move a receipt's
	 * status, cancellation, order or location.
	 */
	public async update(
		id: ID | FindOptionsWhere<GoodsReceipt>,
		partialEntity: QueryDeepPartialEntity<GoodsReceipt>
	): Promise<GoodsReceipt | UpdateResult> {
		const patch = (partialEntity ?? {}) as Record<string, unknown>;

		if (POSTED_RECEIPT_MEMBERS.some((member) => patch[member] !== undefined)) {
			const current = typeof id === 'string' ? [await this.findOneByIdString(id)] : await this.find({ where: id });

			for (const receipt of current) {
				const moved = movedMembers(receipt as unknown as Record<string, unknown>, patch, POSTED_RECEIPT_MEMBERS);

				if (moved.length > 0) {
					throw immutableMembers(
						'GOODS_RECEIPT_IMMUTABLE',
						`a correction cannot change ${moved.join(', ')} of goods receipt '${receipt.id}', because its ` +
							`stock movements and its order lines' received quantities were posted against them; reverse ` +
							`the receipt (POST /goods-receipts/:id/cancel) and record the right one instead.`,
						{ goodsReceiptId: receipt.id, fields: moved }
					);
				}
			}
		}

		return super.update(id as any, partialEntity);
	}

	/**
	 * Receives goods.
	 *
	 * The order is validated first — it has to be sent, and it has to have something left to receive —
	 * then every line is resolved against its own order line and checked against its ceiling, with the
	 * entries that name one order line summed, before anything is written. The order lines' received
	 * counters are then claimed under their row locks, the ceiling measured again against the counters
	 * as they stand there — which is what keeps two receipts in flight against one line from passing it
	 * together.
	 *
	 * **Everything the delivery writes is one transaction.** The orders it touches are locked first, then
	 * the counters are claimed, the receipt and its lines written, its stock movements and put-aways
	 * posted through the inventory capability on the same transaction, and each order's status derived
	 * from what its counters now say. A delivery that stops anywhere — a refusal, a failed movement, a
	 * process that dies half way — leaves nothing behind: no claimed quantity without a receipt, no
	 * receipt without its stock, no stock without its receipt. A retry therefore starts from the state
	 * the first attempt found, which is the only state from which it can be measured correctly.
	 *
	 * A delivery that names no order is a consolidated one: its lines may come from several orders, and
	 * they all have to belong to orders of the same organization and the same receiving location. A
	 * partial delivery is the ordinary case either way: the order keeps the outstanding quantity, its
	 * status becomes `PARTIALLY_RECEIVED`, and the next delivery is another receipt.
	 *
	 * @param input The delivery.
	 * @returns The receipt, carrying what the operation did to the ledger and to the orders.
	 * @throws ConflictException when an order cannot be received against, when a location differs, when
	 * a line would exceed its allowance, or when no inventory capability is registered and there are
	 * units to move.
	 * @throws NotFoundException when a line the delivery names is not one the caller may receive against.
	 * @throws BadRequestException when a line carries no quantity at all.
	 */
	public async receive(input: IGoodsReceiptInput): Promise<GoodsReceiptPosting> {
		if (!Array.isArray(input.lines) || input.lines.length === 0) {
			throw new BadRequestException('A goods receipt needs at least one line.');
		}

		const orderLines = await this.purchaseOrderLineService.findIndexedByIds(
			input.lines.map((line) => line.purchaseOrderLineId)
		);

		// The lines are settled first: every order this delivery touches, and so the location an anchored
		// delivery inherits rather than states, is discovered through them, and a name that resolves to
		// nothing has no order behind it for either question to be answered from.
		this.resolveNamedLines(input.lines, orderLines);

		const orders = await this.resolveOrders(input, orderLines);
		const warehouseId = this.resolveWarehouse(input, orderLines, orders);
		const resolved = await this.resolveLines(input.lines, orderLines, orders, input.overReceiptTolerance);

		this.assertLedgerFor(resolved);

		// Allocated before the transaction: the series takes its own lock, and a number a failed delivery
		// allocated is a gap in the series rather than a receipt that half exists.
		const number = await this.allocateNumber();
		const currency = this.currencyOf(orders);
		const header = {
			purchaseOrderId: input.purchaseOrderId,
			warehouseId,
			number,
			status: GoodsReceiptStatus.POSTED,
			receivedAt: input.receivedAt ?? new Date(),
			receivedByUserId: RequestContext.currentUserId(),
			version: 1,
			note: input.note,
			metadata: input.metadata,
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};

		// The guard `create()` runs on a payload, run here because the header is written on the transaction.
		await this.assertNestedGraphNotForeign([header as never], RequestContext.currentTenantId());

		const { receipt, movementIds, statuses } = await this.receiving(
			async (manager: EntityManager) => {
				await this.lockReceivableOrders(manager, [...orders.keys()], input.purchaseOrderId, input.expectedVersion);

				// The order lines' counters are claimed before anything else is written, under their row locks
				// and against their ceilings as they stand there: the check above is made on a read taken before
				// any lock, and two receipts in flight against one line can each pass it.
				await this.claimCounters(resolved, manager);

				const posted = (await manager.save(GoodsReceipt, manager.create(GoodsReceipt, header as never))) as GoodsReceipt;
				const lines = await this.receiptLineService.writeLines(
					posted.id,
					resolved,
					{ tenantId: posted.tenantId, organizationId: posted.organizationId },
					manager
				);

				return {
					receipt: posted,
					movementIds: await this.writeReceiptMovements(this.numberOf(input, orders), posted, lines, currency, manager),
					statuses: await this.refreshOrders(resolved, manager)
				};
			}
		);

		const written = await this.findOneDetailed(receipt.id);

		return Object.assign(written, {
			movementIds,
			purchaseOrderStatus: input.purchaseOrderId ? statuses[input.purchaseOrderId] : undefined,
			purchaseOrderStatuses: statuses,
			receivedQuantity: sumQuantity(resolved.map((line) => line.quantity)),
			damagedQuantity: sumQuantity(resolved.map((line) => line.damagedQuantity)),
			outstandingQuantity: await this.outstandingFor(statuses)
		});
	}

	/**
	 * Records one further line against a receipt that was already posted.
	 *
	 * A delivery sometimes arrives in two lorries on one delivery note, and a receipt that had to be
	 * reversed and re-entered to record the second half would leave two compensating movements in the
	 * ledger for what was one delivery. The line goes through exactly the same checks as one written
	 * with a receipt: the same ceiling, the same movements, the same write-back to the order.
	 *
	 * @param receiptId The posted receipt to add the line to.
	 * @param input The line that arrived.
	 * @returns The receipt, carrying what the added line did.
	 * @throws ConflictException when the receipt is reversed, or the order it is against is finished.
	 */
	public async recordLine(receiptId: ID, input: IGoodsReceiptLineInput): Promise<GoodsReceiptPosting> {
		const receipt = await this.findOneDetailed(receiptId);

		if (receipt.status !== GoodsReceiptStatus.POSTED) {
			throw new ConflictException(
				`GOODS_RECEIPT_INVALID_STATE: receipt '${receipt.number}' was reversed, so nothing further can be recorded against it.`
			);
		}

		const orderLines = await this.purchaseOrderLineService.findIndexedByIds([input.purchaseOrderLineId]);

		// The line is settled before the anchor is: the order a line belongs to is discovered through the
		// line, so a name that resolves to nothing would otherwise be answered as a line of another order.
		this.resolveNamedLines([input], orderLines);

		const orders = new Map<ID, PurchaseOrder>();

		for (const orderLine of orderLines.values()) {
			// The same predicate the posting path uses: a line added to a posted receipt receives goods
			// exactly as the original delivery did, so it has to be refused for the same reasons.
			const order = await this.assertOrderReceivable(orderLine.purchaseOrderId);

			orders.set(order.id, order);
		}

		if (receipt.purchaseOrderId && !orders.has(receipt.purchaseOrderId)) {
			throw new ConflictException(
				`RECEIPT_ORDER_MISMATCH: line '${input.purchaseOrderLineId}' does not belong to purchase order '${receipt.purchaseOrderId}', which this receipt is anchored to.`
			);
		}

		const resolved = await this.resolveLines([input], orderLines, orders, undefined);

		this.assertLedgerFor(resolved);

		// One transaction, exactly as a whole delivery is: the line, its order line's counters, its stock
		// movements and its order's status are written together or not at all.
		const { movementIds, statuses } = await this.receiving(
			async (manager: EntityManager) => {
				// The receipt is locked before the orders, which is the order a reversal takes them in, and is
				// read again under that lock: a reversal that committed since the read above has taken the
				// receipt's goods back, and a line added after it would be stock nothing reverses.
				const current = await this.lockReceipt(manager, receipt.id);

				if (current?.status !== GoodsReceiptStatus.POSTED) {
					throw new ConflictException(
						`GOODS_RECEIPT_INVALID_STATE: receipt '${receipt.number}' was reversed, so nothing further can be recorded against it.`
					);
				}

				await this.lockReceivableOrders(manager, [...orders.keys()]);
				await this.claimCounters(resolved, manager);

				const lines = await this.receiptLineService.writeLines(
					receipt.id,
					resolved,
					{ tenantId: receipt.tenantId, organizationId: receipt.organizationId },
					manager
				);

				return {
					movementIds: await this.writeReceiptMovements(
						this.numberOf({} as IGoodsReceiptInput, orders),
						receipt,
						lines,
						this.currencyOf(orders),
						manager
					),
					statuses: await this.refreshOrders(resolved, manager)
				};
			}
		);

		const written = await this.findOneDetailed(receipt.id);

		return Object.assign(written, {
			movementIds,
			purchaseOrderStatus: receipt.purchaseOrderId ? statuses[receipt.purchaseOrderId] : undefined,
			purchaseOrderStatuses: statuses,
			receivedQuantity: sumQuantity(resolved.map((line) => line.quantity)),
			damagedQuantity: sumQuantity(resolved.map((line) => line.damagedQuantity)),
			outstandingQuantity: await this.outstandingFor(statuses)
		});
	}

	/**
	 * Records one line and answers with the line itself.
	 *
	 * The line surface returns a line, and a line written through it has to be written the same way as
	 * one written with its receipt — through the ceiling check and through the movement seam. This
	 * wraps `recordLine` rather than repeating it, and reads the line back by difference so the answer
	 * is the row that was just written rather than a guess at it.
	 *
	 * @param receiptId The posted receipt to add the line to.
	 * @param input The line that arrived.
	 * @returns The line that was written.
	 */
	public async recordSingleLine(receiptId: ID, input: IGoodsReceiptLineInput): Promise<GoodsReceiptLine> {
		const before = await this.receiptLineService.findForReceipt(receiptId);
		const known = new Set(before.map((line) => line.id));

		await this.recordLine(receiptId, input);

		const after = await this.receiptLineService.findForReceipt(receiptId);

		return after.find((line) => !known.has(line.id)) ?? after[after.length - 1];
	}

	/**
	 * Reverses a receipt.
	 *
	 * A receipt is never deleted or edited. Reversing it writes the compensating movements the ledger
	 * needs — a `WRITE_OFF` of exactly the good quantity the receipt added, at the same location — puts
	 * the received counters back on the orders' lines and refreshes those orders' statuses. The receipt
	 * itself stays readable, marked `CANCELED`, which is what keeps the original movements explained
	 * rather than orphaned.
	 *
	 * The damaged units of a reversed receipt are taken off the orders' counters but write no level
	 * movement, because the `DAMAGE` movement they produced never entered the sellable level: a
	 * compensating write-off would subtract units the level never gained.
	 *
	 * **The reversal is one transaction.** The status claim, the counters, each order's status and the
	 * compensating movements commit together or not at all, so a reversal that stops half way — a
	 * refusal, a failed movement, a process that dies — leaves the receipt `POSTED` with its stock and
	 * its counters exactly as they were, and a retry reverses it whole. It used to save `CANCELED` first
	 * and then take the stock back, so a process that stopped in between left a cancelled receipt whose
	 * stock was never taken back, and every later reversal returned at once because it was cancelled.
	 *
	 * @param id The receipt to reverse.
	 * @param reason Why it was reversed.
	 * @returns The reversed receipt, with its lines.
	 * @throws ConflictException when no inventory capability is registered and there are units to take
	 * back out of stock.
	 */
	public async reverse(id: ID, reason?: string): Promise<GoodsReceipt> {
		const receipt = await this.findOneDetailed(id);

		if (receipt.status === GoodsReceiptStatus.CANCELED) {
			return receipt;
		}

		const lines = receipt.lines ?? [];
		const warehouseId = receipt.warehouseId;

		if (lines.some((line) => toQuantityUnits(line.quantity) > 0n)) {
			if (!this.inventory) {
				throw new ConflictException(
					'PURCHASING_INVENTORY_UNAVAILABLE: the inventory capability is not registered, so the stock movements of a reversed receipt cannot be written.'
				);
			}

			if (!warehouseId) {
				throw new ConflictException(
					`RECEIPT_WAREHOUSE_REQUIRED: receipt '${receipt.number}' names no location, so its goods cannot be taken back out of stock.`
				);
			}
		}

		const occurredAt = new Date();
		const readVersion = receipt.version;
		const nextVersion = (readVersion ?? 1) + 1;
		const scope = this.statementScope();

		const reversed = await this.receiving(async (manager: EntityManager) => {
			// **The reversal is claimed before it is performed.** The status moves to `CANCELED` only while
			// the receipt is still `POSTED` at the version this call read, in one conditional statement, so
			// two reversals of one receipt that overlap cannot both write the compensating movements and both
			// take the quantity off the order lines: the second changes no row and is answered with the
			// receipt the first one reversed. The statement also takes the receipt's row lock, which is the
			// lock a line being added to the receipt holds first.
			const claimed = await manager.update(
				GoodsReceipt,
				{
					id,
					status: GoodsReceiptStatus.POSTED,
					version: readVersion === null || readVersion === undefined ? IsNull() : readVersion,
					...scope
				} as never,
				{
					status: GoodsReceiptStatus.CANCELED,
					canceledAt: occurredAt,
					note: reason ?? receipt.note,
					version: nextVersion
				} as never
			);

			if (readAffectedRows(claimed) === 0) {
				return false;
			}

			// The lines as they stand once the receipt is this transaction's: a line recorded against it after
			// the read above committed before the claim could take the lock, and is reversed with the rest.
			const held = (await manager.find(GoodsReceiptLine, { where: { receiptId: id, ...scope } as never })) as GoodsReceiptLine[];
			const orderLines = new Map<ID, PurchaseOrderLine>(
				(held.length
					? ((await manager.find(PurchaseOrderLine, {
							where: { id: In(held.map((line) => line.purchaseOrderLineId)), ...scope } as never
					  })) as PurchaseOrderLine[])
					: []
				).map((line) => [line.id, line])
			);

			await this.purchaseOrderService.lockForReceiving(
				manager,
				[...orderLines.values()].map((line) => line.purchaseOrderId)
			);

			// The counters and each order's status first, then the stock: the order rows, then the order lines,
			// then the levels — the order every receiving operation takes its locks in.
			await this.applyDeltas(
				held.map((line) => ({
					lineId: line.purchaseOrderLineId,
					receivedQuantity: negateQuantity(line.quantity),
					damagedQuantity: negateQuantity(line.damagedQuantity)
				})),
				held.map((line) => ({
					orderId: orderLines.get(line.purchaseOrderLineId)?.purchaseOrderId as ID,
					purchaseOrderLineId: line.purchaseOrderLineId
				})),
				orderLines,
				manager
			);

			for (const line of held) {
				if (toQuantityUnits(line.quantity) <= 0n) {
					continue;
				}

				if (!this.inventory || !warehouseId) {
					// Only reachable for a line recorded after the checks above read the receipt; refused on the
					// same terms, and the whole reversal with it.
					throw new ConflictException(
						`PURCHASING_INVENTORY_UNAVAILABLE: the stock movements of reversed receipt '${receipt.number}' cannot be written.`
					);
				}

				// **The units are taken out of the position the receipt put them in.** A line that names a bin had
				// its units put away there in the receipt's own transaction, so that bin is where they are; a line
				// that names none left them at the location's unaddressed position. A write-off with no bin used to
				// be written for both, so cancelling six units put into a bin took the location to zero while the
				// bin still reported six.
				const binId = line.warehouseBinId ?? undefined;

				await this.inventory.recordMovement(
					{
						warehouseId,
						variantId: line.variantId,
						quantity: negateQuantity(line.quantity),
						kind: StockMovementKind.WRITE_OFF,
						...(binId ? { binId } : {}),
						referenceType: MOVEMENT_REFERENCE,
						referenceId: line.id,
						reason: reason ?? RECEIPT_CANCELED,
						batchNumber: line.batchNumber,
						expiresAt: line.expiresAt,
						occurredAt
					},
					manager
				);

				await this.assertPositionHeld(manager, receipt, line, warehouseId, binId);
			}

			return true;
		});

		if (!reversed) {
			const current = await this.findOneDetailed(id);

			if (current.status === GoodsReceiptStatus.CANCELED) {
				return current;
			}

			throw new ConflictException(
				`GOODS_RECEIPT_VERSION_CONFLICT: goods receipt '${receipt.number}' changed while it was being reversed. Read it again and reverse it again.`
			);
		}

		return await this.findOneDetailed(id);
	}

	/**
	 * Reads a receipt with everything a detail view shows.
	 *
	 * @param id The receipt to read.
	 * @returns The receipt and its lines.
	 * @throws NotFoundException when it is not the caller's.
	 */
	public async findOneDetailed(id: ID): Promise<GoodsReceipt> {
		const receipt = await this.typeOrmGoodsReceiptRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			relations: { lines: true, warehouse: true }
		});

		if (!receipt) {
			throw new NotFoundException(`GOODS_RECEIPT_NOT_FOUND: goods receipt '${id}' could not be found.`);
		}

		return receipt;
	}

	/**
	 * Sums what a purchase order is still waiting for.
	 *
	 * The figure is derived from the order's own lines rather than accumulated from the receipts, so it
	 * cannot drift from the counters a reversal put back.
	 *
	 * @param purchaseOrderId The order to total.
	 * @returns The outstanding quantity, as an exact decimal.
	 */
	public async outstandingQuantity(purchaseOrderId: ID): Promise<DecimalString> {
		const lines = await this.purchaseOrderLineService.findForOrder(purchaseOrderId);

		return sumQuantity(
			lines.map((line) => {
				const settled = sumQuantity([line.receivedQuantity, line.damagedQuantity]);

				return isGreaterThanQuantity(settled, line.quantity)
					? '0'
					: sumQuantity([line.quantity, negateQuantity(settled)]);
			})
		);
	}

	/**
	 * Resolves the over-shipment allowance a line is received under.
	 *
	 * The chain, in order: what the caller states for this delivery, then the fraction the line's own
	 * winning term negotiated, then the organization's `purchasing.overReceiptTolerancePercent` setting,
	 * then the order's own configured allowance, and none of them means no allowance at all. The term
	 * comes first because it is the most specific statement anyone has made about this product from this
	 * supplier, and it is read through the line's recorded provenance rather than by resolving the
	 * agreement again — a term renegotiated since the order was placed does not move the allowance the
	 * order was raised under.
	 *
	 * @param orderLine The order line being received.
	 * @param order The order it belongs to, when it is known.
	 * @param stated The allowance the caller stated for this delivery, when it stated one.
	 * @returns The allowance, as an exact decimal fraction.
	 */
	public async resolveOverReceiptTolerance(
		orderLine: Pick<PurchaseOrderLine, 'vendorTermId'>,
		order?: Pick<PurchaseOrder, 'metadata'>,
		stated?: DecimalString | number
	): Promise<DecimalString> {
		const fromCaller = this.statedFraction(stated);

		if (fromCaller !== undefined) {
			return fromCaller;
		}

		const fromTerm = await this.vendorProductTermService.overReceiptTolerancePercentOf(orderLine.vendorTermId);

		if (fromTerm !== undefined) {
			return fromTerm;
		}

		const fromSetting = this.statedFraction(await this.overReceiptSetting());

		if (fromSetting !== undefined) {
			return fromSetting;
		}

		const configured = (order?.metadata ?? {})['overReceiptTolerance'] as DecimalString | undefined;

		return this.statedFraction(configured) ?? '0';
	}

	/**
	 * Reads the order line each named line resolves to, refusing a delivery that names one it cannot
	 * receive against.
	 *
	 * This is asked before anything else is decided from the lines, because everything else is derived
	 * from them: the orders a delivery touches are the orders of its order lines, and an anchored
	 * delivery's location is inherited from its order rather than stated. A name that resolves to
	 * nothing therefore leaves both questions without a premise, and answering either of them first
	 * names a consequence — a location nobody stated, an order the line does not appear to belong to —
	 * instead of the line that could not be resolved, sending the operator to fix something that is not
	 * wrong. The line is what is missing, so the line is what is named.
	 *
	 * @param inputs The lines the caller named.
	 * @param orderLines The order lines those names resolved to.
	 * @returns The order lines, in the order the caller named them.
	 * @throws NotFoundException when a named line is not one the caller may receive against.
	 */
	private resolveNamedLines(
		inputs: IGoodsReceiptLineInput[],
		orderLines: Map<ID, PurchaseOrderLine>
	): PurchaseOrderLine[] {
		return inputs.map((input) => {
			const orderLine = orderLines.get(input.purchaseOrderLineId);

			if (!orderLine) {
				throw new NotFoundException(
					`PURCHASE_ORDER_LINE_NOT_FOUND: order line '${input.purchaseOrderLineId}' could not be found in this organization.`
				);
			}

			return orderLine;
		});
	}

	/**
	 * Resolves and validates the requested lines against the order lines they name.
	 *
	 * @param inputs The requested lines.
	 * @param orderLines The order lines, keyed by id.
	 * @param orders The orders those lines belong to, keyed by id.
	 * @param stated The allowance the caller stated for this delivery, when it stated one.
	 * @returns The lines to write.
	 * @throws NotFoundException when a line is not one the caller may receive against.
	 * @throws BadRequestException when a line carries no quantity at all.
	 * @throws ConflictException when a line would exceed its allowance.
	 */
	private async resolveLines(
		inputs: IGoodsReceiptLineInput[],
		orderLines: Map<ID, PurchaseOrderLine>,
		orders: Map<ID, PurchaseOrder>,
		stated?: DecimalString | number
	): Promise<IResolvedReceiptLine[]> {
		const named = this.resolveNamedLines(inputs, orderLines);
		const resolved: IResolvedReceiptLine[] = [];
		// What the delivery brings to each order line so far. A line may be recorded in several entries —
		// two batches, two bins — and its ceiling is measured against what the delivery brings in total:
		// two entries of six against an order line of ten are twelve, however reasonable each looks alone.
		const arrivingByLine = new Map<string, DecimalString>();

		for (const [index, input] of inputs.entries()) {
			const orderLine = named[index];

			if (!orderLine.variantId) {
				throw new ConflictException(
					`PURCHASE_ORDER_LINE_VARIANT_MISSING: order line '${orderLine.id}' names no variant, so nothing can be received against it.`
				);
			}

			const quantity = normalizeQuantity(input.quantity ?? 0);
			const damagedQuantity = normalizeQuantity(input.damagedQuantity ?? 0);
			const arriving = sumQuantity([quantity, damagedQuantity]);

			if (toQuantityUnits(arriving) <= 0n) {
				throw new BadRequestException(
					`Order line '${orderLine.id}' is being received with no quantity at all.`
				);
			}

			const arrivingTogether = sumQuantity([arrivingByLine.get(String(orderLine.id)) ?? '0', arriving]);

			arrivingByLine.set(String(orderLine.id), arrivingTogether);

			const alreadyReceived = sumQuantity([orderLine.receivedQuantity, orderLine.damagedQuantity]);
			const afterThisReceipt = sumQuantity([alreadyReceived, arrivingTogether]);
			const tolerance = await this.resolveOverReceiptTolerance(
				orderLine,
				orders.get(orderLine.purchaseOrderId),
				stated
			);
			const ceiling = quantityWithTolerance(orderLine.quantity, tolerance);

			if (isGreaterThanQuantity(afterThisReceipt, ceiling)) {
				throw new ConflictException(
					`${PurchasingCodes.RECEIPT_OVER_TOLERANCE}: PO line '${orderLine.id}' was ordered in quantity ${orderLine.quantity}, ` +
						`${alreadyReceived} has already been received and ${arrivingTogether} more would exceed the over-receipt allowance of ${tolerance} in force for it.`
				);
			}

			resolved.push({
				orderId: orderLine.purchaseOrderId,
				purchaseOrderLineId: orderLine.id,
				variantId: orderLine.variantId,
				quantity,
				damagedQuantity,
				unitCost:
					input.unitCost === undefined || input.unitCost === null || String(input.unitCost) === ''
						? orderLine.unitCost
						: normalizeQuantity(input.unitCost),
				batchNumber: input.batchNumber,
				expiresAt: input.expiresAt,
				warehouseBinId: input.warehouseBinId,
				note: input.note,
				ceiling,
				tolerance
			});
		}

		return resolved;
	}

	/**
	 * Refuses a delivery with units to move when no inventory capability is registered, before anything
	 * is claimed or written.
	 *
	 * "A receipt whose goods never became sellable is worse than a receipt that did not happen": the
	 * refusal used to come from the movement step, after the receipt and its lines had been written, so
	 * the refused delivery left a posted receipt behind it.
	 *
	 * @param resolved The lines of the delivery.
	 * @throws ConflictException with `PURCHASING_INVENTORY_UNAVAILABLE`.
	 */
	private assertLedgerFor(resolved: IResolvedReceiptLine[]): void {
		const hasGoods = resolved.some(
			(line) => toQuantityUnits(line.quantity) > 0n || toQuantityUnits(line.damagedQuantity) > 0n
		);

		if (hasGoods && !this.inventory) {
			throw new ConflictException(
				'PURCHASING_INVENTORY_UNAVAILABLE: the inventory capability is not registered, so the goods received cannot be written to stock.'
			);
		}
	}

	/**
	 * Claims what a delivery brings against its order lines' counters, under their row locks and
	 * against each line's ceiling as the counters stand there, all lines in one write.
	 *
	 * @param resolved The lines of the delivery, each carrying its ceiling.
	 * @throws ConflictException with `RECEIPT_OVER_TOLERANCE` when a line would pass its ceiling.
	 */
	private async claimCounters(resolved: IResolvedReceiptLine[], manager?: EntityManager): Promise<void> {
		await this.purchaseOrderLineService.claimReceiptDeltas(
			resolved.map((line) => ({
				lineId: line.purchaseOrderLineId,
				purchaseOrderId: line.orderId,
				receivedQuantity: line.quantity,
				damagedQuantity: line.damagedQuantity,
				ceiling: line.ceiling,
				tolerance: line.tolerance
			})),
			manager
		);
	}

	/**
	 * Locks the orders a delivery receives against, on its transaction, and makes the refusals
	 * {@link assertOrderReceivable} made on an earlier read again on the rows as they stand under the
	 * lock: an order cancelled, closed or completed between the two is not received against.
	 *
	 * @param manager The delivery's transaction.
	 * @param orderIds The orders the delivery touches.
	 * @param anchoredOrderId The order the receipt is anchored to, when it is.
	 * @param expectedVersion The version the caller read of the anchored order, when it stated one.
	 * @throws ConflictException when an order may no longer be received against.
	 */
	private async lockReceivableOrders(
		manager: EntityManager,
		orderIds: ID[],
		anchoredOrderId?: ID,
		expectedVersion?: number
	): Promise<void> {
		const locked = await this.purchaseOrderService.lockForReceiving(manager, orderIds);

		for (const order of locked.values()) {
			if (order.status === PurchaseOrderStatus.CANCELED || order.status === PurchaseOrderStatus.CLOSED) {
				throw new ConflictException(
					`PURCHASE_ORDER_INVALID_STATE: purchase order '${order.number}' is ${order.status}, so nothing further can be received against it.`
				);
			}

			this.purchaseOrderService.assertReceivableState(
				order,
				anchoredOrderId && String(anchoredOrderId) === String(order.id) ? expectedVersion : undefined
			);
		}
	}

	/**
	 * Refuses a reversal whose write-off took a position below nothing: the units the receipt put there
	 * are no longer all there.
	 *
	 * **Units that moved on are not taken out of somewhere else.** A warehouse that relocated part of a
	 * receipt to another bin, put an unaddressed delivery away, or picked from it since has the units at
	 * a position the receipt does not name, and nothing here can tell which of them are this receipt's.
	 * Writing them off from the receipt's position anyway would leave that position negative and the
	 * other one holding goods the location no longer has; picking a different position would be a guess.
	 * The reversal is refused instead, the whole of it, and the operator moves the units back (or adjusts
	 * them) before reversing. The read runs on the reversal's transaction, after its own write-off took
	 * the level lock, so no other movement of the variant at the location can pass between the two.
	 *
	 * @param manager The reversal's transaction.
	 * @param receipt The receipt being reversed.
	 * @param line The line just written off.
	 * @param warehouseId The receipt's location.
	 * @param binId The position the write-off was taken from: the line's bin, or none.
	 * @throws ConflictException with `RECEIPT_STOCK_MOVED`.
	 */
	private async assertPositionHeld(
		manager: EntityManager,
		receipt: GoodsReceipt,
		line: GoodsReceiptLine,
		warehouseId: ID,
		binId?: ID
	): Promise<void> {
		const left = await this.inventory.readPositionBalance({ warehouseId, variantId: line.variantId, binId }, manager);

		if (toQuantityUnits(left) >= 0n) {
			return;
		}

		const held = sumQuantity([left, line.quantity]);
		const position = binId ? `bin '${binId}'` : 'the receiving area (no bin)';

		throw new ConflictException({
			message:
				`RECEIPT_STOCK_MOVED: receipt '${receipt.number}' put ${line.quantity} of variant '${line.variantId}' into ${position}, ` +
				`which now holds ${held}; the rest has been moved or used since. Move the units back to ${position}, or adjust ` +
				`the stock, before reversing the receipt. Nothing was written.`,
			code: 'RECEIPT_STOCK_MOVED',
			details: { goodsReceiptId: receipt.id, goodsReceiptLineId: line.id, variantId: line.variantId, binId: binId ?? null, held, required: line.quantity }
		});
	}

	/**
	 * Runs one receiving operation as one transaction, from the start again when an order line it
	 * claimed moved under it.
	 *
	 * Every attempt is a new transaction, so it reads the counters, the orders and the receipt as they
	 * now stand and decides again — the ceiling included — rather than writing a decision an earlier read
	 * made. Nothing of an attempt that did not commit is left behind.
	 *
	 * @param work The operation, on the transaction it is handed.
	 * @returns What the committed attempt answered.
	 * @throws ConflictException with `PURCHASE_ORDER_LINE_CONFLICT` when the lines kept moving.
	 */
	private async receiving<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
		for (let attempt = 1; ; attempt++) {
			try {
				return await this.typeOrmGoodsReceiptRepository.manager.transaction(work);
			} catch (error) {
				if (!(error instanceof ReceivedCountersMovedError)) {
					throw error;
				}

				if (attempt >= RECEIVING_ATTEMPTS) {
					throw new ConflictException(
						`PURCHASE_ORDER_LINE_CONFLICT: the received quantities of the order lines were moved by another write on each of ${RECEIVING_ATTEMPTS} attempts, so nothing was written. Try again.`
					);
				}
			}
		}
	}

	/**
	 * Reads a receipt of the caller's on a transaction and holds its row until the transaction ends.
	 *
	 * @param manager The open transaction.
	 * @param id The receipt.
	 * @returns The receipt as it stands under its lock, or null when it is not the caller's.
	 */
	private async lockReceipt(manager: EntityManager, id: ID): Promise<GoodsReceipt | null> {
		return (await manager.findOne(GoodsReceipt, {
			where: { id, ...this.statementScope() } as never,
			...(this.takesRowLocks(manager) ? { lock: { mode: 'pessimistic_write' as const } } : {})
		})) as GoodsReceipt | null;
	}

	/**
	 * @returns The caller's tenant and organization, each only when the request states it.
	 */
	private statementScope(): Record<string, unknown> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		return {
			...(tenantId ? { tenantId } : {}),
			...(organizationId ? { organizationId } : {})
		};
	}

	/**
	 * @param manager An open transaction.
	 * @returns Whether the dialect behind it has row locks to take; SQLite's single writer is its lock.
	 */
	private takesRowLocks(manager: EntityManager): boolean {
		const type = manager.connection?.options?.type as string | undefined;

		return type === DatabaseTypeEnum.postgres || type === DatabaseTypeEnum.mysql;
	}

	/**
	 * Gives back what {@link claimCounters} claimed, for a delivery that could not be recorded.
	 *
	 * The failure that brought the caller here is the one it reports; a release that fails as well is
	 * logged rather than raised over it, because the caller's own error is what explains the request.
	 *
	 * @param resolved The lines of the delivery.
	 */
	private async releaseCounters(resolved: IResolvedReceiptLine[]): Promise<void> {
		try {
			await this.purchaseOrderLineService.claimReceiptDeltas(
				resolved.map((line) => ({
					lineId: line.purchaseOrderLineId,
					purchaseOrderId: line.orderId,
					receivedQuantity: negateQuantity(line.quantity),
					damagedQuantity: negateQuantity(line.damagedQuantity)
				}))
			);
		} catch (error) {
			this.logger.error('The received quantities a failed delivery claimed could not be given back', error);
		}
	}

	/**
	 * Refreshes the status of every order a delivery touched from what its lines now say.
	 *
	 * @param resolved The lines of the delivery.
	 * @param manager The delivery's transaction, when the statuses commit with it.
	 * @returns The status of every order after the operation, keyed by id.
	 */
	private async refreshOrders(
		resolved: Array<Pick<IResolvedReceiptLine, 'orderId'>>,
		manager?: EntityManager
	): Promise<Record<string, PurchaseOrderStatus>> {
		const statuses: Record<string, PurchaseOrderStatus> = {};

		for (const orderId of new Set(resolved.map((line) => line.orderId))) {
			const updated = await this.purchaseOrderService.refreshReceiptState(orderId, manager);

			statuses[orderId] = updated.status;
		}

		return statuses;
	}

	/**
	 * Reads one order and refuses it when goods may not be received against it.
	 *
	 * **Every order a delivery touches goes through this, anchored or not.** It did not used to: the
	 * order a receipt named reached `PurchaseOrderService.assertReceivable`, and a consolidated delivery
	 * — the routine case, which names no order at all — was gated on nothing but `CANCELED` and
	 * `CLOSED`. `assertReceivable` refuses three more things that gate missed: an order still in `DRAFT`,
	 * which was never approved and never sent to the supplier; one already `RECEIVED`, which has nothing
	 * left to arrive; and any status outside the receivable set. So a receipt posted with no
	 * `purchaseOrderId` against a line of a draft order wrote `RECEIPT` movements that incremented stock
	 * and moved that order from `DRAFT` straight to `PARTIALLY_RECEIVED` — stepping around the approval
	 * gate `send()` enforces — and the same call against a `RECEIVED` order received it a second time.
	 *
	 * The finished-order refusal is made here rather than being left to `assertReceivable`, because the
	 * two answer a `CLOSED` order differently and this surface's answer is the accurate one: an order
	 * closed short of its quantity is in a state nothing may be received against, which is not the same
	 * fact as an order that has already been received in full. Both codes are part of the wire contract
	 * and both keep the meaning they have always had here.
	 *
	 * @param orderId The order behind a line of the delivery.
	 * @param expectedVersion The version the caller read, for the order the receipt is anchored to.
	 * @returns The order.
	 * @throws ConflictException when the order is finished, was never sent, is already received, or has
	 * moved past the version the caller stated.
	 */
	private async assertOrderReceivable(orderId: ID, expectedVersion?: number): Promise<PurchaseOrder> {
		const order = await this.purchaseOrderService.findOneScoped(orderId);

		if (order.status === PurchaseOrderStatus.CANCELED || order.status === PurchaseOrderStatus.CLOSED) {
			throw new ConflictException(
				`PURCHASE_ORDER_INVALID_STATE: purchase order '${order.number}' is ${order.status}, so nothing further can be received against it.`
			);
		}

		return await this.purchaseOrderService.assertReceivable(orderId, expectedVersion);
	}

	/**
	 * Reads the orders a delivery touches, and refuses the ones it cannot be received against.
	 *
	 * A delivery anchored to an order is checked exactly as it always was: the order has to be receivable
	 * and the version the caller read has to be the current one. A consolidated delivery names no order,
	 * so it is checked line by line instead — every line's own order has to pass the same predicate —
	 * and every line has to belong to the anchored order when there is one.
	 *
	 * @param input The delivery.
	 * @param orderLines The order lines it names.
	 * @returns The orders, keyed by id.
	 * @throws ConflictException when the lines of an anchored receipt span more than one order, or one of
	 * the orders cannot be received against.
	 */
	private async resolveOrders(
		input: IGoodsReceiptInput,
		orderLines: Map<ID, PurchaseOrderLine>
	): Promise<Map<ID, PurchaseOrder>> {
		const orderIds = new Set<ID>();

		for (const orderLine of orderLines.values()) {
			if (input.purchaseOrderId && String(orderLine.purchaseOrderId) !== String(input.purchaseOrderId)) {
				throw new ConflictException(
					`RECEIPT_ORDER_MISMATCH: line '${orderLine.id}' belongs to another purchase order, and this receipt is anchored to '${input.purchaseOrderId}'.`
				);
			}

			orderIds.add(orderLine.purchaseOrderId);
		}

		const orders = new Map<ID, PurchaseOrder>();

		for (const orderId of orderIds) {
			// **Every order a delivery touches is checked with the same predicate.** Only the version
			// precondition stays specific to the anchored order: the caller read one order and can only
			// state that one's version.
			const order = await this.assertOrderReceivable(
				orderId,
				input.purchaseOrderId && String(input.purchaseOrderId) === String(orderId)
					? input.expectedVersion
					: undefined
			);

			orders.set(order.id, order);
		}

		return orders;
	}

	/**
	 * Resolves the location the goods arrived at.
	 *
	 * A receipt anchored to an order inherits that order's location and refuses a different one. A
	 * consolidated receipt states its own, and every order its lines belong to has to have that same
	 * location: receiving a consolidated delivery into one building while its orders expect another is a
	 * transfer between locations, not a receipt.
	 *
	 * @param input The delivery.
	 * @param orderLines The order lines it names.
	 * @param orders The orders behind them.
	 * @returns The receiving location.
	 * @throws ConflictException when no location is stated or a location differs.
	 */
	private resolveWarehouse(
		input: IGoodsReceiptInput,
		orderLines: Map<ID, PurchaseOrderLine>,
		orders: Map<ID, PurchaseOrder>
	): ID {
		const stated = input.warehouseId;
		const anchored = input.purchaseOrderId ? orders.get(input.purchaseOrderId) : undefined;
		const warehouseId = stated ?? anchored?.warehouseId;

		if (!warehouseId) {
			throw new ConflictException(
				'RECEIPT_WAREHOUSE_REQUIRED: a goods receipt must name the location the goods arrived at.'
			);
		}

		for (const orderLine of orderLines.values()) {
			const order = orders.get(orderLine.purchaseOrderId);

			if (order?.warehouseId && String(order.warehouseId) !== String(warehouseId)) {
				throw new ConflictException(
					`RECEIPT_WAREHOUSE_MISMATCH: purchase order '${order.number}' receives at ${order.warehouseId}, so its goods cannot be received at ${warehouseId}.`
				);
			}
		}

		return warehouseId;
	}

	/**
	 * Applies a signed change to the received counters and refreshes every order the delivery touched.
	 *
	 * The counters are written per order, because a consolidated delivery moves several orders at once,
	 * and each order's status is then recomputed from its own lines — never incremented, so a reversal
	 * leaves no trace on the status.
	 *
	 * @param deltas The signed changes, per order line.
	 * @param resolved The resolved lines, which say which order each line belongs to.
	 * @param orderLines The order lines the delivery names.
	 * @param manager The operation's transaction, when the counters and the statuses commit with it.
	 * @returns The status of every order after the operation, keyed by id.
	 */
	private async applyDeltas(
		deltas: IPurchaseOrderLineDelta[],
		resolved: Array<Pick<IResolvedReceiptLine, 'orderId' | 'purchaseOrderLineId'>>,
		orderLines: Map<ID, PurchaseOrderLine>,
		manager?: EntityManager
	): Promise<Record<string, PurchaseOrderStatus>> {
		const orderOf = new Map<ID, ID>();

		for (const line of resolved) {
			orderOf.set(line.purchaseOrderLineId, line.orderId);
		}

		const byOrder = new Map<ID, IPurchaseOrderLineDelta[]>();

		for (const delta of deltas) {
			const orderId = orderOf.get(delta.lineId) ?? orderLines.get(delta.lineId)?.purchaseOrderId;

			if (!orderId) {
				continue;
			}

			byOrder.set(orderId, [...(byOrder.get(orderId) ?? []), delta]);
		}

		const statuses: Record<string, PurchaseOrderStatus> = {};

		for (const [orderId, orderDeltas] of byOrder) {
			await this.purchaseOrderLineService.applyReceiptDeltas(orderId, orderDeltas, manager);

			const updated = await this.purchaseOrderService.refreshReceiptState(orderId, manager);

			statuses[orderId] = updated.status;
		}

		return statuses;
	}

	/**
	 * Sums what every order behind a delivery is still waiting for.
	 *
	 * @param statuses The orders the operation touched, keyed by id.
	 * @returns The outstanding quantity across them, as an exact decimal.
	 */
	private async outstandingFor(statuses: Record<string, PurchaseOrderStatus>): Promise<DecimalString> {
		const totals: DecimalString[] = [];

		for (const orderId of Object.keys(statuses)) {
			totals.push(await this.outstandingQuantity(orderId));
		}

		return sumQuantity(totals);
	}

	/**
	 * Reads the single currency the delivery's amounts are in.
	 *
	 * A receipt whose lines span several orders states its movement reasons in one currency, which is the
	 * anchored order's; a consolidated delivery has no single order, so the currency of the first order it
	 * touches is used and the reason is read as documentation rather than as an amount. The money of the
	 * delivery itself is on the orders' lines, in each order's own currency.
	 *
	 * @param orders The orders the delivery touches.
	 * @returns The currency, or undefined when there is none to name.
	 */
	private currencyOf(orders: Map<ID, PurchaseOrder>): CurrencyCode | undefined {
		const first = [...orders.values()][0];

		return first?.currency as CurrencyCode | undefined;
	}

	/**
	 * @param input The delivery.
	 * @param orders The orders it touches.
	 * @returns The number the movements' reasons quote: the anchored order's, or the first order's of a
	 * consolidated delivery.
	 */
	private numberOf(input: IGoodsReceiptInput, orders: Map<ID, PurchaseOrder>): string {
		const anchored = input.purchaseOrderId ? orders.get(input.purchaseOrderId) : undefined;
		const order = anchored ?? [...orders.values()][0];

		return order?.number ?? '';
	}

	/**
	 * Reads the organization's standing over-shipment allowance.
	 *
	 * @returns The configured fraction, or undefined when the organization states none. A setting that is
	 * absent is not an error: it means no organization-wide allowance, and the chain falls through to the
	 * order's own.
	 */
	private async overReceiptSetting(): Promise<DecimalString | undefined> {
		try {
			const resolved = await this.tenantSettingService.getResolvedSettings(
				[OVER_RECEIPT_SETTING],
				RequestContext.currentTenantId()
			);

			return resolved?.[OVER_RECEIPT_SETTING] as DecimalString | undefined;
		} catch (error) {
			// A settings read that fails must not refuse a delivery: the allowance falls through to the
			// order's own, which is what an organization that configured neither expects.
			return undefined;
		}
	}

	/**
	 * @param value A fraction a caller or a setting may or may not have stated.
	 * @returns The fraction at the storage scale, or undefined when nothing was stated.
	 */
	private statedFraction(value?: DecimalString | number | null): DecimalString | undefined {
		if (value === undefined || value === null || String(value).trim() === '') {
			return undefined;
		}

		return normalizeQuantity(value);
	}

	/**
	 * Writes the stock movements a receipt produced, through the inventory capability.
	 *
	 * One movement per line and disposition: the good units are a `RECEIPT` that increments the level
	 * and are linked back to the line through `stockMovementId`; the damaged units are a `DAMAGE` that
	 * records them without ever making them sellable. A line that names a bin then asks the same
	 * capability to put the good units away, linked to the movement they arrived under.
	 *
	 * @param purchaseOrderNumber The order's number, kept in the movement's reason so the ledger reads
	 * without a join.
	 * @param receipt The receipt being written.
	 * @param lines The receipt lines.
	 * @param currency The order's currency, which the damaged-units note records.
	 * @param manager The receipt's transaction: every movement, stamp and put-away is written on it, so
	 * the stock commits with the receipt it belongs to or not at all.
	 * @returns The movement ids the capability wrote.
	 * @throws ConflictException when there is something to move and no capability is registered.
	 */
	private async writeReceiptMovements(
		purchaseOrderNumber: string,
		receipt: GoodsReceipt,
		lines: GoodsReceiptLine[],
		currency?: CurrencyCode,
		manager?: EntityManager
	): Promise<ID[]> {
		const hasGoods = lines.some(
			(line) => toQuantityUnits(line.quantity) > 0n || toQuantityUnits(line.damagedQuantity) > 0n
		);

		if (!hasGoods) {
			return [];
		}

		if (!this.inventory) {
			throw new ConflictException(
				'PURCHASING_INVENTORY_UNAVAILABLE: the inventory capability is not registered, so the goods received cannot be written to stock.'
			);
		}

		const warehouseId = receipt.warehouseId as ID;
		const movementIds: ID[] = [];

		for (const line of lines) {
			const good = toQuantityUnits(line.quantity) > 0n;
			const damaged = toQuantityUnits(line.damagedQuantity) > 0n;
			// The movement the good units arrived under, held in the loop rather than read back off the
			// line. `stampMovement` writes the column on its OWN copy of the row and answers with it; it
			// does not mutate the object this loop is iterating, so `line.stockMovementId` was still
			// `undefined` when the put-away below read it — the line came from `writeLines`, which creates
			// it before any movement exists. The bin transfer therefore carried no link to the movement the
			// units arrived under, which is exactly the link this method's contract promises.
			let receiptMovementId: ID | undefined;

			if (good) {
				const result = await this.inventory.recordMovement({
					warehouseId,
					variantId: line.variantId,
					quantity: line.quantity,
					kind: StockMovementKind.RECEIPT,
					referenceType: MOVEMENT_REFERENCE,
					referenceId: line.id,
					reason: `Goods received against purchase order ${purchaseOrderNumber}.`,
					batchNumber: line.batchNumber,
					expiresAt: line.expiresAt,
					occurredAt: receipt.receivedAt
				}, manager);

				if (result?.movementId) {
					const stamped = await this.receiptLineService.stampMovement(line.id, result.movementId, manager);

					receiptMovementId = stamped?.stockMovementId ?? result.movementId;
					line.stockMovementId = receiptMovementId;
					movementIds.push(result.movementId);
				}
			}

			if (damaged) {
				const result = await this.inventory.recordMovement({
					warehouseId,
					variantId: line.variantId,
					quantity: line.damagedQuantity,
					kind: StockMovementKind.DAMAGE,
					// The units never entered sellable stock, so the movement is an event: the ledger keeps the
					// quantity in the row's note and leaves the level, and every bin, where they were. Stated
					// without it, the ledger applies a `DAMAGE` like any other delta, and a unit that arrived
					// broken was counted as stock the location could sell.
					eventOnly: true,
					referenceType: MOVEMENT_REFERENCE,
					referenceId: line.id,
					reason: `Damaged on receipt against purchase order ${purchaseOrderNumber} (${currency ?? ''}).`,
					batchNumber: line.batchNumber,
					expiresAt: line.expiresAt,
					occurredAt: receipt.receivedAt
				}, manager);

				if (result?.movementId) {
					movementIds.push(result.movementId);
				}
			}

			if (good && line.warehouseBinId) {
				await this.inventory.putAway(
					{
						warehouseId,
						binId: line.warehouseBinId,
						variantId: line.variantId,
						quantity: line.quantity,
						stockMovementId: receiptMovementId,
						// The ledger records every movement under the concept that asked for it, and refuses a walk
						// that names none — which every put-away of a receipt used to be.
						referenceType: MOVEMENT_REFERENCE,
						referenceId: line.id,
						reason: `Put-away of goods received against purchase order ${purchaseOrderNumber}.`
					},
					manager
				);
			}
		}

		return movementIds;
	}

	/**
	 * Allocates the next receipt number from the platform numbering series.
	 *
	 * @returns The formatted number.
	 * @throws ConflictException when the organization has no series for the key.
	 */
	private async allocateNumber(): Promise<string> {
		try {
			const allocated = await this.sequenceService.allocate(GOODS_RECEIPT_NUMBER_KEY);

			return allocated.formatted;
		} catch (error) {
			/*
			 * Only the absence of a series is this message's to report. Catching everything answered "no
			 * series is configured" for any failure at all — a contention timeout, a database error — so a
			 * broken allocation was reported as a misconfiguration and the real cause was never seen.
			 */
			if (error instanceof NotFoundException) {
				throw new ConflictException(
					`GOODS_RECEIPT_SEQUENCE_MISSING: no numbering series is configured for goods receipts (key "${GOODS_RECEIPT_NUMBER_KEY}"), so a number cannot be allocated.`
				);
			}

			throw error;
		}
	}
}
