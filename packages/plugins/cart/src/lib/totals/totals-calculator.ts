import { Money } from '@gauzy/core';
import { CurrencyCode, ICommerceCartTotals, RoundingMode } from '@gauzy/contracts';

/**
 * One line as the totals chain sees it.
 */
export interface ITotalsLine {
	/** Identity of the line, used to match its adjustments and tax lines to it. */
	id: string;
	/** Ordered quantity. */
	quantity: number;
	/** Unit price, already rounded at the unit-price boundary. */
	unitPrice: number;
	/** True when `unitPrice` is a gross: the line's tax is extracted from it rather than added to it. */
	isTaxInclusive: boolean;
}

/**
 * One shipping method as the totals chain sees it.
 */
export interface ITotalsShippingMethod {
	id: string;
	/** The method's amount, rounded at the shipping boundary. */
	amount: number;
	isTaxInclusive: boolean;
}

/**
 * One row of the core `adjustment` ledger, as the totals chain sees it.
 */
export interface ITotalsAdjustment {
	/** The line, shipping method or document the adjustment belongs to. */
	ownerId: string;
	/** Signed amount. Negative reduces what is payable. */
	amount: number;
	/** True when `amount` is expressed in the owner's gross basis. */
	isTaxInclusive: boolean;
	/**
	 * The net part of an inclusive adjustment, when the ledger row carries it in its metadata. A
	 * gross discount on an inclusive line reduces the taxable base by its net part, not by its gross.
	 */
	netAmount?: number;
}

/**
 * One row of the core `tax_line` ledger, as the totals chain sees it.
 */
export interface ITotalsTaxLine {
	/** The line or shipping method the tax belongs to. */
	ownerId: string;
	/** The rounded tax amount. */
	amount: number;
}

/**
 * One row of an order's money ledger, as the totals chain sees it.
 */
export interface ITotalsTransaction {
	/** Signed amount: positive is money received, negative is money returned. */
	amount: number;
	/** The transaction's kind, which decides whether it counts towards the paid or the refunded total. */
	type: string;
}

/**
 * Everything the totals chain reads.
 */
export interface ITotalsContext {
	/** The currency every amount is expressed in. */
	currency: CurrencyCode;
	/** The currency's decimal places, snapshotted on the owning row. */
	currencyDecimals: number;
	lines: ITotalsLine[];
	shippingMethods: ITotalsShippingMethod[];
	/** Adjustments owned by a line. */
	lineAdjustments: ITotalsAdjustment[];
	/** Adjustments owned by a shipping method. */
	shippingAdjustments: ITotalsAdjustment[];
	/** Tax lines owned by a line. */
	lineTaxLines: ITotalsTaxLine[];
	/** Tax lines owned by a shipping method. */
	shippingTaxLines: ITotalsTaxLine[];
	/** Order only: the credit lines that reduce what the customer owes. */
	creditLines?: number[];
	/** Order only: the money ledger. */
	transactions?: ITotalsTransaction[];
}

/**
 * The complete computed total set of a document.
 *
 * A cart stores the first eleven fields; an order stores all of them. The values are `number` because
 * that is what a `numeric(20,6)` column arrives as through the platform's numeric transformer — the
 * *arithmetic* never touches a float: every step below is performed by the core `Money` value object
 * on exact decimals, and the conversion happens once, at the column boundary.
 */
export interface ITotalsSnapshot extends ICommerceCartTotals {
	/** Order only: the sum of the credit lines, which is not money received. */
	creditTotal?: number;
	/** Order only: settled money. */
	paidTotal?: number;
	/** Order only: money returned, as a positive magnitude. */
	refundedTotal?: number;
	/** Order only: `grandTotal - creditTotal - paidTotal + refundedTotal`. */
	outstandingTotal?: number;
}

