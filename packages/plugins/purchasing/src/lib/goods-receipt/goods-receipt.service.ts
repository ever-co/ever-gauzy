import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import { RequestContext, SequenceService, TenantAwareCrudService, TenantSettingService } from '@gauzy/core';
import {
	GoodsReceiptStatus,
	IGoodsReceipt,
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
	PurchaseOrderLineService
} from '../purchase-order-line/purchase-order-line.service';
import { PurchaseOrder } from '../purchase-order/purchase-order.entity';
import { PurchaseOrderService } from '../purchase-order/purchase-order.service';
import { VendorProductTermService } from '../vendor-product-term/vendor-product-term.service';
import { GoodsReceipt } from './goods-receipt.entity';
import { MikroOrmGoodsReceiptRepository } from './repository/mikro-orm-goods-receipt.repository';
import { TypeOrmGoodsReceiptRepository } from './repository/type-orm-goods-receipt.repository';

/** The series key goods-receipt numbers are allocated from. */
const GOODS_RECEIPT_NUMBER_KEY = 'RECEIPT';

/** The concept this domain writes its movements under. */
const MOVEMENT_REFERENCE = 'GOODS_RECEIPT';

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
 * elsewhere is a transfer rather than a receipt.
 *
 * Put-away is the same seam as the movement: a line that carries a bin asks the capability to walk the
 * units from the receiving area into that bin, linked to the movement the line produced.
 */
