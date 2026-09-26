import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial, DeleteResult, FindManyOptions, FindOptionsWhere } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import {
	RequestContext,
	TenantAwareCrudService,
	addDecimalStrings,
	compareDecimalStrings,
	subtractDecimalStrings
} from '@gauzy/core';
import { ILineInvoicePosition, OrderLineInvoiceDirection, OrderLineInvoiceStatus } from '../order.types';
import { OrderLine } from '../order-line/order-line.entity';
import { Order } from '../order/order.entity';
import { TypeOrmOrderLineRepository } from '../order-line/repository/type-orm-order-line.repository';
import { TypeOrmOrderRepository } from '../order/repository/type-orm-order.repository';
import { OrderLineInvoice } from './order-line-invoice.entity';
import { MikroOrmOrderLineInvoiceRepository } from './repository/mikro-orm-order-line-invoice.repository';
import { TypeOrmOrderLineInvoiceRepository } from './repository/type-orm-order-line-invoice.repository';

/** One link as the invoice bridge writes it. */
export interface IRecordInvoiceLinkInput {
	/** The order line the item billed or credited. */
	orderLineId: ID;
	/** The accounting item the link records. */
	invoiceItemId: ID;
	/** Which way the link moves the counters; billing when omitted. */
	direction?: OrderLineInvoiceDirection;
	/** The quantity the item actually billed, never the line's ordered quantity. */
	quantity: number | string;
	/** The signed amount the item carried, in the order's currency. */
	amount: number | string;
	/** The order's currency; checked against the order the line belongs to. */
	currency: string;
	/**
	 * The quantity the line is invoiced against. The invoice bridge reads it from the variant's own
	 * `billingInvoicingPolicy` — the ordered quantity under a quantity-ordered policy, the fulfilled
	 * quantity under a quantity-delivered one — and this defaults to the ordered quantity, which is the
	 * shipped default of that policy.
	 */
	basisQuantity?: number | string;
	/** Tenant extras: the invoice number, an export reference. */
	metadata?: Record<string, unknown>;
}

/**
 * The register that makes a partial invoice, and a partial credit, expressible.
 *
 * An order line is one commercial fact and it is routinely billed by more than one accounting
 * document: a deposit at placement and the balance on delivery; a milestone invoice and its
 * correction; a credit note that gives part of a line back. The line's link to invoicing was a single
 * column, so exactly one of those could ever be written. This service owns the pivot that replaces it —
 * one row per invoice item and per credit-note item — and the two counters on the line that are its
 * sum.
 *
 * **The link and the counter are one write.** A row here without its counter is a line that
 * under-reports what it has billed, and a counter without its row is a number nothing can justify, so
 * both move inside a single transaction. On a dialect that has row locks the transaction is enough; on
 * one that does not, the counter update is a **compare-and-set** on the values the transaction read,
 * and a losing writer is refused with `ORDER_LINE_INVOICE_CONFLICT` rather than silently overwriting
 * the winner's arithmetic. `UQ_order_line_invoice_item` is the second guard: the same accounting item
 * can never be counted twice, on any dialect.
 *
 * **What is refused, and why each refusal is a real defect rather than a preference:**
 *
 * - a credit larger than what was invoiced — the register would then claim money was given back that
 *   was never taken;
 * - a quantity that is not positive — a link of nothing is not a link, and a negative quantity is a
 *   credit written the wrong way round, which is what `direction` is for;
 * - a non-`ITEM` line — a section or a note is a presentation row that carries no quantity and no
 *   price, so billing one is a defect in the caller rather than a row to record;
 * - a currency that is not the order's — an amount in another currency cannot be summed into the same
 *   total, and accepting one would make the order's own totals wrong.
 *
 * The counter derivation is deliberately also exposed as a pure function (`deriveInvoiceStatus`) and as
 * a re-derivation (`recomputeCounters`), because a cache of other rows has to be checkable against
 * them: the nightly `totals-audit` calls the second and reports the drift the first would have
 * produced.
 */
@Injectable()
export class OrderLineInvoiceService extends TenantAwareCrudService<OrderLineInvoice> {
	constructor(
		readonly typeOrmOrderLineInvoiceRepository: TypeOrmOrderLineInvoiceRepository,
		readonly mikroOrmOrderLineInvoiceRepository: MikroOrmOrderLineInvoiceRepository,
		private readonly typeOrmOrderLineRepository: TypeOrmOrderLineRepository,
		private readonly typeOrmOrderRepository: TypeOrmOrderRepository
	) {
		super(typeOrmOrderLineInvoiceRepository, mikroOrmOrderLineInvoiceRepository);
	}