/**
 * The single totals function of the platform.
 *
 * Applied identically to a cart and to an order — the two differ only in the last four steps, which an
 * order runs because it has a money ledger and a cart does not. Rounding happens at exactly the
 * boundaries the money specification names, intermediate values keep the full working scale, and
 * nothing here rounds a total: `grandTotal` is the exact sum of already-rounded components, which is
 * what makes the totals invariants hold by construction rather than by reconciliation.
 *
 * One function, used by the cart's recalculation, by the order's totals writer and by every document
 * that carries a totals snapshot. A second implementation is the defect this class exists to prevent.
 */
export class TotalsCalculator {
	/** Transaction kinds that count as money received. */
	private static readonly PAID_TRANSACTION_TYPES = ['CAPTURE', 'CREDIT', 'MANUAL'];

	/** Transaction kinds that count as money returned. */
	private static readonly REFUNDED_TRANSACTION_TYPES = ['REFUND', 'CHARGEBACK', 'VOID', 'MANUAL'];

	/**
	 * Computes every total of a document.
	 *
	 * @param context Everything the chain reads.
	 * @returns The computed totals, exact at the currency's scale.
	 * @throws Error when a component is not settled at the currency's scale, which means the caller
	 * wrote a value that had not crossed its boundary.
	 */
	static compute(context: ITotalsContext): ITotalsSnapshot {
		const currency = context.currency;
		const decimals = context.currencyDecimals;
		const zero = Money.zero(currency, decimals);

		// Step 1 — line subtotals and their net basis. A tax-inclusive line is normalised to net here,
		// so the grand total is identical whether the catalogue is priced inclusive or exclusive.
		const lineNet = new Map<string, Money>();

		for (const line of context.lines) {
			const gross = this.round(
				Money.of(line.unitPrice, currency, decimals).multiply(line.quantity),
				decimals
			);
			const tax = this.sumTaxLines(
				context.lineTaxLines.filter((taxLine) => taxLine.ownerId === line.id),
				currency,
				decimals
			);

			lineNet.set(line.id, line.isTaxInclusive ? gross.subtract(tax) : gross);
		}

		const itemSubtotal = this.sum([...lineNet.values()], currency, decimals);

		// Step 2 — line discounts and fees. An inclusive adjustment contributes its net part.
		const lineDiscounts = new Map<string, Money>();

		for (const line of context.lines) {
			const adjustments = context.lineAdjustments.filter((adjustment) => adjustment.ownerId === line.id);
			lineDiscounts.set(line.id, this.discountOf(adjustments, currency, decimals));
		}

		const itemDiscountTotal = this.sum([...lineDiscounts.values()], currency, decimals);
		const itemTaxTotal = this.sumTaxLines(context.lineTaxLines, currency, decimals);

		// Steps 5–8 — shipping, on the same rules as a line.
		let shippingSubtotal = zero;
		let shippingDiscountTotal = zero;

		for (const method of context.shippingMethods) {
			const amount = Money.of(method.amount, currency, decimals);
			const tax = this.sumTaxLines(
				context.shippingTaxLines.filter((taxLine) => taxLine.ownerId === method.id),
				currency,
				decimals
			);

			shippingSubtotal = shippingSubtotal.add(
				method.isTaxInclusive ? this.round(amount, decimals).subtract(tax) : this.round(amount, decimals)
			);
			shippingDiscountTotal = shippingDiscountTotal.add(
				this.discountOf(
					context.shippingAdjustments.filter((adjustment) => adjustment.ownerId === method.id),
					currency,
					decimals
				)
			);
		}

		// A shipping-scoped discount whose owner is the cart itself rather than one method still reduces
		// what is payable, so it is added to the shipping discount total.
		const unattributedShippingDiscount = this.discountOf(
			context.shippingAdjustments.filter(
				(adjustment) => !context.shippingMethods.some((method) => method.id === adjustment.ownerId)
			),
			currency,
			decimals
		);
		shippingDiscountTotal = shippingDiscountTotal.add(unattributedShippingDiscount);

		const shippingTaxTotal = this.sumTaxLines(context.shippingTaxLines, currency, decimals);

		// Step 10 — the totals themselves.
		const discountTotal = itemDiscountTotal.add(shippingDiscountTotal);
		const taxTotal = itemTaxTotal;
		const grandTotal = itemSubtotal
			.subtract(discountTotal)
			.add(taxTotal)
			.add(shippingSubtotal)
			.add(shippingTaxTotal);

		const snapshot: ITotalsSnapshot = {
			itemSubtotal: this.toColumn(itemSubtotal, decimals),
			itemDiscountTotal: this.toColumn(itemDiscountTotal, decimals),
			itemTaxTotal: this.toColumn(itemTaxTotal, decimals),
			shippingSubtotal: this.toColumn(shippingSubtotal, decimals),
			shippingDiscountTotal: this.toColumn(shippingDiscountTotal, decimals),
			shippingTaxTotal: this.toColumn(shippingTaxTotal, decimals),
			discountTotal: this.toColumn(discountTotal, decimals),
			taxTotal: this.toColumn(taxTotal, decimals),
			grandTotal: this.toColumn(grandTotal, decimals),
			currency,
			currencyDecimals: decimals
		};

		// Steps 11–14 — the order-only tail. A cart runs none of them: it has no credit lines and no
		// money ledger of its own.
		if (context.creditLines || context.transactions) {
			const creditTotal = this.sum(
				(context.creditLines ?? []).map((amount) => Money.of(amount, currency, decimals)),
				currency,
				decimals
			);
			const paidTotal = this.sum(
				this.transactionsOf(context.transactions, this.PAID_TRANSACTION_TYPES, true, currency, decimals),
				currency,
				decimals
			);
			const refundedTotal = this.sum(
				this.transactionsOf(context.transactions, this.REFUNDED_TRANSACTION_TYPES, false, currency, decimals),
				currency,
				decimals
			);
			const outstandingTotal = grandTotal.subtract(creditTotal).subtract(paidTotal).add(refundedTotal);

			snapshot.creditTotal = this.toColumn(creditTotal, decimals);
			snapshot.paidTotal = this.toColumn(paidTotal, decimals);
			snapshot.refundedTotal = this.toColumn(refundedTotal.abs(), decimals);
			snapshot.outstandingTotal = this.toColumn(outstandingTotal, decimals);
		}

		return this.assertSettled(snapshot, currency, decimals);
	}