@Injectable()
export class GoodsReceiptService extends TenantAwareCrudService<GoodsReceipt> {
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
	 * Receives goods.
	 *
	 * The order is validated first — it has to be sent, and it has to have something left to receive —
	 * then every line is resolved against its own order line and checked against its ceiling before
	 * anything is written. Only then is the receipt written, its movements recorded through the
	 * inventory capability, the received counters written back to the orders' lines and each order's
	 * status refreshed from what those counters now say.
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
	 * @throws NotFoundException when a line does not belong to the order it is received against.
	 * @throws BadRequestException when a line carries no quantity at all.
	 */
	public async receive(input: IGoodsReceiptInput): Promise<GoodsReceiptPosting> {
		if (!Array.isArray(input.lines) || input.lines.length === 0) {
			throw new BadRequestException('A goods receipt needs at least one line.');
		}

		const orderLines = await this.purchaseOrderLineService.findIndexedByIds(
			input.lines.map((line) => line.purchaseOrderLineId)
		);
		const orders = await this.resolveOrders(input, orderLines);
		const warehouseId = this.resolveWarehouse(input, orderLines, orders);
		const resolved = await this.resolveLines(input.lines, orderLines, orders, input.overReceiptTolerance);
		const number = await this.allocateNumber();
		const currency = this.currencyOf(orders);

		const receipt = await super.create({
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
		} as any);

		const lines = await this.receiptLineService.writeLines(receipt.id, resolved);
		const movementIds = await this.writeReceiptMovements(this.numberOf(input, orders), receipt, lines, currency);

		const statuses = await this.applyDeltas(
			resolved.map((line) => ({
				lineId: line.purchaseOrderLineId,
				receivedQuantity: line.quantity,
				damagedQuantity: line.damagedQuantity
			})),
			resolved,
			orderLines
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
		const orders = new Map<ID, PurchaseOrder>();

		for (const orderLine of orderLines.values()) {
			const order = await this.purchaseOrderService.findOneScoped(orderLine.purchaseOrderId);

			if (
				order.status === PurchaseOrderStatus.CANCELED ||
				order.status === PurchaseOrderStatus.CLOSED
			) {
				throw new ConflictException(
					`PURCHASE_ORDER_INVALID_STATE: purchase order '${order.number}' is ${order.status}, so nothing further can be received against it.`
				);
			}

			orders.set(order.id, order);
		}

		if (receipt.purchaseOrderId && !orders.has(receipt.purchaseOrderId)) {
			throw new ConflictException(
				`RECEIPT_ORDER_MISMATCH: line '${input.purchaseOrderLineId}' does not belong to purchase order '${receipt.purchaseOrderId}', which this receipt is anchored to.`
			);
		}

		const resolved = await this.resolveLines([input], orderLines, orders, undefined);
		const lines = await this.receiptLineService.writeLines(receipt.id, resolved);
		const movementIds = await this.writeReceiptMovements(
			this.numberOf({} as IGoodsReceiptInput, orders),
			receipt,
			lines,
			this.currencyOf(orders)
		);

		const statuses = await this.applyDeltas(
			resolved.map((line) => ({
				lineId: line.purchaseOrderLineId,
				receivedQuantity: line.quantity,
				damagedQuantity: line.damagedQuantity
			})),
			resolved,
			orderLines
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

		for (const line of lines) {
			if (toQuantityUnits(line.quantity) <= 0n) {
				continue;
			}

			await this.inventory.recordMovement({
				warehouseId,
				variantId: line.variantId,
				quantity: negateQuantity(line.quantity),
				kind: StockMovementKind.WRITE_OFF,
				referenceType: MOVEMENT_REFERENCE,
				referenceId: line.id,
				reason: reason ?? RECEIPT_CANCELED,
				batchNumber: line.batchNumber,
				expiresAt: line.expiresAt,
				occurredAt
			});
		}

		const orderLines = await this.purchaseOrderLineService.findIndexedByIds(
			lines.map((line) => line.purchaseOrderLineId)
		);

		await this.applyDeltas(
			lines.map((line) => ({
				lineId: line.purchaseOrderLineId,
				receivedQuantity: negateQuantity(line.quantity),
				damagedQuantity: negateQuantity(line.damagedQuantity)
			})),
			lines.map((line) => ({
				orderId: orderLines.get(line.purchaseOrderLineId)?.purchaseOrderId as ID,
				purchaseOrderLineId: line.purchaseOrderLineId,
				variantId: line.variantId,
				quantity: line.quantity,
				damagedQuantity: line.damagedQuantity,
				unitCost: line.unitCost
			})),
			orderLines
		);

		await super.update(id, {
			status: GoodsReceiptStatus.CANCELED,
			canceledAt: occurredAt,
			note: reason ?? receipt.note,
			version: (receipt.version ?? 1) + 1
		} as any);

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
		const resolved: IResolvedReceiptLine[] = [];

		for (const input of inputs) {
			const orderLine = orderLines.get(input.purchaseOrderLineId);

			if (!orderLine) {
				throw new NotFoundException(
					`PURCHASE_ORDER_LINE_NOT_FOUND: order line '${input.purchaseOrderLineId}' could not be found in this organization.`
				);
			}

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

			const alreadyReceived = sumQuantity([orderLine.receivedQuantity, orderLine.damagedQuantity]);
			const afterThisReceipt = sumQuantity([alreadyReceived, arriving]);
			const tolerance = await this.resolveOverReceiptTolerance(
				orderLine,
				orders.get(orderLine.purchaseOrderId),
				stated
			);
			const ceiling = quantityWithTolerance(orderLine.quantity, tolerance);

			if (isGreaterThanQuantity(afterThisReceipt, ceiling)) {
				throw new ConflictException(
					`${PurchasingCodes.RECEIPT_OVER_TOLERANCE}: PO line '${orderLine.id}' was ordered in quantity ${orderLine.quantity}, ` +
						`${alreadyReceived} has already been received and ${arriving} more would exceed the over-receipt allowance of ${tolerance} in force for it.`
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
				note: input.note
			});
		}

		return resolved;
	}

	/**
	 * Reads the orders a delivery touches, and refuses the ones it cannot be received against.
	 *
	 * A delivery anchored to an order is checked exactly as it always was: the order has to be receivable
	 * and the version the caller read has to be the current one. A consolidated delivery names no order,
	 * so it is checked line by line instead — every line's own order has to be one that is still open —
	 * and every line has to belong to the anchored order when there is one.
	 *
	 * @param input The delivery.
	 * @param orderLines The order lines it names.
	 * @returns The orders, keyed by id.
	 * @throws ConflictException when the lines of an anchored receipt span more than one order, or one of
	 * the orders is finished.
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
			const order =
				input.purchaseOrderId && String(input.purchaseOrderId) === String(orderId)
					? await this.purchaseOrderService.assertReceivable(orderId, input.expectedVersion)
					: await this.purchaseOrderService.findOneScoped(orderId);

			if (
				!input.purchaseOrderId &&
				(order.status === PurchaseOrderStatus.CANCELED || order.status === PurchaseOrderStatus.CLOSED)
			) {
				throw new ConflictException(
					`PURCHASE_ORDER_INVALID_STATE: purchase order '${order.number}' is ${order.status}, so nothing further can be received against it.`
				);
			}

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
	 * @returns The status of every order after the operation, keyed by id.
	 */
	private async applyDeltas(
		deltas: IPurchaseOrderLineDelta[],
		resolved: Array<Pick<IResolvedReceiptLine, 'orderId' | 'purchaseOrderLineId'>>,
		orderLines: Map<ID, PurchaseOrderLine>
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
			await this.purchaseOrderLineService.applyReceiptDeltas(orderId, orderDeltas);

			const updated = await this.purchaseOrderService.refreshReceiptState(orderId);

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
	 * @returns The movement ids the capability wrote.
	 * @throws ConflictException when there is something to move and no capability is registered.
	 */
	private async writeReceiptMovements(
		purchaseOrderNumber: string,
		receipt: GoodsReceipt,
		lines: GoodsReceiptLine[],
		currency?: CurrencyCode
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
				});

				if (result?.movementId) {
					await this.receiptLineService.stampMovement(line.id, result.movementId);
					movementIds.push(result.movementId);
				}
			}

			if (damaged) {
				const result = await this.inventory.recordMovement({
					warehouseId,
					variantId: line.variantId,
					quantity: line.damagedQuantity,
					kind: StockMovementKind.DAMAGE,
					referenceType: MOVEMENT_REFERENCE,
					referenceId: line.id,
					reason: `Damaged on receipt against purchase order ${purchaseOrderNumber} (${currency ?? ''}).`,
					batchNumber: line.batchNumber,
					expiresAt: line.expiresAt,
					occurredAt: receipt.receivedAt
				});

				if (result?.movementId) {
					movementIds.push(result.movementId);
				}
			}

			if (good && line.warehouseBinId) {
				await this.inventory.putAway({
					warehouseId,
					binId: line.warehouseBinId,
					variantId: line.variantId,
					quantity: line.quantity,
					stockMovementId: line.stockMovementId,
					referenceId: line.id,
					reason: `Put-away of goods received against purchase order ${purchaseOrderNumber}.`
				});
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
			throw new ConflictException(
				`GOODS_RECEIPT_SEQUENCE_MISSING: no numbering series is configured for goods receipts (key "${GOODS_RECEIPT_NUMBER_KEY}"), so a number cannot be allocated.`
			);
		}
	}
}