	/**
	 * Lists links.
	 *
	 * @param filter Optional filtering criteria.
	 * @returns A paginated list of links.
	 */
	public async findAll(filter?: FindManyOptions<OrderLineInvoice>): Promise<IPagination<OrderLineInvoice>> {
		return await this.paginate(filter);
	}

	/**
	 * Reads every link of one order line, in the order they were written.
	 *
	 * **The order is total: the instant, then the identity.** A line's links are paged with offset cursors
	 * (`orderLineInvoices`), and the instant alone leaves ties — a bridge that records a deposit and its
	 * balance in one pass writes two links of one line within one clock tick — which the store answers in
	 * whatever order it chooses on that read, so a cursor walk could repeat one link and never answer
	 * another. The primary key closes the order.
	 *
	 * @param orderLineId The line to read.
	 * @param withDeleted Whether links retired from the register are included. Stated through the find
	 * options rather than as a filter on the rows handed back, because the store is what knows a row was
	 * retired.
	 * @returns The links, oldest first — which is the order the documents were issued in.
	 */
	public async listForLine(orderLineId: ID, withDeleted?: boolean): Promise<OrderLineInvoice[]> {
		return await this.typeOrmOrderLineInvoiceRepository.find({
			where: {
				orderLineId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			order: { createdAt: 'ASC', id: 'ASC' },
			...(withDeleted ? { withDeleted: true } : {})
		});
	}

	/**
	 * Records one link and moves the line's counters with it.
	 *
	 * The line is read inside the transaction, the new counters are computed from what it holds plus
	 * this link, and the write is conditional on the counters the transaction read — so two links
	 * written concurrently cannot both claim to be the second one.
	 *
	 * @param input The link to record.
	 * @returns The stored link, and the line as it now stands.
	 * @throws BadRequestException when the link is not a usable one, when a credit would exceed what was
	 * invoiced, or when the line moved under this write.
	 * @throws NotFoundException when the line or its order does not exist in the caller's tenant.
	 */
	public async record(input: IRecordInvoiceLinkInput): Promise<{ link: OrderLineInvoice; line: OrderLine }> {
		const direction = input.direction ?? OrderLineInvoiceDirection.INVOICE;
		const quantity = this.readQuantity(input.quantity, 'quantity');
		const amount = this.readSignedAmount(input.amount, 'amount');
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		if (!input.orderLineId) {
			throw new BadRequestException('ORDER_LINE_INVOICE_LINE_REQUIRED: a link describes one order line.');
		}

		if (!input.invoiceItemId) {
			throw new BadRequestException('ORDER_LINE_INVOICE_ITEM_REQUIRED: a link records one invoice item.');
		}

		const existing = await this.typeOrmOrderLineInvoiceRepository.findOne({
			where: { invoiceItemId: input.invoiceItemId, tenantId, organizationId }
		});

		if (existing) {
			throw new BadRequestException(
				`ORDER_LINE_INVOICE_ALREADY_RECORDED: the item ${input.invoiceItemId} is already linked to the line ${existing.orderLineId}, ` +
					'and one item bills one line once.'
			);
		}

		let link: OrderLineInvoice;

		try {
			link = await this.typeOrmOrderLineInvoiceRepository.manager.transaction(async (manager) => {
				const line = await manager.findOne(OrderLine, { where: { id: input.orderLineId, tenantId, organizationId } });

				if (!line) {
					throw new NotFoundException(`ORDER_LINE_NOT_FOUND: no order line exists with id ${input.orderLineId}.`);
				}

				this.assertLineIsBillable(line);
				await this.assertCurrencyIsTheOrders(line, input.currency, tenantId, organizationId);

				const position = this.positionOf(line, direction, quantity, input.basisQuantity);

				if (direction === OrderLineInvoiceDirection.CREDIT && position.creditedExceedsInvoiced) {
					throw new BadRequestException(
						`ORDER_LINE_CREDIT_EXCEEDS_INVOICED: the line has billed ${line.invoicedQuantity ?? 0} and ` +
							`${position.creditedQuantity} would be credited, which gives back more than was taken.`
					);
				}

				const inserted = manager.create(OrderLineInvoice, {
					orderLineId: line.id,
					invoiceItemId: input.invoiceItemId,
					direction,
					quantity: Number(quantity),
					amount: Number(amount),
					currency: input.currency.toUpperCase(),
					metadata: input.metadata,
					tenantId,
					organizationId
				} as DeepPartial<OrderLineInvoice>);

				await manager.insert(OrderLineInvoice, inserted);

				const written = await manager.update(
					OrderLine,
					{
						id: line.id,
						invoicedQuantity: (line.invoicedQuantity ?? 0) as any,
						creditedQuantity: (line.creditedQuantity ?? 0) as any
					},
					{
						invoicedQuantity: Number(position.invoicedQuantity),
						creditedQuantity: Number(position.creditedQuantity),
						invoiceStatus: position.invoiceStatus
					} as any
				);

				if (!written.affected) {
					throw new BadRequestException(
						'ORDER_LINE_INVOICE_CONFLICT: the line was billed by another write between this one reading it and writing it, ' +
							'so the counters were not overwritten. Read the line and record the link again.'
					);
				}

				return inserted;
			});
		} catch (error) {
			throw error;
		}

		const line = await this.typeOrmOrderLineRepository.findOne({ where: { id: input.orderLineId } });

		return { link, line: line as OrderLine };
	}

	/**
	 * Amends a link's tenant extras.
	 *
	 * Only `metadata` is writable. A link's quantity, its amount, its direction and the item it names
	 * describe a document that has been issued; correcting any of them would silently restate what an
	 * invoice says, so a correction is a credit note — another link, in the opposite direction — rather
	 * than an edit of this one.
	 *
	 * @param id The link to amend.
	 * @param entity The members to change.
	 * @returns The link, as it now stands.
	 * @throws BadRequestException when the caller states anything but `metadata`.
	 * @throws NotFoundException when the link is not the caller's.
	 */
	public async updateOne(id: ID, entity: DeepPartial<OrderLineInvoice>): Promise<OrderLineInvoice> {
		const link = await this.findOneByIdString(id);
		const immutable = ['orderLineId', 'invoiceItemId', 'direction', 'quantity', 'amount', 'currency'].filter(
			(field) => (entity as Record<string, unknown>)[field] !== undefined
		);

		if (immutable.length) {
			throw new BadRequestException(
				`ORDER_LINE_INVOICE_IMMUTABLE: ${immutable.join(', ')} describe an issued document and are never edited; ` +
					'record a credit instead of restating what an invoice says.'
			);
		}

		await super.update(id, { metadata: entity.metadata } as any);

		return await this.findOneByIdString(link.id);
	}

	/**
	 * Removes one link and re-derives the line's counters from what remains.
	 *
	 * The row is soft-deleted rather than dropped, because the reconciliation has to be able to explain
	 * a counter that moved: a link that disappeared entirely would leave the difference as a number with
	 * no history.
	 *
	 * @param criteria The link to remove, by id or by conditions.
	 * @returns The delete result, so the route keeps the platform's response shape.
	 * @throws NotFoundException when the link is not the caller's.
	 */
	public async delete(criteria: string | FindOptionsWhere<OrderLineInvoice>): Promise<DeleteResult> {
		const link =
			typeof criteria === 'string'
				? await this.findOneByIdString(criteria)
				: await this.typeOrmOrderLineInvoiceRepository.findOne({ where: criteria });

		if (!link) {
			throw new NotFoundException('ORDER_LINE_INVOICE_NOT_FOUND: no such link in this organization.');
		}

		await super.softDelete(link.id);
		await this.recomputeCounters(link.orderLineId);

		return { affected: 1, raw: [] } as DeleteResult;
	}

	/**
	 * Re-derives a line's invoicing counters from its links.
	 *
	 * The reconciliation half of the register: the counters are a cache of these rows, so a job can
	 * always ask what they *should* be and compare. It is also what a removed link leaves behind, which
	 * is why it runs on every removal.
	 *
	 * @param orderLineId The line to re-derive.
	 * @param basisQuantity The quantity the line is invoiced against; the ordered quantity when omitted.
	 * @returns The line, with its counters re-derived.
	 * @throws NotFoundException when the line is not the caller's.
	 */
	public async recomputeCounters(orderLineId: ID, basisQuantity?: number | string): Promise<OrderLine> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const line = await this.typeOrmOrderLineRepository.findOne({ where: { id: orderLineId, tenantId, organizationId } });

		if (!line) {
			throw new NotFoundException(`ORDER_LINE_NOT_FOUND: no order line exists with id ${orderLineId}.`);
		}

		const links = await this.listForLine(orderLineId);
		const invoiced = links
			.filter((link) => link.direction === OrderLineInvoiceDirection.INVOICE)
			.reduce<string>((total, link) => addDecimalStrings(total, link.quantity ?? 0), '0');
		const credited = links
			.filter((link) => link.direction === OrderLineInvoiceDirection.CREDIT)
			.reduce<string>((total, link) => addDecimalStrings(total, link.quantity ?? 0), '0');
		const basis = this.readBasis(line, basisQuantity);

		await this.typeOrmOrderLineRepository.update(orderLineId, {
			invoicedQuantity: Number(invoiced),
			creditedQuantity: Number(credited),
			invoiceStatus: OrderLineInvoiceService.deriveInvoiceStatus(basis, invoiced, credited)
		} as any);

		return (await this.typeOrmOrderLineRepository.findOne({ where: { id: orderLineId } })) as OrderLine;
	}