	/**
	 * Re-derives the grand total from the stored components and refuses a snapshot whose components do
	 * not add up.
	 *
	 * This is the invariant the specification asserts before every commit: a mismatch is not repaired
	 * here, because repairing it would hide the writer that produced it.
	 *
	 * @param snapshot The computed totals.
	 * @param currency The currency.
	 * @param decimals The currency's scale.
	 * @returns The same snapshot.
	 * @throws Error when the components do not sum to the grand total.
	 */
	static assertSettled(snapshot: ITotalsSnapshot, currency: CurrencyCode, decimals: number): ITotalsSnapshot {
		const recomputed = Money.of(snapshot.itemSubtotal, currency, decimals)
			.subtract(Money.of(snapshot.discountTotal, currency, decimals))
			.add(Money.of(snapshot.taxTotal, currency, decimals))
			.add(Money.of(snapshot.shippingSubtotal, currency, decimals))
			.add(Money.of(snapshot.shippingTaxTotal, currency, decimals));

		if (!recomputed.equals(Money.of(snapshot.grandTotal, currency, decimals))) {
			throw new Error(
				`TOTALS_NOT_SETTLED: the components of a ${currency} total sum to ${recomputed.amount} ` +
					`but the grand total is ${snapshot.grandTotal}.`
			);
		}

		if (!Money.of(snapshot.discountTotal, currency, decimals).equals(
			Money.of(snapshot.itemDiscountTotal, currency, decimals).add(
				Money.of(snapshot.shippingDiscountTotal, currency, decimals)
			)
		)) {
			throw new Error(`TOTALS_NOT_SETTLED: the ${currency} discount total is not the sum of its parts.`);
		}

		if (!Money.of(snapshot.taxTotal, currency, decimals).equals(Money.of(snapshot.itemTaxTotal, currency, decimals))) {
			throw new Error(`TOTALS_NOT_SETTLED: the ${currency} tax total must equal the item tax total.`);
		}

		return snapshot;
	}

