import { DiscountTaxTypeEnum, TaxCalculationTypeEnum } from '@gauzy/contracts';

/** An invoice line as the totals see it. */
export interface IInvoiceTotalsItem {
	totalValue: number;
	applyTax?: boolean;
	applyDiscount?: boolean;
}

export interface IInvoiceTotalsInput {
	items: IInvoiceTotalsItem[];
	/** The sum of the items' `totalValue`. */
	subtotal: number;
	tax?: number;
	taxType?: DiscountTaxTypeEnum | null;
	tax2?: number;
	tax2Type?: DiscountTaxTypeEnum | null;
	/** How the second tax relates to the first. Not given (the edit page) means SIMPLE. */
	taxCalculationType?: TaxCalculationTypeEnum | null;
	discountValue?: number;
	discountType?: DiscountTaxTypeEnum | null;
	discountAfterTax?: boolean;
}

export interface IInvoiceTotals {
	totalTax: number;
	totalDiscount: number;
	/** Subtotal less discount plus tax, never below zero. */
	total: number;
}

/** A form value as a number; empty, non-positive or non-numeric values count as 0. */
function positive(value: unknown): number {
	const number = +value;
	return number > 0 ? number : 0;
}

/**
 * The tax one value of `type` adds to an item.
 *
 * @param base What a percentage is taken of.
 */
function taxOn(base: number, value: number, type: DiscountTaxTypeEnum | null | undefined): number {
	switch (type) {
		case DiscountTaxTypeEnum.PERCENT:
			return base * (value / 100);
		case DiscountTaxTypeEnum.FLAT_VALUE:
			return value;
		default:
			// No tax of this kind on the invoice: it adds nothing (and takes nothing away).
			return 0;
	}
}

/**
 * The tax, discount and total of an invoice being added or edited.
 *
 * Each item applies its own taxes. With COMPOSED (compound) tax the second tax is taken of the item's
 * amount plus that same item's first tax — never of the tax other items have added so far, which is
 * what made a compound invoice's tax depend on how many items came before each one.
 */
export function calculateInvoiceTotals(input: IInvoiceTotalsInput): IInvoiceTotals {
	const tax = positive(input.tax);
	const tax2 = positive(input.tax2);
	const discountValue = positive(input.discountValue);
	const composed = input.taxCalculationType === TaxCalculationTypeEnum.COMPOSED;
	const subtotal = +input.subtotal || 0;

	let totalTax = 0;
	let totalDiscount = 0;

	for (const item of input.items ?? []) {
		const amount = +item.totalValue || 0;

		if (item.applyTax) {
			const itemTax = taxOn(amount, tax, input.taxType);
			const itemTax2 = taxOn(composed ? amount + itemTax : amount, tax2, input.tax2Type);
			totalTax += itemTax + itemTax2;
		}

		if (item.applyDiscount) {
			if (input.discountType === DiscountTaxTypeEnum.PERCENT) {
				if (!input.discountAfterTax) {
					totalDiscount += amount * (discountValue / 100);
				}
			} else if (input.discountType === DiscountTaxTypeEnum.FLAT_VALUE) {
				totalDiscount += discountValue;
			}
		}
	}

	if (input.discountAfterTax && input.discountType === DiscountTaxTypeEnum.PERCENT) {
		totalDiscount = (subtotal + totalTax) * (discountValue / 100);
	}

	const total = subtotal - totalDiscount + totalTax;
	return { totalTax, totalDiscount, total: total < 0 ? 0 : total };
}
