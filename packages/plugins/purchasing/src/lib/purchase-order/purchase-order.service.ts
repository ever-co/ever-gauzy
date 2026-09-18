import { ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import { OrganizationVendor, RequestContext, SequenceService, TenantAwareCrudService } from '@gauzy/core';
import {
	IPurchaseApprovalPort,
	IPurchaseOrder,
	IPurchaseOrderInput,
	IPurchaseOrderLineInput,
	PURCHASING_APPROVAL,
	PurchaseOrderStatus
} from '../purchasing.types';
import { isAtLeastQuantity, sumQuantity, toQuantityUnits } from '../purchasing.quantity';
import { PurchaseOrderLine } from '../purchase-order-line/purchase-order-line.entity';
import { PurchaseOrderLineService } from '../purchase-order-line/purchase-order-line.service';
import { PurchaseOrder } from './purchase-order.entity';
import { MikroOrmPurchaseOrderRepository } from './repository/mikro-orm-purchase-order.repository';
import { TypeOrmPurchaseOrderRepository } from './repository/type-orm-purchase-order.repository';

/** The series key purchase-order numbers are allocated from. */
const PURCHASE_ORDER_NUMBER_KEY = 'PO';

/** The statuses a purchase order may still be edited in. */
const EDITABLE_STATUSES: PurchaseOrderStatus[] = [PurchaseOrderStatus.DRAFT];

/** The statuses an order may still be sent from. */
const SENDABLE_STATUSES: PurchaseOrderStatus[] = [PurchaseOrderStatus.DRAFT];

/** The statuses an order may still be cancelled from. A cancellation after a receipt is a closure. */
const CANCELABLE_STATUSES: PurchaseOrderStatus[] = [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.SENT];

/** The statuses goods may still be received against. */
const RECEIVABLE_STATUSES: PurchaseOrderStatus[] = [
	PurchaseOrderStatus.SENT,
	PurchaseOrderStatus.ACKNOWLEDGED,
	PurchaseOrderStatus.PARTIALLY_RECEIVED
];

/** The statuses an order may be closed from. */
const CLOSABLE_STATUSES: PurchaseOrderStatus[] = [
	PurchaseOrderStatus.PARTIALLY_RECEIVED,
	PurchaseOrderStatus.RECEIVED
];

/** One day, which is the unit a settlement term and a lead time are stated in. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Purchase orders: the lifecycle, the approval step and the derivation of the money.
 *
 * The lifecycle is a state machine with a permission behind each edge, because the edges are not
 * equivalent decisions. Approving commits the organization to buying; sending tells the supplier it
 * has bought; acknowledging records what the supplier said back; receiving is what moves stock and is
 * therefore owned by the goods-receipt service rather than by this one. An illegal edge is refused
 * with a stable code and leaves the row exactly as it was.
 *
 * Two rules are worth stating because they are easy to get subtly wrong:
 *
 * - **`CANCELED` is reachable only from `DRAFT` and `SENT`.** Once goods have arrived, abandoning the
 *   remainder is a closure, not a cancellation, because the receipts that exist have to stay
 *   accounted for.
 * - **`receivedAt` is non-null exactly when the status is `RECEIVED` or `CLOSED`.** Every write that
 *   changes the status writes the timestamp with it, so the two can never disagree.
 *
 * Three facts about the order are **snapshots taken when it is placed**, and none of them is read back
 * from the supplier afterwards: the settlement schedule and the simple form it stood in
 * (`paymentTermId`, `paymentTermsDaysSnapshot`), the date those produce (`dueDate`), and each line's
 * expected date, which comes from the lead time the line's own term resolved. A supplier renegotiated
 * today changes future orders only — a dunning report reads the order, never the supplier row.
 *
 * The approval is recorded as a fact — `approvedAt`, `approvedByUserId` and, when the platform's
 * approval machinery is registered, `approvalId` — rather than as a status. A draft that is waiting
 * for a decision is still a draft, and a refused approval has to leave the order where it was.
 */
@Injectable()
export class PurchaseOrderService extends TenantAwareCrudService<PurchaseOrder> {
	constructor(
		readonly typeOrmPurchaseOrderRepository: TypeOrmPurchaseOrderRepository,
		readonly mikroOrmPurchaseOrderRepository: MikroOrmPurchaseOrderRepository,
		private readonly lineService: PurchaseOrderLineService,
		private readonly sequenceService: SequenceService,
		@Optional()
		@Inject(PURCHASING_APPROVAL)
		private readonly approval?: IPurchaseApprovalPort
	) {
		super(typeOrmPurchaseOrderRepository, mikroOrmPurchaseOrderRepository);
	}

	/*
	|--------------------------------------------------------------------------
	| Writing
	|--------------------------------------------------------------------------
	*/

	/**
	 * Raises a purchase order against an existing supplier.
	 *
	 * The number comes from the `PO` series, the vendor has to be usable, and every amount on the
	 * document is derived from the lines rather than accepted from the caller — which is what makes
	 * the header formula hold on every order the tenant will ever look at.
	 *
	 * The supplier's own terms are snapshotted here: the settlement schedule it states, unless the caller
	 * names one, and the due date those produce. A line that states no price is priced from the standing
	 * agreement at the same moment, so what a line costs and when it is expected both come from the
	 * agreement as it stood when the order was raised.
	 *
	 * @param entity The order to raise, with its lines.
	 * @returns The created order, with its lines and its totals.
	 * @throws ConflictException when the supplier is archived or inactive.
	 */
	public async create(entity: Partial<PurchaseOrder> & IPurchaseOrderInput): Promise<PurchaseOrder> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const lines = entity.lines ?? [];

		if (!entity.vendorId) {
			throw new ConflictException('PURCHASE_ORDER_VENDOR_REQUIRED: a purchase order must name a supplier.');
		}

		if (!entity.warehouseId) {
			throw new ConflictException(
				'PURCHASE_ORDER_WAREHOUSE_REQUIRED: a purchase order must name the location its goods arrive at.'
			);
		}

		if (!entity.currency) {
			throw new ConflictException(
				'PURCHASE_ORDER_CURRENCY_REQUIRED: a purchase order must state the currency its amounts are in.'
			);
		}

		const vendor = await this.assertVendorUsable(entity.vendorId);
		const currency = entity.currency as CurrencyCode;
		const totals = this.lineService.computeOrderTotals(lines as IPurchaseOrderLineInput[], currency, entity.shippingTotal);
		const number = await this.allocateNumber(PURCHASE_ORDER_NUMBER_KEY, 'purchase orders');
		const settlement = this.resolveSettlement(entity, vendor);
		const raisedAt = new Date();

		const purchaseOrder = await super.create({
			number,
			vendorId: entity.vendorId,
			warehouseId: entity.warehouseId,
			vendorReference: entity.vendorReference,
			buyerUserId: entity.buyerUserId ?? RequestContext.currentUserId(),
			status: PurchaseOrderStatus.DRAFT,
			currency,
			...totals,
			paymentTermId: settlement.paymentTermId,
			paymentTermsDaysSnapshot: settlement.paymentTermsDaysSnapshot,
			dueDate: this.dueDateFrom(raisedAt, settlement.paymentTermsDaysSnapshot),
			expectedAt: entity.expectedAt,
			version: 1,
			note: entity.note,
			metadata: entity.metadata,
			tenantId,
			organizationId
		} as any);

		const written = await this.lineService.replaceLines(purchaseOrder.id, lines as IPurchaseOrderLineInput[], {
			vendorId: entity.vendorId,
			currency,
			date: raisedAt
		});
		const withTotals = await this.lineService.writeLineTotals(written, currency);

		return await this.recomputeTotals(purchaseOrder.id, withTotals, currency);
	}

	/**
	 * Amends a draft purchase order, replacing its line set when one is supplied.
	 *
	 * The totals are recomputed even when only the freight charge changed, because the header is a
	 * function of the lines and the charge together: a partial recomputation is how a total goes stale.
	 *
	 * @param id The order to amend.
	 * @param entity The fields to change.
	 * @returns The amended order, with its lines.
	 * @throws ConflictException when the order has left `DRAFT`.
	 */
	public async update(id: ID, entity: Partial<PurchaseOrder> & Partial<IPurchaseOrderInput>): Promise<PurchaseOrder> {
		const purchaseOrder = await this.findOneScoped(id);

		this.assertVersion(purchaseOrder, (entity as { version?: number }).version);
		this.assertStatus(purchaseOrder, EDITABLE_STATUSES, 'amended');

		const currency = (entity.currency ?? purchaseOrder.currency) as CurrencyCode;
		const changes: Record<string, unknown> = {};

		for (const field of [
			'vendorReference',
			'buyerUserId',
			'paymentTermId',
			'paymentTermsDaysSnapshot',
			'expectedAt',
			'note',
			'metadata'
		] as const) {
			if (entity[field] !== undefined) {
				changes[field] = entity[field];
			}
		}

		if (entity.currency !== undefined) {
			changes.currency = currency;
		}

		// A changed settlement form is a changed due date: the date is a function of the snapshot, and
		// leaving the old one behind would make the two disagree on every ageing report.
		if (entity.paymentTermsDaysSnapshot !== undefined) {
			changes.dueDate = this.dueDateFrom(new Date(), entity.paymentTermsDaysSnapshot);
		}

		const context = { vendorId: purchaseOrder.vendorId, currency };
		const supplied = entity.lines;
		let lines = await this.lineService.findForOrder(id);

		if (Array.isArray(supplied) && supplied.length) {
			const written = await this.lineService.replaceLines(id, supplied as IPurchaseOrderLineInput[], context);

			lines = await this.lineService.writeLineTotals(written, currency);

			if (entity.expectedAt === undefined) {
				changes.expectedAt = this.earliestExpectedAt(lines);
			}
		}

		const totals = this.lineService.computeTotalsForLines(
			lines,
			currency,
			entity.shippingTotal !== undefined ? entity.shippingTotal : purchaseOrder.shippingTotal
		);

		await super.update(id, {
			...changes,
			...totals,
			version: this.nextVersion(purchaseOrder)
		} as any);

		return await this.findOneDetailed(id);
	}

	/**
	 * Deletes a draft purchase order.
	 *
	 * Only a draft: an order the supplier has been told about is cancelled, and an order goods arrived
	 * against is closed, because both of those leave a document that explains what happened.
	 *
	 * @param id The order to delete.
	 * @returns The deletion result.
	 * @throws ConflictException when the order has left `DRAFT`.
	 */
	public async delete(id: ID): Promise<any> {
		const purchaseOrder = await this.findOneScoped(id);

		this.assertStatus(purchaseOrder, EDITABLE_STATUSES, 'deleted');

		return await super.delete(id);
	}

	/*
	|--------------------------------------------------------------------------
	| The lifecycle
	|--------------------------------------------------------------------------
	*/

	/**
	 * Approves a draft purchase order internally.
	 *
	 * When the platform's approval machinery is registered the approval is raised through it, so a
	 * threshold policy applies and the approver sees the request in their own list; the id it answers
	 * with is recorded on the order. Without it, the approval is recorded on the order alone — a
	 * tenant that approves by role does not need a second row to say so.
	 *
	 * @param id The order to approve.
	 * @param note An operator note kept on the order.
	 * @returns The approved order.
	 * @throws ConflictException when the order is not a draft.
	 */
	public async approve(id: ID, note?: string, expectedVersion?: number): Promise<PurchaseOrder> {
		const purchaseOrder = await this.findOneScoped(id);

		if (purchaseOrder.approvedAt) {
			return purchaseOrder;
		}

		this.assertVersion(purchaseOrder, expectedVersion);
		this.assertStatus(purchaseOrder, EDITABLE_STATUSES, 'approved');

		let approvalId: ID | undefined;

		if (this.approval) {
			const result = await this.approval.requestApproval({
				purchaseOrderId: purchaseOrder.id,
				name: `Purchase order ${purchaseOrder.number}`,
				amount: purchaseOrder.grandTotal,
				currency: purchaseOrder.currency,
				note
			});

			approvalId = result?.approvalId;
		}

		await super.update(id, {
			approvedAt: new Date(),
			approvedByUserId: RequestContext.currentUserId(),
			approvalId: approvalId ?? purchaseOrder.approvalId,
			note: note ?? purchaseOrder.note,
			version: this.nextVersion(purchaseOrder)
		} as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Sends a purchase order to the supplier.
	 *
	 * This is the transition the incoming figure turns on: from `SENT` onwards the ordered remainder
	 * is what the receiving location is waiting for, which is why it is the edge with its own
	 * permission and its own timestamp.
	 *
	 * An order that has not been approved is refused. The approval step is what makes the spend a
	 * decision rather than an accident, and a tenant that does not want the step grants both
	 * permissions to the same role.
	 *
	 * @param id The order to send.
	 * @param options The recipient override and an operator note.
	 * @returns The sent order.
	 * @throws ConflictException when the order is not a draft, or has not been approved.
	 */
	public async send(
		id: ID,
		options: { email?: string; note?: string; expectedVersion?: number } = {}
	): Promise<PurchaseOrder> {
		const purchaseOrder = await this.findOneScoped(id);

		this.assertVersion(purchaseOrder, options.expectedVersion);
		this.assertStatus(purchaseOrder, SENDABLE_STATUSES, 'sent');

		if (!purchaseOrder.approvedAt) {
			throw new ConflictException(
				`PURCHASE_ORDER_NOT_APPROVED: purchase order '${purchaseOrder.number}' has not been approved, so it cannot be sent to the supplier.`
			);
		}

		const sentAt = new Date();
		const metadata = { ...(purchaseOrder.metadata ?? {}) } as Record<string, unknown>;

		if (options.email) {
			metadata.sentTo = options.email;
		}

		await super.update(id, {
			status: PurchaseOrderStatus.SENT,
			orderedAt: sentAt,
			sentAt,
			note: options.note ?? purchaseOrder.note,
			metadata,
			version: this.nextVersion(purchaseOrder)
		} as any);

		// This is the instant a lead time and a settlement term are measured from, so both are anchored
		// here: `expectedAt = orderedAt + leadTimeDays` per line, and the due date from the settlement
		// form that was snapshotted when the order was raised. Neither re-reads a supplier row or a term:
		// the line carries its own lead time, and the order carries its own settlement snapshot.
		const lines = await this.lineService.applyLeadTimes(id, sentAt);
		const anchored: Record<string, unknown> = {};

		if (purchaseOrder.paymentTermsDaysSnapshot !== undefined && purchaseOrder.paymentTermsDaysSnapshot !== null) {
			anchored.dueDate = this.dueDateFrom(sentAt, purchaseOrder.paymentTermsDaysSnapshot);
		}

		if (!purchaseOrder.expectedAt) {
			anchored.expectedAt = this.earliestExpectedAt(lines);
		}

		if (Object.keys(anchored).length) {
			await super.update(id, anchored as any);
		}

		return await this.findOneScoped(id);
	}

	/**
	 * Records the supplier's acknowledgement, which may revise the expected date.
	 *
	 * Quantities are deliberately not revisable here: a supplier that cannot deliver what was ordered
	 * is answered by receiving what does arrive and closing the order short, which leaves the
	 * difference visible instead of rewriting the commitment that was made.
	 *
	 * @param id The order being acknowledged.
	 * @param options The revised expected date and an operator note.
	 * @returns The acknowledged order.
	 * @throws ConflictException when the order is not `SENT`.
	 */
	public async acknowledge(
		id: ID,
		options: { expectedAt?: Date; note?: string; expectedVersion?: number } = {}
	): Promise<PurchaseOrder> {
		const purchaseOrder = await this.findOneScoped(id);

		this.assertVersion(purchaseOrder, options.expectedVersion);
		this.assertStatus(purchaseOrder, [PurchaseOrderStatus.SENT], 'acknowledged');

		await super.update(id, {
			status: PurchaseOrderStatus.ACKNOWLEDGED,
			acknowledgedAt: new Date(),
			expectedAt: options.expectedAt ?? purchaseOrder.expectedAt,
			note: options.note ?? purchaseOrder.note,
			version: this.nextVersion(purchaseOrder)
		} as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Cancels a purchase order before anything arrived.
	 *
	 * Terminal, and the transition that removes the ordered quantities from the receiving location's
	 * incoming figure. An order goods arrived against cannot be cancelled: it is closed instead, so
	 * the receipts that exist stay explained.
	 *
	 * @param id The order to cancel.
	 * @param reason Why it was cancelled.
	 * @returns The cancelled order.
	 * @throws ConflictException when the order is neither a draft nor sent.
	 */
	public async cancel(id: ID, reason?: string, expectedVersion?: number): Promise<PurchaseOrder> {
		const purchaseOrder = await this.findOneScoped(id);

		this.assertVersion(purchaseOrder, expectedVersion);
		this.assertStatus(purchaseOrder, CANCELABLE_STATUSES, 'cancelled');

		await super.update(id, {
			status: PurchaseOrderStatus.CANCELED,
			canceledAt: new Date(),
			receivedAt: null,
			note: reason ?? purchaseOrder.note,
			version: this.nextVersion(purchaseOrder)
		} as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Closes an order short of the ordered quantity.
	 *
	 * Closing is the deliberate end of an order that will not be completed: the unreceived remainder
	 * leaves the incoming figure, and the receipts that exist remain part of the record. A partially
	 * received order is closed when the supplier will not deliver the rest; a fully received one is
	 * closed when the paperwork is finished. The transition is idempotent, so closing an order that is
	 * already closed answers with the order rather than with an error.
	 *
	 * @param id The order to close.
	 * @param reason Why it was closed short.
	 * @returns The closed order.
	 * @throws ConflictException when the order cannot be closed from its status.
	 */
	public async close(id: ID, reason?: string, expectedVersion?: number): Promise<PurchaseOrder> {
		const purchaseOrder = await this.findOneScoped(id);

		if (purchaseOrder.status === PurchaseOrderStatus.CLOSED) {
			return purchaseOrder;
		}

		this.assertVersion(purchaseOrder, expectedVersion);
		this.assertStatus(purchaseOrder, CLOSABLE_STATUSES, 'closed');

		await super.update(id, {
			status: PurchaseOrderStatus.CLOSED,
			closedAt: new Date(),
			// `receivedAt` is non-null exactly when the status is `RECEIVED` or `CLOSED`, so an order
			// closed before anything arrived is stamped here rather than left inconsistent.
			receivedAt: purchaseOrder.receivedAt ?? new Date(),
			note: reason ?? purchaseOrder.note,
			version: this.nextVersion(purchaseOrder)
		} as any);

		return await this.findOneScoped(id);
	}

	/*
	|--------------------------------------------------------------------------
	| Reading, and the receipt side of the lifecycle
	|--------------------------------------------------------------------------
	*/

	/**
	 * Reads an order with everything a detail view shows.
	 *
	 * @param id The order to read.
	 * @returns The order, its lines, its receipts and its supplier.
	 * @throws NotFoundException when it is not the caller's.
	 */
	public async findOneDetailed(id: ID): Promise<PurchaseOrder> {
		const purchaseOrder = await this.typeOrmPurchaseOrderRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			relations: { lines: true, receipts: true, vendor: true, warehouse: true }
		});

		if (!purchaseOrder) {
			throw new NotFoundException(`PURCHASE_ORDER_NOT_FOUND: purchase order '${id}' could not be found.`);
		}

		return purchaseOrder;
	}

	/**
	 * Reads an order and checks that goods may still be received against it.
	 *
	 * The three refusals are three different facts and are reported as such: an order that was never
	 * sent has nothing to receive against, one that is already complete has nothing left, and a
	 * cancelled one is not coming at all.
	 *
	 * @param id The order being received against.
	 * @param expectedVersion The version the caller read, when it stated one.
	 * @returns The order.
	 * @throws ConflictException when the order is not in a receivable status.
	 */
	public async assertReceivable(id: ID, expectedVersion?: number): Promise<PurchaseOrder> {
		const purchaseOrder = await this.findOneScoped(id);

		this.assertVersion(purchaseOrder, expectedVersion);

		if (purchaseOrder.status === PurchaseOrderStatus.DRAFT) {
			throw new ConflictException(
				`PURCHASE_ORDER_NOT_SENT: purchase order '${purchaseOrder.number}' has not been sent to the supplier yet.`
			);
		}

		if (
			purchaseOrder.status === PurchaseOrderStatus.RECEIVED ||
			purchaseOrder.status === PurchaseOrderStatus.CLOSED
		) {
			throw new ConflictException(
				`PURCHASE_ORDER_ALREADY_RECEIVED: purchase order '${purchaseOrder.number}' has already been received.`
			);
		}

		if (!RECEIVABLE_STATUSES.includes(purchaseOrder.status)) {
			throw new ConflictException(
				`PURCHASE_ORDER_INVALID_STATE: purchase order '${purchaseOrder.number}' cannot be received in status ${purchaseOrder.status}.`
			);
		}

		return purchaseOrder;
	}

	/**
	 * Rewrites the order's status from what its lines now say has arrived.
	 *
	 * Called after every receipt and every reversal, because the status is derived from the lines
	 * rather than tracked beside them: an order whose last shortfall was received is `RECEIVED`, one
	 * with some of its quantity in is `PARTIALLY_RECEIVED`, and one whose receipts were all reversed
	 * falls back to what the supplier last confirmed.
	 *
	 * @param id The order to refresh.
	 * @returns The refreshed order.
	 */
	public async refreshReceiptState(id: ID): Promise<PurchaseOrder> {
		const purchaseOrder = await this.findOneScoped(id);

		if (
			purchaseOrder.status === PurchaseOrderStatus.CANCELED ||
			purchaseOrder.status === PurchaseOrderStatus.CLOSED
		) {
			return purchaseOrder;
		}

		const lines = await this.lineService.findForOrder(id);
		const status = this.statusFromLines(lines, purchaseOrder);

		// `receivedAt` is written with the status rather than beside it: the column is non-null exactly
		// when the status is `RECEIVED` or `CLOSED`, and when a delivery last arrived on a partially
		// received order that instant is the receipt's own `receivedAt`, not the order's.
		await super.update(id, {
			status,
			receivedAt: status === PurchaseOrderStatus.RECEIVED ? new Date() : null
		} as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Reads an order and checks that its line set may still be written.
	 *
	 * Exposed because the line surface is reachable on its own: a line written directly still has to
	 * obey the same rule as one written with its order, and the rule belongs to the order rather than
	 * to the line.
	 *
	 * @param id The order.
	 * @returns The order.
	 * @throws ConflictException when the order has left `DRAFT`.
	 */
	public async assertEditable(id: ID): Promise<PurchaseOrder> {
		const purchaseOrder = await this.findOneScoped(id);

		this.assertStatus(purchaseOrder, EDITABLE_STATUSES, 'amended');

		return purchaseOrder;
	}

	/**
	 * Rewrites an order's header totals from the lines it currently holds.
	 *
	 * Called after a line was written on its own, because the header is a function of the whole line
	 * set: a line changed through the line surface has to leave the header exactly as correct as one
	 * changed through the order.
	 *
	 * @param id The order to recompute.
	 * @returns The order, with its totals written.
	 */
	public async recomputeTotalsFor(id: ID): Promise<PurchaseOrder> {
		const purchaseOrder = await this.findOneScoped(id);
		const lines = await this.lineService.findForOrder(id);

		return await this.recomputeTotals(id, lines, purchaseOrder.currency);
	}

	/**
	 * Reads an order scoped to the caller's tenant and organization.
	 *
	 * @param id The order to read.
	 * @returns The order.
	 * @throws NotFoundException when it is not the caller's.
	 */
	public async findOneScoped(id: ID): Promise<PurchaseOrder> {
		const purchaseOrder = await this.typeOrmPurchaseOrderRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!purchaseOrder) {
			throw new NotFoundException(`PURCHASE_ORDER_NOT_FOUND: purchase order '${id}' could not be found.`);
		}

		return purchaseOrder;
	}

	/**
	 * @param lines The order's lines as they stand.
	 * @param purchaseOrder The order.
	 * @returns The status the lines describe.
	 */
	private statusFromLines(lines: PurchaseOrderLine[], purchaseOrder: PurchaseOrder): PurchaseOrderStatus {
		if (!lines.length) {
			return purchaseOrder.status;
		}

		const settled = (line: PurchaseOrderLine): DecimalString =>
			sumQuantity([line.receivedQuantity, line.damagedQuantity]);

		const anythingArrived = lines.some((line) => toQuantityUnits(settled(line)) > 0n);

		if (!anythingArrived) {
			// Everything that arrived has been reversed away: the order is back to what the supplier
			// last confirmed, which is what makes a reversal leave no trace on the status.
			return purchaseOrder.acknowledgedAt ? PurchaseOrderStatus.ACKNOWLEDGED : PurchaseOrderStatus.SENT;
		}

		const complete = lines.every((line) => isAtLeastQuantity(settled(line), line.quantity));

		return complete ? PurchaseOrderStatus.RECEIVED : PurchaseOrderStatus.PARTIALLY_RECEIVED;
	}

	/**
	 * Writes the header totals that follow from the lines.
	 *
	 * @param id The order to write.
	 * @param lines The lines it holds.
	 * @param currency The order's currency.
	 * @returns The order, with its totals written.
	 */
	private async recomputeTotals(
		id: ID,
		lines: PurchaseOrderLine[],
		currency: CurrencyCode
	): Promise<PurchaseOrder> {
		const purchaseOrder = await this.findOneScoped(id);
		const totals = this.lineService.computeTotalsForLines(lines, currency, purchaseOrder.shippingTotal);

		await super.update(id, { ...totals } as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Reads the supplier, refuses an archived or inactive one, and answers with the row.
	 *
	 * The supplier master is the platform's own vendor table, which this plugin extends rather than
	 * duplicates, so the check reads that row directly instead of going through another service: the
	 * order has to name a supplier that exists in the caller's organization. The row is answered back
	 * because the same read is what snapshots the supplier's settlement terms.
	 *
	 * @param vendorId The supplier to check.
	 * @returns The supplier row.
	 * @throws NotFoundException when the supplier does not exist in this tenant and organization.
	 * @throws ConflictException when it is archived or inactive.
	 */
	private async assertVendorUsable(vendorId: ID): Promise<OrganizationVendor> {
		const vendor = await this.typeOrmPurchaseOrderRepository.manager.findOne(OrganizationVendor, {
			where: {
				id: vendorId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!vendor) {
			throw new NotFoundException(
				`PURCHASE_ORDER_VENDOR_NOT_FOUND: supplier '${vendorId}' could not be found in this organization.`
			);
		}

		if (vendor.isArchived === true || vendor.isActive === false) {
			throw new ConflictException(`PURCHASE_ORDER_VENDOR_INACTIVE: vendor '${vendorId}' is not active.`);
		}

		return vendor;
	}

	/**
	 * Snapshots the settlement schedule an order runs on.
	 *
	 * The caller may name the schedule itself; otherwise the supplier's own applies, which is what the
	 * vendor-level settlement columns are for — and it is a **default**, never the agreement, exactly as
	 * a vendor-level lead time is. Both members are snapshotted rather than referenced, so a later edit
	 * to the supplier cannot move the due date of an order that has already been placed.
	 *
	 * @param entity The order as the caller raised it.
	 * @param vendor The supplier row.
	 * @returns The schedule id and the simple form in days, both as they stood at order time.
	 */
	private resolveSettlement(
		entity: Partial<IPurchaseOrderInput>,
		vendor: Pick<OrganizationVendor, 'paymentTermId' | 'paymentTermsDays'>
	): { paymentTermId?: ID; paymentTermsDaysSnapshot?: number } {
		const paymentTermId = entity.paymentTermId ?? vendor.paymentTermId ?? undefined;
		const stated = entity.paymentTermsDaysSnapshot;
		const days =
			stated === undefined || stated === null
				? vendor.paymentTermsDays ?? undefined
				: Number(stated);

		return {
			paymentTermId,
			paymentTermsDaysSnapshot: days === undefined || Number.isNaN(Number(days)) ? undefined : Number(days)
		};
	}

	/**
	 * @param anchor The instant the settlement term is measured from.
	 * @param days The term, in days.
	 * @returns The date the order falls due, or undefined when no term is stated — an order with no
	 * agreed schedule has no due date rather than one due immediately.
	 */
	private dueDateFrom(anchor: Date, days?: number): Date | undefined {
		if (days === undefined || days === null || !Number.isFinite(Number(days))) {
			return undefined;
		}

		return new Date(anchor.getTime() + Number(days) * DAY_MS);
	}

	/**
	 * @param lines The order's lines.
	 * @returns The earliest date the lines expect goods, or undefined when none states one. This is what
	 * the header's expected date means: it is the minimum over the lines, never a separate commitment.
	 */
	private earliestExpectedAt(lines: PurchaseOrderLine[]): Date | undefined {
		const dates = lines
			.map((line) => line.expectedAt)
			.filter((date): date is Date => Boolean(date))
			.map((date) => new Date(date).getTime());

		return dates.length ? new Date(Math.min(...dates)) : undefined;
	}

	/**
	 * Allocates the next number from a platform numbering series.
	 *
	 * @param key The series key.
	 * @param document The document being numbered, named in the error.
	 * @returns The formatted number.
	 * @throws ConflictException when the organization has no series for the key, which is a
	 * configuration fault worth naming rather than a generic failure.
	 */
	private async allocateNumber(key: string, document: string): Promise<string> {
		try {
			const allocated = await this.sequenceService.allocate(key);

			return allocated.formatted;
		} catch (error) {
			/*
			 * Only the *absence* of a series is this message's to report, and the distinction is not
			 * cosmetic: catching everything answered "no series is configured" for any failure at all —
			 * a contention timeout, a database error, a claim that never settled — so a broken allocation
			 * was reported as a misconfiguration and the real cause was never seen. The series being
			 * missing is a `NotFoundException` from the allocator; anything else keeps its own identity.
			 */
			if (error instanceof NotFoundException) {
				throw new ConflictException(
					`PURCHASE_ORDER_SEQUENCE_MISSING: no numbering series is configured for ${document} (key "${key}"), so a number cannot be allocated.`
				);
			}

			throw error;
		}
	}

	/**
	 * @param purchaseOrder The order.
	 * @returns The next optimistic-lock value.
	 */
	private nextVersion(purchaseOrder: Pick<IPurchaseOrder, 'version'>): number {
		return (purchaseOrder.version ?? 1) + 1;
	}

	/**
	 * Refuses a transition when the caller acted on a version that has since moved.
	 *
	 * @param purchaseOrder The order.
	 * @param expectedVersion The version the caller read, when it stated one.
	 * @throws ConflictException when the two differ.
	 */
	private assertVersion(purchaseOrder: Pick<IPurchaseOrder, 'id' | 'version'>, expectedVersion?: number): void {
		if (expectedVersion === undefined || expectedVersion === null) {
			return;
		}

		if ((purchaseOrder.version ?? 1) !== expectedVersion) {
			throw new ConflictException(
				`PURCHASE_ORDER_VERSION_CONFLICT: purchase order '${purchaseOrder.id}' has moved on since version ${expectedVersion}.`
			);
		}
	}

	/**
	 * @param purchaseOrder The order the transition is attempted on.
	 * @param allowed The statuses it may be attempted from.
	 * @param action The action being attempted, named in the error.
	 * @throws ConflictException when the order is not in one of the allowed statuses.
	 */
	private assertStatus(purchaseOrder: PurchaseOrder, allowed: PurchaseOrderStatus[], action: string): void {
		if (!allowed.includes(purchaseOrder.status)) {
			throw new ConflictException(
				`PURCHASE_ORDER_INVALID_STATE: purchase order '${purchaseOrder.number}' cannot be ${action} in status ${purchaseOrder.status}.`
			);
		}
	}
}
