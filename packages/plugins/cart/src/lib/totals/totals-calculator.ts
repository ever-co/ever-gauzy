import { Money } from '@gauzy/core';
import { CurrencyCode, DecimalString, ICommerceCartTotals, RoundingMode } from '@gauzy/contracts';

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
	/**
	 * Adjustments owned by the document itself rather than by one of its children — the
	 * `AdjustmentOwnerType.CART` and `AdjustmentOwnerType.ORDER` rows, which the ledger describes as
	 * "an order-level discount, a fee, a rounding correction".
	 *
	 * They were read by nothing: the chain consumed the line and shipping ledgers only, so a
	 * document-level row was written, stored, and then silently absent from every total. A discount
	 * here joins the item discount total and a fee joins the item subtotal, for the same reason the
	 * line-owned ones do — there is no third column to carry them and inventing one would make a
	 * stored total mean something different from what it means today.
	 */
	documentAdjustments?: ITotalsAdjustment[];
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

		// Step 2 — line discounts and fees. An inclusive adjustment contributes its net part.
		//
		// **The ledger is signed in both directions and only one of them used to be read.** A negative
		// row reduces what the customer pays; a positive one — `FEE`, or a positive `ROUNDING`
		// correction — adds to it, and the fee leg below is what makes that second half of the ledger
		// reach a total. Without it a `FEE` row of `+4.95` was written, stored, echoed back on the
		// adjustment routes, and then silently dropped: the grand total came back identical to the
		// fee-free cart, `assertSettled` passed because the components were internally consistent, and
		// the customer was charged 4.95 less than the ledger said they owed.
		//
		// The fee joins the **subtotal** rather than a column of its own. A cart and an order store the
		// eleven totals `ICommerceCartTotals` names and no more, so a new `itemFeeTotal` column would be
		// a schema change on two tables in three dialects; netting the fee against the discount instead
		// would make `discountTotal` — a figure shown to the buyer as a saving — go negative the moment
		// the fees outweigh the discounts. What the subtotal means is therefore stated here: it is what
		// the lines are worth plus what the adjustment layer added to them, before anything is taken
		// off, which is the reading every one of `grandTotal`'s components already shares.
		const lineDiscounts = new Map<string, Money>();
		const lineFees = new Map<string, Money>();

		for (const line of context.lines) {
			const adjustments = context.lineAdjustments.filter((adjustment) => adjustment.ownerId === line.id);

			lineDiscounts.set(line.id, this.discountOf(adjustments, currency, decimals));
			lineFees.set(line.id, this.feeOf(adjustments, currency, decimals));
		}

		// A line-scoped row whose owner is no line of this document is still ignored: a `CART_LINE` row
		// always names a line, so one that names a line this document does not have is a stale row or a
		// row written against another aggregate, and letting it move this total is the defect the suite
		// pins. A row that belongs to the document *as a whole* is a different owner type and arrives in
		// its own member, below.
		const documentAdjustments = context.documentAdjustments ?? [];

		const itemSubtotal = this.sum(
			[...lineNet.values(), ...lineFees.values(), this.feeOf(documentAdjustments, currency, decimals)],
			currency,
			decimals
		);
		const itemDiscountTotal = this.sum(
			[...lineDiscounts.values(), this.discountOf(documentAdjustments, currency, decimals)],
			currency,
			decimals
		);
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
			const adjustments = context.shippingAdjustments.filter(
				(adjustment) => adjustment.ownerId === method.id
			);

			shippingSubtotal = shippingSubtotal
				.add(method.isTaxInclusive ? this.round(amount, decimals).subtract(tax) : this.round(amount, decimals))
				.add(this.feeOf(adjustments, currency, decimals));
			shippingDiscountTotal = shippingDiscountTotal.add(this.discountOf(adjustments, currency, decimals));
		}

		// A shipping-scoped adjustment whose owner is the cart itself rather than one method still moves
		// what is payable, so its discount half is added to the shipping discount total and its fee half
		// to the shipping subtotal — a delivery surcharge that names no method is still charged.
		const unattributedShipping = context.shippingAdjustments.filter(
			(adjustment) => !context.shippingMethods.some((method) => method.id === adjustment.ownerId)
		);

		shippingSubtotal = shippingSubtotal.add(this.feeOf(unattributedShipping, currency, decimals));
		shippingDiscountTotal = shippingDiscountTotal.add(this.discountOf(unattributedShipping, currency, decimals));

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

			// The magnitude of the net, not the net as it was written. A ledger row's `amount` is signed
			// and its recorded `netAmount` may be written either way round by whichever service produced
			// it; taking it as it stands would let a net recorded as `-4.00` *reduce* the discount it is
			// the net of, which reads as a promotion that made the cart dearer.
			const net = Math.abs(adjustment.netAmount ?? adjustment.amount);
			discount = discount.add(Money.of(net, currency, decimals));
		}

		return discount;
	}

	/**
	 * The fee a set of ledger rows represents, as a positive magnitude.
	 *
	 * The mirror of {@link discountOf}, and it exists because the adjustment ledger is signed in both
	 * directions: `AdjustmentType.FEE` is documented as "a positive charge added at the adjustment
	 * layer: handling, small-order, cash on delivery", and a `ROUNDING` correction is explicitly
	 * allowed to go either way, so the positive half of the ledger has to reach a total exactly as the
	 * negative half does. Reading only the negative half is what let a handling fee be written and then
	 * charged to nobody.
	 *
	 * The net part is used when the row carries one, for the same reason a discount uses it: a fee
	 * stated in a tax-inclusive basis adds its net to the taxable base and its gross to what the
	 * customer sees, and conflating the two is the classic one-cent mismatch.
	 *
	 * @param adjustments The ledger rows of one owner.
	 * @param currency The currency.
	 * @param decimals The currency's scale.
	 * @returns The fee, never negative.
	 */
	private static feeOf(
		adjustments: readonly ITotalsAdjustment[],
		currency: CurrencyCode,
		decimals: number
	): Money {
		let fee = Money.zero(currency, decimals);

		for (const adjustment of adjustments) {
			if (adjustment.amount <= 0) {
				continue;
			}

			fee = fee.add(Money.of(Math.abs(adjustment.netAmount ?? adjustment.amount), currency, decimals));
		}

		return fee;
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
	 * **The conversion is checked rather than assumed.** `numeric(20,6)` holds fourteen integer digits
	 * and a double holds fifteen significant ones, so the two ranges overlap but do not contain one
	 * another: `Number('12345678901234.567890')` is `12345678901234.568`, a value inside the column's
	 * declared range that the double cannot hold. Left unchecked, that difference is written as the
	 * stored total while the exact figure is discarded, and `assertSettled` cannot see it because the
	 * components and the grand total each lose different digits. A total that cannot survive the
	 * column's own storage form is therefore refused here, loudly, in the same voice as the rest of
	 * this class: a mismatch is not repaired, because repairing it would hide the writer that produced
	 * it. Every amount a commerce document realistically carries round-trips exactly.
	 *
	 * @param value The exact computed value.
	 * @param decimals The currency's scale.
	 * @returns The value as the column carries it.
	 * @throws Error when the storage form does not survive the conversion to a `number`.
	 */
	private static toColumn(value: Money, decimals: number): number {
		const rounded = value.round(RoundingMode.HALF_UP, decimals);
		const exact = rounded.toStorageString();
		const column = Number(exact);

		if (!this.roundTrips(exact, column, rounded.currency, decimals)) {
			throw new Error(
				`TOTALS_PRECISION_LOST: ${exact} ${value.currency} cannot be carried by the column's numeric ` +
					`form without losing a digit (it reads back as ${column}). The amount is past the range a ` +
					'double holds exactly and must not be stored as an approximation.'
			);
		}

		return column;
	}

	/**
	 * @param exact The exact storage form of a computed amount.
	 * @param column The number the column carries it as.
	 * @param currency The currency, so the comparison is made by the money layer itself.
	 * @param decimals The currency's scale.
	 * @returns True when the two describe the same amount.
	 */
	private static roundTrips(exact: DecimalString, column: number, currency: CurrencyCode, decimals: number): boolean {
		if (!Number.isFinite(column)) {
			return false;
		}

		try {
			// Read back through the same value object the amount was produced by, so the comparison is
			// the money layer's rather than a second reading of what a decimal is. A double past the
			// safe-integer range renders exponentially, which is not a decimal at all; `Money.of` refuses
			// it, and a conversion that cannot even be read back has certainly not preserved the amount.
			return Money.of(column, currency, decimals).toStorageString() === exact;
		} catch {
			return false;
		}
	}
}