	/**
	 * Reads what a line's counters say, and what they should say.
	 *
	 * @param orderLineId The line to read.
	 * @param basisQuantity The quantity the line is invoiced against; the ordered quantity when omitted.
	 * @returns The position, with the status the counters imply.
	 * @throws NotFoundException when the line is not the caller's.
	 */
	public async positionFor(orderLineId: ID, basisQuantity?: number | string): Promise<ILineInvoicePosition> {
		const line = await this.typeOrmOrderLineRepository.findOne({
			where: {
				id: orderLineId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!line) {
			throw new NotFoundException(`ORDER_LINE_NOT_FOUND: no order line exists with id ${orderLineId}.`);
		}

		const basis = this.readBasis(line, basisQuantity);
		const invoiced = `${line.invoicedQuantity ?? 0}`;
		const credited = `${line.creditedQuantity ?? 0}`;

		return {
			basisQuantity: basis,
			invoicedQuantity: invoiced,
			creditedQuantity: credited,
			toInvoiceQuantity: compareDecimalStrings(invoiced, basis) >= 0 ? '0' : subtractDecimalStrings(basis, invoiced),
			invoiceStatus: OrderLineInvoiceService.deriveInvoiceStatus(basis, invoiced, credited)
		};
	}

	/*
	|--------------------------------------------------------------------------
	| The derivation
	|--------------------------------------------------------------------------
	*/

	/**
	 * The status a pair of counters implies for a basis.
	 *
	 * One rule, one home, and no arithmetic outside the platform's exact-decimal helpers: this is what
	 * `order_line.invoice_status` is a cache **of**, so it is deliberately a pure function of three
	 * numbers rather than a method that reads anything. A counter that never reaches its basis is
	 * `PARTIALLY_INVOICED` — which is what makes a deposit expressible — and one that passes it is
	 * `OVER_INVOICED` rather than clamped, for the same reason the over-delivery counter exists: a
	 * document that billed too much is a fact the order has to be able to state.
	 *
	 * @param basisQuantity The quantity the line is invoiced against.
	 * @param invoicedQuantity What has been billed.
	 * @param creditedQuantity What has been credited back.
	 * @returns The status the counters imply.
	 */
	public static deriveInvoiceStatus(
		basisQuantity: number | string,
		invoicedQuantity: number | string,
		creditedQuantity: number | string
	): OrderLineInvoiceStatus {
		const billed = subtractDecimalStrings(
			`${invoicedQuantity ?? 0}`,
			`${creditedQuantity ?? 0}`
		);
		const against = compareDecimalStrings(billed, `${basisQuantity ?? 0}`);

		if (against > 0) {
			return OrderLineInvoiceStatus.OVER_INVOICED;
		}

		if (against === 0) {
			return OrderLineInvoiceStatus.INVOICED;
		}

		return compareDecimalStrings(billed, '0') > 0
			? OrderLineInvoiceStatus.PARTIALLY_INVOICED
			: OrderLineInvoiceStatus.NOT_INVOICED;
	}

	/**
	 * What the line's counters become when this link is added.
	 *
	 * @param line The line as it stands.
	 * @param direction Which way the link moves the counters.
	 * @param quantity The quantity the item billed.
	 * @param basisQuantity The quantity the line is invoiced against, when the caller states one.
	 * @returns The counters the line would carry, and whether a credit would exceed what was invoiced.
	 */
	private positionOf(
		line: OrderLine,
		direction: OrderLineInvoiceDirection,
		quantity: string,
		basisQuantity?: number | string
	): {
		invoicedQuantity: string;
		creditedQuantity: string;
		invoiceStatus: OrderLineInvoiceStatus;
		creditedExceedsInvoiced: boolean;
	} {
		const invoiced = `${line.invoicedQuantity ?? 0}`;
		const credited = `${line.creditedQuantity ?? 0}`;
		const nextInvoiced = direction === OrderLineInvoiceDirection.INVOICE ? addDecimalStrings(invoiced, quantity) : invoiced;
		const nextCredited = direction === OrderLineInvoiceDirection.CREDIT ? addDecimalStrings(credited, quantity) : credited;
		const basis = this.readBasis(line, basisQuantity);

		return {
			invoicedQuantity: nextInvoiced,
			creditedQuantity: nextCredited,
			invoiceStatus: OrderLineInvoiceService.deriveInvoiceStatus(basis, nextInvoiced, nextCredited),
			creditedExceedsInvoiced: compareDecimalStrings(nextCredited, nextInvoiced) > 0
		};
	}

	/**
	 * @param line The line.
	 * @param basisQuantity The basis the caller stated, when it stated one.
	 * @returns The quantity the line is invoiced against. The caller's own statement wins, because the
	 * basis is read from the variant's billing policy by the bridge that knows the variant; otherwise
	 * the ordered quantity is used, which is what that policy's own default means.
	 */
	private readBasis(line: OrderLine, basisQuantity?: number | string): string {
		return basisQuantity === undefined || basisQuantity === null
			? `${line.quantity ?? 0}`
			: this.readDecimal(basisQuantity, 'basisQuantity');
	}

	/**
	 * @param line The line being billed.
	 * @throws BadRequestException when the line is a presentation row, which carries no quantity and no
	 * price and therefore cannot be billed.
	 */
	private assertLineIsBillable(line: OrderLine): void {
		const kind = line.kind ?? 'ITEM';

		if (kind !== 'ITEM') {
			throw new BadRequestException(
				`ORDER_LINE_NOT_BILLABLE: the line ${line.id} is a ${kind} row, which carries no quantity and no price.`
			);
		}
	}

	/**
	 * @param line The line being billed.
	 * @param currency The currency the caller states for the item.
	 * @param tenantId The caller's tenant.
	 * @param organizationId The caller's organization.
	 * @throws BadRequestException when the currency is not the order's, because an amount in another
	 * currency cannot be summed into the same total.
	 * @throws NotFoundException when the order is not the caller's.
	 */
	private async assertCurrencyIsTheOrders(
		line: OrderLine,
		currency: string,
		tenantId: ID,
		organizationId: ID
	): Promise<void> {
		if (!currency) {
			throw new BadRequestException(
				'ORDER_LINE_INVOICE_CURRENCY_REQUIRED: an amount is recorded with the currency it is in.'
			);
		}

		const order = await this.typeOrmOrderRepository.findOne({
			where: { id: line.orderId, tenantId, organizationId } as FindOptionsWhere<Order>
		});

		if (!order) {
			throw new NotFoundException(`ORDER_NOT_FOUND: no order exists with id ${line.orderId}.`);
		}

		if (String(order.currency).toUpperCase() !== String(currency).toUpperCase()) {
			throw new BadRequestException(
				`ORDER_LINE_INVOICE_CURRENCY_MISMATCH: the order is in ${order.currency} and the item states ${currency}, ` +
					'so the two cannot be summed into one total.'
			);
		}
	}

	/**
	 * @param value A quantity from a caller.
	 * @param field The field name, used in the refusal.
	 * @returns The quantity as an exact decimal string.
	 * @throws BadRequestException when the quantity is not a positive decimal.
	 */
	private readQuantity(value: number | string, field: string): string {
		const quantity = this.readDecimal(value, field);

		if (compareDecimalStrings(quantity, '0') <= 0) {
			throw new BadRequestException(
				`ORDER_LINE_INVOICE_QUANTITY_INVALID: a link bills a positive quantity; a credit is the same quantity with direction CREDIT.`
			);
		}

		return quantity;
	}

	/**
	 * @param value An amount from a caller.
	 * @param field The field name, used in the refusal.
	 * @returns The amount as an exact decimal string. It is signed: a credit carries a negative amount.
	 * @throws BadRequestException when the amount is not a decimal.
	 */
	private readSignedAmount(value: number | string, field: string): string {
		return this.readDecimal(value, field);
	}

	/**
	 * @param value A decimal from a caller.
	 * @param field The field name, used in the refusal.
	 * @returns The value as an exact decimal string.
	 * @throws BadRequestException when the value is not a decimal number.
	 */
	private readDecimal(value: number | string, field: string): string {
		const text = typeof value === 'number' ? String(value) : `${value ?? ''}`.trim();

		if (text === '' || !/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(text)) {
			throw new BadRequestException(`ORDER_LINE_INVOICE_INVALID: ${field} "${text}" is not a decimal number.`);
		}

		return text;
	}
}
