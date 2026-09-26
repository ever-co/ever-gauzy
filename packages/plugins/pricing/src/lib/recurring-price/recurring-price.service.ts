import { BadRequestException, Injectable } from '@nestjs/common';
import { CurrencyCode } from '@gauzy/contracts';
import { IRecurringPriceRequest, IRecurringPriceResult } from '../pricing.types';
import { ProductPriceService } from '../product-price/product-price.service';

/**
 * The price of one period, answered from the ordinary resolution.
 *
 * A caller that bills a line again on a schedule — a renewal, a plan change, a quantity change —
 * needs one number: what one unit costs for the period it is about to bill. That number is an
 * ordinary resolved price, so it is *obtained* here rather than computed here: the request is handed
 * to `ProductPriceService.resolvePrices` unchanged, in the caller's own tenant and organization, and
 * every rule that decides a first purchase decides a renewal too — an eligible override list wins,
 * a sale list competes on its resolved amount, a customer-group list applies to the customer it is
 * scoped to, and the legacy variant price stands in when no price row is configured.
 *
 * Three things are this class's own, and nothing else is:
 *
 * 1. **One variant, one unit.** The resolution answers per variant and selects a quantity band, and
 *    a price for a period is the price of *one* unit of it — the caller multiplies by the quantity
 *    it bills, exactly as it multiplies a one-off line.
 * 2. **A missing price is a refusal, not a zero.** A variant with no price row and no legacy price
 *    resolves to nothing at all rather than to a free product, so the answer here is a named refusal
 *    that says which variant and which currency were unpriced. Returning zero would be a recurring
 *    line that costs nothing, which is indistinguishable from a free plan.
 * 3. **The amount is returned in the currency that was asked for.** A resolution may fall back to
 *    the variant's own retail price, and that price is stated in *its* currency: the resolution
 *    reports it as such rather than converting it, which is correct for a caller that reads both
 *    fields and wrong for one that would relabel the amount as the currency it asked for. So a
 *    resolution in another currency is refused here rather than returned, and the caller is told to
 *    price the variant in the currency it bills in.
 *
 * The class owns no table and no pricing rule: it is the seam through which a caller that bills on a
 * schedule reaches the one service that decides what a price is.
 */
@Injectable()
export class RecurringPriceService {
	constructor(private readonly productPriceService: ProductPriceService) {}

	/**
	 * Resolves the price of one unit for one period.
	 *
	 * @param request The variant, the customer and the currency the caller bills in.
	 * @returns The resolved unit price, its currency and the price list it came from.
	 * @throws BadRequestException when no variant or no currency was stated, when the variant has no
	 * price that applies, or when the only price that applies is stated in another currency.
	 */
	public async resolveRecurringPrice(request: IRecurringPriceRequest): Promise<IRecurringPriceResult> {
		if (!request?.variantId) {
			throw new BadRequestException('RECURRING_PRICE_VARIANT_REQUIRED: a price is resolved for one named variant.');
		}

		if (!request?.currency) {
			throw new BadRequestException(
				'RECURRING_PRICE_CURRENCY_REQUIRED: a price is resolved in one named currency, because an amount without one cannot be billed.'
			);
		}

		// The whole context the caller stated, and nothing else: no price list is named, no instant is
		// fixed and no quantity is passed, so the resolution applies its own defaults and the caller
		// cannot widen the search beyond its own tenant and organization.
		const [resolved] = await this.productPriceService.resolvePrices({
			variantIds: [request.variantId],
			currency: request.currency,
			...(request.customerId ? { customerId: request.customerId } : {})
		});

		if (!resolved) {
			throw new BadRequestException(
				`RECURRING_PRICE_NOT_FOUND: no price applies to variant ${request.variantId} in ${this.codeOf(
					request.currency
				)}, so the price of a period cannot be resolved for it.`
			);
		}

		if (!this.isSameCurrency(resolved.currency, request.currency)) {
			throw new BadRequestException(
				`RECURRING_PRICE_CURRENCY_MISMATCH: the only price that applies to variant ${request.variantId} is stated in ` +
					`${this.codeOf(resolved.currency)} while ${this.codeOf(
						request.currency
					)} was asked for, and an amount is never relabelled into another currency. ` +
					`Price the variant in ${this.codeOf(request.currency)}, or record a rate between the two.`
			);
		}

		return {
			unitPrice: resolved.amount,
			currency: resolved.currency,
			...(resolved.priceListId ? { priceListId: resolved.priceListId } : {})
		};
	}

	/**
	 * @param left One currency code.
	 * @param right Another.
	 * @returns Whether the two name the same currency. Case is not significant: a code is stored and
	 * compared upper-cased, but a caller may state it however it was typed.
	 */
	private isSameCurrency(left: CurrencyCode | undefined, right: CurrencyCode | undefined): boolean {
		return this.codeOf(left) === this.codeOf(right);
	}

	/**
	 * @param currency A currency code.
	 * @returns The code, trimmed and upper-cased, for a message or a comparison.
	 */
	private codeOf(currency: CurrencyCode | undefined): string {
		return `${currency ?? ''}`.trim().toUpperCase();
	}
}