	/**
	 * Rounds a value at a boundary.
	 *
	 * @param value The value.
	 * @param decimals The currency's scale.
	 * @returns The rounded value.
	 */
	private static round(value: Money, decimals: number): Money {
		return value.round(RoundingMode.HALF_UP, decimals);
	}

	/**
	 * Sums already-rounded values. Adding values that are exact at the currency's scale introduces no
	 * half-way value, so no further rounding is needed and none is applied.
	 *
	 * @param values The values.
	 * @param currency The currency.
	 * @param decimals The currency's scale.
	 * @returns The exact sum.
	 */
	private static sum(values: readonly Money[], currency: CurrencyCode, decimals: number): Money {
		let total = Money.zero(currency, decimals);

		for (const value of values) {
			total = total.add(value);
		}

		return total;
	}

	/**
	 * Sums the tax lines of one owner.
	 *
	 * @param taxLines The rows.
	 * @param currency The currency.
	 * @param decimals The currency's scale.
	 * @returns The exact sum.
	 */
	private static sumTaxLines(
		taxLines: readonly ITotalsTaxLine[],
		currency: CurrencyCode,
		decimals: number
	): Money {
		return this.sum(
			taxLines.map((taxLine) => Money.of(taxLine.amount, currency, decimals)),
			currency,
			decimals
		);
	}

	/**
	 * The discount a set of ledger rows represents, as a positive magnitude.
	 *
	 * A row's net effect is used when the ledger carries it: a discount on a tax-inclusive line reduces
	 * the taxable base by its net part, and conflating that with the gross the customer sees is the
	 * single most common source of a one-cent mismatch.
	 *
	 * @param adjustments The ledger rows of one owner.
	 * @param currency The currency.
	 * @param decimals The currency's scale.
	 * @returns The discount, never negative.
	 */
	private static discountOf(
		adjustments: readonly ITotalsAdjustment[],
		currency: CurrencyCode,
		decimals: number
	): Money {
		let discount = Money.zero(currency, decimals);

		for (const adjustment of adjustments) {
			if (adjustment.amount >= 0) {
				continue;
			}

			const net = adjustment.netAmount ?? Math.abs(adjustment.amount);
			discount = discount.add(Money.of(net, currency, decimals));
		}

		return discount;
	}

	/**
	 * Selects the ledger rows of one kind and returns them as magnitudes.
	 *
	 * @param transactions The ledger, or undefined for a document without one.
	 * @param types The transaction kinds to include.
	 * @param positiveOnly True to take only money-received rows, false to take only money-returned rows.
	 * @param currency The currency.
	 * @param decimals The currency's scale.
	 * @returns The selected amounts.
	 */
	private static transactionsOf(
		transactions: readonly ITotalsTransaction[] | undefined,
		types: readonly string[],
		positiveOnly: boolean,
		currency: CurrencyCode,
		decimals: number
	): Money[] {
		return (transactions ?? [])
			.filter((transaction) => types.includes(transaction.type))
			.filter((transaction) => (positiveOnly ? transaction.amount > 0 : transaction.amount < 0))
			.map((transaction) => Money.of(Math.abs(transaction.amount), currency, decimals));
	}

	/**
	 * Converts a computed value for a `numeric(20,6)` column.
	 *
	 * This is the only place a computed amount becomes a `number`, and it happens after every boundary
	 * has been crossed: the column is the platform's storage form for money and its transformer reads
	 * it as a number, so the conversion belongs here rather than in any caller's arithmetic.
	 *
	 * @param value The exact computed value.
	 * @param decimals The currency's scale.
	 * @returns The value as the column carries it.
	 */
	private static toColumn(value: Money, decimals: number): number {
		return Number(value.round(RoundingMode.HALF_UP, decimals).toStorageString());
	}
}
