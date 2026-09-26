import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import { Money, RequestContext, TenantAwareCrudService } from '@gauzy/core';
import {
	IPurchaseOrderLine,
	IPurchaseOrderLineInput,
	IVendorTermLinePricing,
	PurchaseBillingPolicy,
	PurchasingCodes
} from '../purchasing.types';
import {
	addQuantity,
	isPositiveQuantity,
	negateQuantity,
	normalizeQuantity,
	sumQuantity,
	toBaseQuantity,
	toQuantityUnits
} from '../purchasing.quantity';
import { PurchaseOrder } from '../purchase-order/purchase-order.entity';
import { VendorProductTermService } from '../vendor-product-term/vendor-product-term.service';
import { PurchaseOrderLine } from './purchase-order-line.entity';
import { MikroOrmPurchaseOrderLineRepository } from './repository/mikro-orm-purchase-order-line.repository';
import { TypeOrmPurchaseOrderLineRepository } from './repository/type-orm-purchase-order-line.repository';

/** What a line needs to know about its order before its price can be resolved. */
export interface IPurchaseOrderLineContext {
	/** The supplier the order is with, which is what a term is scoped to. */
	vendorId?: ID;
	/** The single currency the order's amounts are stated in. */
	currency?: CurrencyCode;
	/** The instant the terms are resolved at; now when omitted. */
	date?: Date;
}

/** One day, which is the unit a resolved lead time is stated in. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** What one ordered line is worth, computed from the line itself. */
export interface IPurchaseOrderLineAmounts {
	/** `quantity × unitCost`, at the currency's scale. */
	net: DecimalString;
	/** The line discount, at the currency's scale. */
	discount: DecimalString;
	/** Tax on the discounted net, at the currency's scale. */
	tax: DecimalString;
	/** `net − discount + tax`, which is what the line column holds. */
	total: DecimalString;
}

/** What a whole order is worth, computed from its lines. */
export interface IPurchaseOrderTotals {
	subtotal: DecimalString;
	discountTotal: DecimalString;
	taxTotal: DecimalString;
	shippingTotal: DecimalString;
	grandTotal: DecimalString;
}

/** One signed change to a line's received counters. */
export interface IPurchaseOrderLineDelta {
	lineId: ID;
	/** Good units to add; negative to take them back off, as a reversal does. */
	receivedQuantity: DecimalString;
	/** Damaged units to add; negative to take them back off. */
	damagedQuantity: DecimalString;
}

/**
 * The lines of a purchase order.
 *
 * **The rule this service exists for:** the money on a purchase order is derived, never stated. Every
 * line total and every header total is recomputed from the ordered quantities, the unit costs, the
 * discounts and the tax rates on every write, so a corrected line cannot leave a stale total behind
 * and the header formula the database documents — `subtotal − discountTotal + taxTotal + shippingTotal`
 * — holds by construction rather than by convention.
 *
 * **Where a price comes from** is the second rule, and it is the reason the vendor terms exist: a line
 * that states no cost is priced from the standing agreement — the winning term, then the variant's own
 * cost price, and a clear refusal when neither exists, because a line with no price would post a
 * zero-cost commitment. What priced the line is recorded on it as provenance and snapshotted beside the
 * lead time the same resolution carried, so the line never re-reads the term: a term edited today
 * changes future orders only.
 *
 * **The three quantities of the match are kept apart.** Ordered and received are written by the order
 * and by goods receipts; billed is a **cache re-derived** from the bill lines by the bill side, and what
 * is still unbilled is derived at read from the variant's billing policy rather than stored a second
 * time.
 *
 * Quantities are exact: a line's `quantity` is compared and summed as scaled integers, through the
 * domain's quantity helpers, and every amount goes through the platform money layer rather than
 * through inline arithmetic on numbers.
 */
@Injectable()
export class PurchaseOrderLineService extends TenantAwareCrudService<PurchaseOrderLine> {
	constructor(
		readonly typeOrmPurchaseOrderLineRepository: TypeOrmPurchaseOrderLineRepository,
		readonly mikroOrmPurchaseOrderLineRepository: MikroOrmPurchaseOrderLineRepository,
		private readonly vendorProductTermService: VendorProductTermService
	) {
		super(typeOrmPurchaseOrderLineRepository, mikroOrmPurchaseOrderLineRepository);
	}

	/**
	 * Reads the lines of a purchase order, scoped to the caller's tenant and organization.
	 *
	 * @param purchaseOrderId The order to read.
	 * @returns The lines, oldest first.
	 */
	public async findForOrder(purchaseOrderId: ID): Promise<PurchaseOrderLine[]> {
		return await this.typeOrmPurchaseOrderLineRepository.find({
			where: {
				purchaseOrderId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			order: { createdAt: 'ASC' }
		});
	}

	/**
	 * Reads the lines of a purchase order keyed by their identity, which is how a receipt resolves the
	 * line it is against.
	 *
	 * @param purchaseOrderId The order to read.
	 * @returns The lines, keyed by id.
	 */
	public async findForOrderIndexed(purchaseOrderId: ID): Promise<Map<ID, PurchaseOrderLine>> {
		const lines = await this.findForOrder(purchaseOrderId);

		return new Map(lines.map((line) => [line.id, line]));
	}

	/**
	 * Replaces the line set of a purchase order.
	 *
	 * Replacement rather than merge: a purchase order is one commercial document, and the totals are a
	 * function of the whole line set, so writing the set as a unit is what keeps the totals and the
	 * lines from disagreeing. The lines that are removed are soft-deleted, so the partial unique index
	 * on `(purchaseOrderId, variantId, expectedAt)` keeps working for the replacements.
	 *
	 * A line that states no cost is priced from the standing agreement before it is written, and the
	 * lead time the same resolution carried is snapshotted beside the price, so the order can be dated
	 * from the instant it is actually sent without ever re-reading the term.
	 *
	 * @param purchaseOrderId The order to write the lines of.
	 * @param inputs The ordered lines.
	 * @param context The supplier and currency the prices are resolved against, when the caller knows them.
	 * @returns The written lines.
	 * @throws BadRequestException when no line was given, a line's quantity is not positive, the same
	 * variant is ordered twice for one expected date, or nothing prices a line that states no cost.
	 */
	public async replaceLines(
		purchaseOrderId: ID,
		inputs: IPurchaseOrderLineInput[],
		context: IPurchaseOrderLineContext = {}
	): Promise<PurchaseOrderLine[]> {
		if (!Array.isArray(inputs) || inputs.length === 0) {
			throw new BadRequestException('A purchase order needs at least one line.');
		}

		const seen = new Set<string>();

		for (const input of inputs) {
			if (!input?.variantId) {
				throw new BadRequestException('Every purchase-order line must name the variant being bought.');
			}

			// One line per variant **and expected date**: a split commitment is two lines, and the same
			// variant on the same date twice is a double entry.
			const identity = `${input.variantId}@${input.expectedAt ? new Date(input.expectedAt).toISOString() : ''}`;

			if (seen.has(identity)) {
				throw new BadRequestException(
					`Variant ${input.variantId} is ordered twice on one purchase order for the same expected date; a line is one variant per date.`
				);
			}

			seen.add(identity);

			if (!isPositiveQuantity(input.quantity)) {
				throw new BadRequestException(`Variant ${input.variantId} is ordered in a non-positive quantity.`);
			}
		}

		await this.typeOrmPurchaseOrderLineRepository.softDelete({ purchaseOrderId });

		const lines: PurchaseOrderLine[] = [];

		for (const input of inputs) {
			const pricing = await this.priceLine(input, context);

			lines.push(
				await super.create({
					purchaseOrderId,
					variantId: input.variantId,
					unitId: input.unitId,
					conversionFactor:
						input.conversionFactor === undefined ? '1' : normalizeQuantity(input.conversionFactor),
					quantity: normalizeQuantity(input.quantity),
					receivedQuantity: '0',
					damagedQuantity: '0',
					billedQuantity: '0',
					unitCost: pricing.unitCost,
					orderedPackSize: pricing.orderedPackSize,
					vendorTermId: pricing.vendorTermId,
					taxRate: input.taxRate === undefined ? undefined : normalizeQuantity(input.taxRate),
					discountTotal: pricing.discountTotal,
					total: '0',
					expectedAt: input.expectedAt,
					note: input.note,
					metadata: this.pricingMetadata(input, pricing)
				} as any)
			);
		}

		return lines;
	}

	/**
	 * Adds one line to a purchase order that is still a draft.
	 *
	 * Written as a replacement of the whole set, because that is the path that already validates it: a
	 * variant may appear once per expected date on an order, and a quantity has to be positive. The set
	 * is read back, the new line appended and the set rewritten, which keeps the line surface and the
	 * order surface from having two different sets of rules — and the lines that survive the rewrite
	 * carry their price, their provenance and their lead-time snapshot across with them.
	 *
	 * @param purchaseOrderId The order to add the line to.
	 * @param input The line to add.
	 * @param context The supplier and currency the prices are resolved against, when the caller knows them.
	 * @returns The line that was written.
	 */
	public async addLine(
		purchaseOrderId: ID,
		input: IPurchaseOrderLineInput,
		context: IPurchaseOrderLineContext = {}
	): Promise<PurchaseOrderLine> {
		const existing = await this.findForOrder(purchaseOrderId);
		const inputs: IPurchaseOrderLineInput[] = existing.map((line) => ({
			variantId: line.variantId,
			quantity: line.quantity,
			unitId: line.unitId,
			conversionFactor: line.conversionFactor,
			unitCost: line.unitCost,
			vendorTermId: line.vendorTermId,
			taxRate: line.taxRate,
			discountTotal: line.discountTotal,
			expectedAt: line.expectedAt,
			note: line.note,
			metadata: line.metadata
		}));

		inputs.push(input);

		const written = await this.replaceLines(purchaseOrderId, inputs, context);

		return written[written.length - 1];
	}

	/**
	 * Reads a set of lines by their identity, whoever's order they belong to.
	 *
	 * A consolidated receipt names lines from several orders, so it cannot resolve them through one
	 * order: it asks for the lines it was given and is answered with what the caller may see.
	 *
	 * @param ids The lines to read.
	 * @returns The lines, keyed by id.
	 * @throws BadRequestException when no line was named.
	 */
	public async findIndexedByIds(ids: ID[]): Promise<Map<ID, PurchaseOrderLine>> {
		if (!Array.isArray(ids) || ids.length === 0) {
			throw new BadRequestException('PURCHASE_ORDER_LINE_NOT_FOUND: no purchase-order line was named.');
		}

		const lines = await this.typeOrmPurchaseOrderLineRepository.find({
			where: {
				id: ids as any,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as any
		});

		return new Map(lines.map((line) => [line.id, line]));
	}

	/**
	 * Writes the expected date of the lines that do not carry one, from the lead time the term resolved.
	 *
	 * Called when the order is sent, because that is the instant a lead time is measured from:
	 * `expectedAt = orderedAt + leadTimeDays`. The lead time comes from the line's own snapshot, so no
	 * term is read here — a term renegotiated since the order was raised cannot move a commitment the
	 * supplier has already been given. A line that states its own expected date keeps it: a stated date
	 * is a commitment, and this only fills in what the agreement implies.
	 *
	 * @param purchaseOrderId The order being sent.
	 * @param orderedAt The instant the order went out.
	 * @returns The lines, with their expected dates written.
	 */
	public async applyLeadTimes(purchaseOrderId: ID, orderedAt: Date): Promise<PurchaseOrderLine[]> {
		const lines = await this.findForOrder(purchaseOrderId);
		const written: PurchaseOrderLine[] = [];

		for (const line of lines) {
			if (line.expectedAt) {
				written.push(line);
				continue;
			}

			const snapshot = (line.metadata ?? {})['pricing'] as { leadTimeDays?: number } | undefined;
			const leadTimeDays = Number(snapshot?.leadTimeDays ?? 0);
			const days = Number.isFinite(leadTimeDays) ? leadTimeDays : 0;

			line.expectedAt = new Date(orderedAt.getTime() + days * DAY_MS);
			written.push(await this.typeOrmPurchaseOrderLineRepository.save(line));
		}

		return written;
	}

	/*
	|--------------------------------------------------------------------------
	| The three-way match
	|--------------------------------------------------------------------------
	*/

	/**
	 * Re-derives a line's billed cache from the bill lines that point at it.
	 *
	 * **Re-derived, never incremented.** A bill that is voided, corrected or re-issued has to leave the
	 * cache equal to the sum of the bills that stand, and an increment cannot express that: the caller
	 * hands over every bill line's quantity for this line and the cache becomes their sum. `billedQuantity`
	 * is therefore a cache of a query the bill side can always re-run, which is what makes a divergence
	 * between the two detectable rather than permanent.
	 *
	 * @param lineId The line whose cache is being written.
	 * @param billLineQuantities Every bill line quantity that points at it, as they now stand.
	 * @returns The line, with its cache written.
	 * @throws NotFoundException when the line is not the caller's.
	 */
	public async recomputeBilledQuantity(
		lineId: ID,
		billLineQuantities: Array<DecimalString | number>
	): Promise<PurchaseOrderLine> {
		const line = await this.findScoped(lineId);

		line.billedQuantity = sumQuantity(billLineQuantities ?? []);

		return await this.typeOrmPurchaseOrderLineRepository.save(line);
	}

	/**
	 * What is still unbilled on a line, **derived at read and never stored**.
	 *
	 * The policy decides what the bill is matched against: a supplier who invoices on receipt is measured
	 * against what arrived, a supplier who invoices on order against what was ordered. Storing the
	 * remainder would be a second source of truth for a figure the two quantities it is the difference
	 * of already answer, and a stored remainder is exactly what goes stale when a receipt is reversed.
	 *
	 * **Damaged units count.** Under `ON_RECEIVED` the basis is what the supplier *delivered*, and a unit
	 * that arrived broken was delivered: the entity says so in as many words — `damagedQuantity` is
	 * "counted against the ordered quantity exactly like a good unit, because the supplier delivered it
	 * and the organization paid for it" — and every other consumer of the pair treats them together
	 * (`statusFromLines`, `outstandingQuantity`, the over-receipt ceiling). Leaving the damaged units out
	 * of the basis measured a ten-unit delivery of eight good and two broken as eight billable, so the
	 * supplier's invoice for the ten units the organization is contractually liable for was refused as
	 * over-billing and could not be posted at all. Recovering the value of the broken units is a debit
	 * note against a bill that exists, which is a different document from the bill this refuses.
	 *
	 * @param line The line being read.
	 * @param policy What the supplier's bill is matched against.
	 * @returns What is still unbilled, floored at zero, as an exact decimal.
	 */
	public toBillQuantity(
		line: Pick<IPurchaseOrderLine, 'quantity' | 'receivedQuantity' | 'damagedQuantity' | 'billedQuantity'>,
		policy: PurchaseBillingPolicy
	): DecimalString {
		const against =
			policy === PurchaseBillingPolicy.ON_RECEIVED
				? sumQuantity([line.receivedQuantity ?? 0, line.damagedQuantity ?? 0])
				: normalizeQuantity(line.quantity ?? 0);
		const remaining = sumQuantity([against, negateQuantity(line.billedQuantity ?? 0)]);

		return toQuantityUnits(remaining) < 0n ? '0.000000' : remaining;
	}

	/**
	 * Refuses a bill that would take a line past what its policy allows.
	 *
	 * @param lineId The line being billed.
	 * @param billQuantity The quantity the bill line states.
	 * @param policy What the supplier's bill is matched against.
	 * @returns The line, once the bill is known to fit inside its policy.
	 * @throws NotFoundException when the line is not the caller's.
	 * @throws BadRequestException when billing this much would pass what the policy allows, which is the
	 * over-billing the match exists to catch.
	 */
	public async assertNotOverbilled(
		lineId: ID,
		billQuantity: DecimalString | number,
		policy: PurchaseBillingPolicy
	): Promise<PurchaseOrderLine> {
		const line = await this.findScoped(lineId);
		const remaining = this.toBillQuantity(line, policy);

		if (toQuantityUnits(billQuantity) > toQuantityUnits(remaining)) {
			throw new BadRequestException(
				`${PurchasingCodes.PURCHASE_LINE_OVERBILLED}: purchase-order line '${line.id}' has ${remaining} still billable under ${policy}, and the bill states ${normalizeQuantity(billQuantity)}.`
			);
		}

		return line;
	}

	/**
	 * Refuses a bill line whose purchase line belongs to another supplier's order.
	 *
	 * A bill settles a supplier's own orders: matching one supplier's line against another's order would
	 * pay the wrong party and hide the real bill that has not arrived.
	 *
	 * @param lineId The purchase line the bill names.
	 * @param vendorId The supplier the bill is from.
	 * @returns The line, once it is known to belong to that supplier.
	 * @throws NotFoundException when the line or its order cannot be read.
	 * @throws BadRequestException when the order belongs to another supplier.
	 */
	public async assertBillVendorMatches(lineId: ID, vendorId: ID): Promise<PurchaseOrderLine> {
		const line = await this.findScoped(lineId);
		const order = await this.typeOrmPurchaseOrderLineRepository.manager.findOne(PurchaseOrder, {
			where: {
				id: line.purchaseOrderId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as any
		});

		if (!order) {
			throw new NotFoundException(
				`PURCHASE_ORDER_NOT_FOUND: the order of purchase-order line '${lineId}' could not be found.`
			);
		}

		if (String(order.vendorId) !== String(vendorId)) {
			throw new BadRequestException(
				`${PurchasingCodes.PURCHASE_BILL_VENDOR_MISMATCH}: purchase-order line '${lineId}' belongs to order '${order.number}', which is with another supplier.`
			);
		}

		return line;
	}

	/**
	 * Reads one line scoped to the caller's tenant and organization.
	 *
	 * @param id The line to read.
	 * @returns The line.
	 * @throws NotFoundException when it is not the caller's.
	 */
	public async findScoped(id: ID): Promise<PurchaseOrderLine> {
		const line = await this.typeOrmPurchaseOrderLineRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as any
		});

		if (!line) {
			throw new NotFoundException(`PURCHASE_ORDER_LINE_NOT_FOUND: purchase-order line '${id}' could not be found.`);
		}

		return line;
	}

	/**
	 * Resolves the pricing of one line as the caller stated it.
	 *
	 * A caller that states a cost has priced the line by hand and keeps whatever provenance it states
	 * with it, so a line set rewritten as a unit does not lose the term its price came from. That holds
	 * whichever branch prices the line: the resolution that takes a stated figure reports no winning row
	 * to offer as provenance, so the caller's own is carried through onto the line rather than being
	 * left behind at the delegation. A caller that states none is priced by the agreement, which is the
	 * whole reason the terms are standing rows, and the winner the resolution found is what the line
	 * then records. Without a supplier and a currency there is no agreement to resolve against, and the
	 * line has to state its own price rather than be written at zero.
	 *
	 * @param input The line as the caller supplied it.
	 * @param context The supplier and currency to resolve against, when known.
	 * @returns The pricing to write onto the line.
	 */
	private async priceLine(
		input: IPurchaseOrderLineInput,
		context: IPurchaseOrderLineContext
	): Promise<IVendorTermLinePricing> {
		const currency = context.currency;

		if (!context.vendorId || !currency) {
			if (input.unitCost === undefined || input.unitCost === null || String(input.unitCost).trim() === '') {
				throw new BadRequestException(
					`${PurchasingCodes.PURCHASE_ORDER_LINE_COST_REQUIRED}: a line written without its order's supplier has nothing to price it from, so it has to state its own unit cost.`
				);
			}

			return {
				unitCost: normalizeQuantity(input.unitCost),
				discountTotal: normalizeQuantity(input.discountTotal ?? 0),
				vendorTermId: input.vendorTermId,
				leadTimeDays: 0,
				source: 'MANUAL',
				warnings: []
			};
		}

		const pricing = await this.vendorProductTermService.priceLine(
			{
				vendorId: context.vendorId,
				variantId: input.variantId,
				quantity: toBaseQuantity(input.quantity, input.conversionFactor),
				unitCost: input.unitCost,
				discountTotal: input.discountTotal,
				date: context.date
			},
			currency
		);

		// A line the caller priced by hand has no winning row behind it, so the only provenance there is
		// to record is the one the caller stated with the price (`IPurchaseOrderLineInput.vendorTermId`).
		// A line the agreement priced keeps the winner the resolution itself answered with.
		return pricing.source === 'MANUAL' ? { ...pricing, vendorTermId: input.vendorTermId } : pricing;
	}

	/**
	 * Builds the extras a priced line carries.
	 *
	 * The resolution's provenance and the lead time it produced are snapshotted beside the caller's own
	 * extras, which is what lets the send transition date the line without re-reading the term, and what
	 * makes a missing term visible on the line it affected rather than only in a log.
	 *
	 * @param input The line as the caller supplied it.
	 * @param pricing The pricing that was resolved for it.
	 * @returns The metadata to write.
	 */
	private pricingMetadata(
		input: IPurchaseOrderLineInput,
		pricing: { source: string; leadTimeDays: number; warnings: string[] }
	): Record<string, unknown> {
		return {
			...(input.metadata ?? {}),
			pricing: {
				source: pricing.source,
				leadTimeDays: pricing.leadTimeDays,
				warnings: pricing.warnings
			}
		};
	}

	/**
	 * Rewrites the derived total of every line of an order.
	 *
	 * Called after a line was added, changed or removed through the line surface, because the line's
	 * own `total` is derived from its quantity, cost, discount and tax rate and must never be left
	 * holding a value that no longer follows from them.
	 *
	 * @param purchaseOrderId The order whose lines are rewritten.
	 * @param currency The order's currency.
	 * @returns The lines, with their totals written.
	 */
	public async rewriteLineTotals(purchaseOrderId: ID, currency: CurrencyCode): Promise<PurchaseOrderLine[]> {
		return await this.writeLineTotals(await this.findForOrder(purchaseOrderId), currency);
	}

	/**
	 * Computes what one ordered line is worth.
	 *
	 * @param input The ordered line.
	 * @param currency The order's currency.
	 * @returns The net, discount, tax and total, each at the currency's scale.
	 */
	public computeLineAmounts(
		input: Pick<IPurchaseOrderLineInput, 'quantity' | 'unitCost' | 'taxRate' | 'discountTotal'>,
		currency: CurrencyCode
	): IPurchaseOrderLineAmounts {
		const net = Money.of(String(input.unitCost ?? 0), currency).multiply(String(input.quantity ?? 0)).round();
		const discount = Money.of(String(input.discountTotal ?? 0), currency).round();
		const taxable = net.subtract(discount);
		const tax = taxable.multiply(String(input.taxRate ?? 0)).round();

		return {
			net: net.toStorageString(),
			discount: discount.toStorageString(),
			tax: tax.toStorageString(),
			total: taxable.add(tax).toStorageString()
		};
	}

	/**
	 * Computes what a whole order is worth from the lines it holds.
	 *
	 * The header formula is the one the table documents: the subtotal is the gross of the line
	 * discounts, the discount and tax totals are the sums of the lines' own, and the grand total is
	 * `subtotal − discountTotal + taxTotal + shippingTotal`. Nothing is accumulated across writes, so
	 * the figure can always be reproduced from the lines that are stored beside it.
	 *
	 * @param inputs The ordered lines.
	 * @param currency The order's currency.
	 * @param shippingTotal The freight and handling charged for the order as a whole.
	 * @returns The header totals, each at the currency's scale.
	 */
	public computeOrderTotals(
		inputs: Array<Pick<IPurchaseOrderLineInput, 'quantity' | 'unitCost' | 'taxRate' | 'discountTotal'>>,
		currency: CurrencyCode,
		shippingTotal?: DecimalString | number
	): IPurchaseOrderTotals {
		let subtotal = Money.zero(currency);
		let discountTotal = Money.zero(currency);
		let taxTotal = Money.zero(currency);

		for (const input of inputs) {
			const amounts = this.computeLineAmounts(input, currency);

			subtotal = subtotal.add(Money.of(amounts.net, currency));
			discountTotal = discountTotal.add(Money.of(amounts.discount, currency));
			taxTotal = taxTotal.add(Money.of(amounts.tax, currency));
		}

		const shipping = Money.of(String(shippingTotal ?? 0), currency).round();

		return {
			subtotal: subtotal.toStorageString(),
			discountTotal: discountTotal.toStorageString(),
			taxTotal: taxTotal.toStorageString(),
			shippingTotal: shipping.toStorageString(),
			grandTotal: subtotal.subtract(discountTotal).add(taxTotal).add(shipping).toStorageString()
		};
	}

	/**
	 * Computes what a stored line set is worth, which is how the recomputation after a receipt reads.
	 *
	 * @param lines The stored lines.
	 * @param currency The order's currency.
	 * @param shippingTotal The order's stated freight charge.
	 * @returns The header totals.
	 */
	public computeTotalsForLines(
		lines: PurchaseOrderLine[],
		currency: CurrencyCode,
		shippingTotal?: DecimalString | number
	): IPurchaseOrderTotals {
		return this.computeOrderTotals(
			lines.map((line) => ({
				quantity: line.quantity,
				unitCost: line.unitCost,
				taxRate: line.taxRate,
				discountTotal: line.discountTotal
			})),
			currency,
			shippingTotal
		);
	}

	/**
	 * Writes the line totals that follow from each line's own columns.
	 *
	 * Called after the line set is written, so the `total` column is never a value a caller supplied:
	 * it is the same computation the header totals use, applied per line.
	 *
	 * @param lines The stored lines.
	 * @param currency The order's currency.
	 * @returns The lines, with their totals written.
	 */
	public async writeLineTotals(lines: PurchaseOrderLine[], currency: CurrencyCode): Promise<PurchaseOrderLine[]> {
		const written: PurchaseOrderLine[] = [];

		for (const line of lines) {
			const amounts = this.computeLineAmounts(
				{
					quantity: line.quantity,
					unitCost: line.unitCost,
					taxRate: line.taxRate,
					discountTotal: line.discountTotal
				},
				currency
			);

			line.total = amounts.total;
			written.push(await this.typeOrmPurchaseOrderLineRepository.save(line));
		}

		return written;
	}

	/**
	 * Applies a signed change to the received counters of the order's lines.
	 *
	 * This is the only path that moves `receivedQuantity` and `damagedQuantity`, and it is called by
	 * the receipt service with the quantity that arrived — or, when a receipt is reversed, with the
	 * same quantity negated. The counters are the order's record of what the stock ledger already
	 * holds, so an edit route deliberately cannot reach them.
	 *
	 * @param purchaseOrderId The order being received against.
	 * @param deltas The signed changes, per order line.
	 * @returns The updated lines.
	 * @throws NotFoundException when a line does not belong to the order.
	 */
	public async applyReceiptDeltas(
		purchaseOrderId: ID,
		deltas: IPurchaseOrderLineDelta[]
	): Promise<PurchaseOrderLine[]> {
		const indexed = await this.findForOrderIndexed(purchaseOrderId);
		const touched: PurchaseOrderLine[] = [];

		for (const delta of deltas) {
			const line = indexed.get(delta.lineId);

			if (!line) {
				throw new NotFoundException(`Purchase-order line ${delta.lineId} does not belong to this order.`);
			}

			line.receivedQuantity = addQuantity(line.receivedQuantity ?? '0', delta.receivedQuantity);
			line.damagedQuantity = addQuantity(line.damagedQuantity ?? '0', delta.damagedQuantity);

			if (toQuantityUnits(line.receivedQuantity) < 0n || toQuantityUnits(line.damagedQuantity) < 0n) {
				throw new BadRequestException(
					`Reversing this receipt would take line ${delta.lineId} below what it has received.`
				);
			}

			touched.push(line);
		}

		return await this.typeOrmPurchaseOrderLineRepository.save(touched);
	}
}
