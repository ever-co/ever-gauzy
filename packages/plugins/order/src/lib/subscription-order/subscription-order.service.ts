import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { FindOptionsWhere, Repository } from 'typeorm';
import {
	AdjustmentOwnerType,
	AdjustmentType,
	CommerceCartStatus,
	CurrencyCode,
	DecimalString,
	ID,
	IdempotencyOutcome,
	RoundingMode,
	TaxLineOwnerType
} from '@gauzy/contracts';
import {
	AdjustmentService,
	ChannelService,
	IdempotencyService,
	Money,
	Product,
	ProductVariant,
	RequestContext,
	TaxLineService,
	compareDecimalStrings,
	isValidDecimalString,
	normalizeDecimalString
} from '@gauzy/core';
import { CommerceCartService } from '@gauzy/plugin-cart';
import { PricePreferenceService } from '@gauzy/plugin-pricing';
import { TaxRateService } from '@gauzy/plugin-tax';
import type {
	ISubscriptionOrderGatewayPort,
	ISubscriptionOrderRequest,
	ISubscriptionOrderResult,
	ISubscriptionProrationOrderRequest
} from '@gauzy/plugin-subscription';
import { Order } from '../order/order.entity';
import { OrderService } from '../order/order.service';
import { TypeOrmOrderRepository } from '../order/repository/type-orm-order.repository';
import { OrderCreditLineService } from '../order-credit-line/order-credit-line.service';
import { OrderLine } from '../order-line/order-line.entity';
import { OrderLineService } from '../order-line/order-line.service';
import { OrderTotalsService } from '../order-totals/order-totals.service';

/**
 * The scope a cycle's order is claimed under.
 *
 * The key the subscription domain derives is stable per cycle *and per attempt*, so the claim is what
 * makes a retried attempt return the order the first attempt raised instead of raising a second one.
 */
const ORDER_SCOPE = 'order.subscription';

/**
 * How an order raised from a recurrence records where it came from.
 *
 * `SUBSCRIPTION` is the value the schema chapter names for this case, and it is a value of the
 * order's own `source` column rather than a note: an operator filtering orders by origin is asking a
 * question the column answers.
 */
const SUBSCRIPTION_SOURCE = 'SUBSCRIPTION';

/** The title the fee line carries. A fee is not a catalogue item, so no catalogue item may name it. */
const SETUP_FEE_TITLE = 'Setup fee';

/**
 * The label a proration line falls back to when the caller states no description.
 *
 * The column is not nullable, and a proration the caller could not describe is still a line a person
 * has to be able to read, so the fallback names the fact rather than inventing a product.
 */
const PRORATION_TITLE = 'Subscription change';

/**
 * The order a subscription cycle bills, raised through the ordinary order path.
 *
 * **Why this class exists at all.** The subscription domain owns a calendar and an amount, not an
 * order: it states the recurring lines, the payer and the period, and receives an order back. This is
 * the package that owns orders answering that request, so the order package is where the answer has to
 * live — the consumer declares the port, and the installation binds it (`SUBSCRIPTION_ORDER_GATEWAY`
 * in `apps/api/src/plugin-composition.ts`). Neither package imports the other at runtime: the port's
 * types are imported as types only, which is erased.
 *
 * **It raises the order the way every other order is raised.** The documented billing path of a cycle
 * is `build cart → checkout` (`11-customers-b2b-and-subscriptions-spec.md` §10.5), so the cart is built
 * through the cart package and handed to `OrderService.createFromCart` — the one method the cart's own
 * checkout handler calls. Numbering is the kernel's sequence service, the lines are the order line
 * service's, placement and confirmation are the order state machine's and the totals are
 * `OrderTotalsService`'s. Nothing here writes an order row, allocates a number or computes a total of
 * its own; a second implementation of any of those is the defect this class would otherwise be.
 *
 * **What the cycle states and what this has to resolve.** A cycle states variant identifiers, exact
 * quantities and exact unit prices. An order line also needs a channel, a title and a tax path, and
 * none of the three is in the request:
 *
 * 1. **The channel** is the one the subscription was sold in — the originating order's — and, for a
 *    subscription that names no originating order, the organization's default channel. A renewal has
 *    no request behind it to state one, and a subscription that could never bill is worse than one
 *    billed through the organization's own default.
 * 2. **The title** is the catalogue's: the product's name in the request's language, with the
 *    variant's own internal reference beside it when it carries one. Nothing in the catalogue names a
 *    variant, so a line that named only the product would be a wrong label on the right row; a line
 *    neither of them can label is refused rather than stored under a title nobody wrote.
 * 3. **The tax path** is the platform's. The line carries the variant's tax category, the price's
 *    inclusivity is resolved through the pricing capability's own preference chain, the amounts are
 *    rated by the tax capability (which returns ledger-shaped drafts and persists nothing) and the
 *    drafts are written through the kernel's tax ledger. The order's totals then read that ledger, so
 *    a renewal is taxed exactly as a first purchase is.
 *
 * **The payer travels with the order.** The request names the account and the instrument the renewal
 * is charged against. This class does not charge — taking money is the payment capability's step, not
 * the order path's — but the order records the payer in its metadata, because the order is the
 * document an off-session attempt is raised against and the refusal a revoked instrument produces
 * names the payer the subscription remembered.
 *
 * **Nothing is reported as paid that was not.** `paid` is read from the order's own ledger: money was
 * captured and nothing is outstanding. A cycle whose order was merely raised is reported unsettled, so
 * the subscription records it as invoiced rather than as paid.
 */
@Injectable()
export class SubscriptionOrderService implements ISubscriptionOrderGatewayPort {
	constructor(
		private readonly orderService: OrderService,
		private readonly totalsService: OrderTotalsService,
		private readonly lineService: OrderLineService,
		private readonly creditLineService: OrderCreditLineService,
		private readonly cartService: CommerceCartService,
		private readonly channelService: ChannelService,
		private readonly idempotencyService: IdempotencyService,
		private readonly adjustmentService: AdjustmentService,
		private readonly taxLineService: TaxLineService,
		private readonly taxRateService: TaxRateService,
		private readonly pricePreferenceService: PricePreferenceService,
		private readonly typeOrmOrderRepository: TypeOrmOrderRepository,
		@InjectRepository(ProductVariant)
		private readonly typeOrmProductVariantRepository: Repository<ProductVariant>,
		@InjectRepository(Product)
		private readonly typeOrmProductRepository: Repository<Product>
	) {}

	/**
	 * Raises the order one billing period represents.
	 *
	 * @param request The cycle's lines, amount, payer and period.
	 * @returns The order the cycle produced and whether its money side was already settled.
	 * @throws BadRequestException when the request cannot produce an order — a line the catalogue
	 * cannot describe, a cycle that names no channel this organization has, an amount the lines do not
	 * produce, or a key already used for a different request.
	 */
	public async raiseSubscriptionOrder(request: ISubscriptionOrderRequest): Promise<ISubscriptionOrderResult> {
		const currency = this.currencyOf(request?.currency);
		const lines = this.recurringLines(request, currency);
		const discount = this.moneyOf(request?.discountAmount, currency, 'discountAmount');
		const setupFee = this.moneyOf(request?.setupFee, currency, 'setupFee');
		const credit = this.moneyOf(request?.creditAmount, currency, 'creditAmount');
		const amount = this.moneyOf(request?.amount, currency, 'amount');

		this.assertIdempotencyKey(request);
		this.assertLinesProduceTheAmount(lines, discount, amount, currency);

		const claim = await this.idempotencyService.claim({
			scope: ORDER_SCOPE,
			key: request.idempotencyKey,
			requestHash: this.hash({
				subscriptionId: request.subscriptionId,
				billingId: request.billingId,
				amount: amount.toStorageString(),
				periodStart: request.periodStart?.toISOString?.() ?? String(request.periodStart ?? ''),
				lines: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity, unitPrice: line.unitPrice }))
			}),
			resourceType: 'order'
		});

		const replayed = await this.replayedResult(claim);

		if (replayed) {
			return replayed;
		}

		const destination = await this.resolveDestination(request.originOrderId);
		const inclusive = await this.isTaxInclusive(currency, destination.channelCode, destination.regionId);
		const described = await this.describeLines(lines, inclusive);

		const cart = await this.buildCart({
			destination,
			customerId: request.customerId,
			currency,
			lines: described,
			setupFee,
			source: SUBSCRIPTION_SOURCE,
			metadata: {
				subscriptionId: request.subscriptionId,
				billingId: request.billingId,
				originOrderId: request.originOrderId ?? null,
				periodStart: request.periodStart,
				periodEnd: request.periodEnd,
				firstCycle: request.firstCycle === true,
				// The cycle's own words about this attempt. An order carries no note column of its own,
				// so the note is recorded where every other open-ended fact about an order is.
				...(request.note ? { note: request.note } : {}),
				...(request.paymentAccountHolderId ? { paymentAccountHolderId: request.paymentAccountHolderId } : {}),
				...(request.paymentMethodTokenId ? { paymentMethodTokenId: request.paymentMethodTokenId } : {})
			}
		});

		const order = await this.orderService.createFromCart(cart, {
			idempotencyKey: request.idempotencyKey,
			source: SUBSCRIPTION_SOURCE,
			// The recurrence's lineage: the order that started the subscription, when the cycle names one.
			parentOrderId: request.originOrderId
		});

		const discounted = await this.attachDiscount(order, discount, request.subscriptionId);
		const credited = await this.attachCredit(order, credit, request.subscriptionId);
		const rated = await this.writeTax(order, currency, destination.regionId, discounted);
		// One recomputation for everything this cycle wrote to a ledger. The create path has already
		// totalled the order, and the totals chain is the only writer of the total columns, so the
		// discount, the credit and the tax reach them through it or not at all.
		const raised =
			discounted.size > 0 || credited || rated > 0
				? await this.totalsService.recompute(order.id, 'SUBSCRIPTION_CYCLE')
				: order;
		const result = await this.resultOf(raised);

		await this.idempotencyService.complete(claim.record, {
			responseStatus: 201,
			responseBody: result as unknown as Record<string, unknown>,
			resourceType: 'order',
			resourceId: order.id
		});

		return result;
	}

	/**
	 * Raises the order a mid-cycle change's difference is charged as.
	 *
	 * A proration is an order like any other, and it takes the same path: a cart with one line, and the
	 * order package's own create path. The line carries the caller's own words as its title, because a
	 * proration has no catalogue item behind it — it is the difference between two prices for the
	 * remainder of a period, and the description the caller stated is what a person reads on the
	 * invoice. It carries no tax category, so it is not rated: an amount that no catalogue item states
	 * has no category the tax capability could resolve, and inventing one would tax it under whichever
	 * category happened to be the organization's default.
	 *
	 * @param request What is owed, for which subscription and against which payer.
	 * @returns The order the proration produced and whether its money side was already settled.
	 * @throws BadRequestException when the amount is not positive, the key was used for a different
	 * request, or no channel this organization has can be resolved.
	 */
	public async raiseProrationOrder(request: ISubscriptionProrationOrderRequest): Promise<ISubscriptionOrderResult> {
		const currency = this.currencyOf(request?.currency);
		const amount = this.moneyOf(request?.amount, currency, 'amount');

		if (!amount.isPositive()) {
			throw new BadRequestException(
				'ORDER_SUBSCRIPTION_PRORATION_AMOUNT_INVALID: a proration order states what is owed, as a positive amount; a credit is an adjustment on the cycle it reduces.'
			);
		}

		this.assertIdempotencyKey(request);

		const claim = await this.idempotencyService.claim({
			scope: ORDER_SCOPE,
			key: request.idempotencyKey,
			requestHash: this.hash({
				subscriptionId: request.subscriptionId,
				amount: amount.toStorageString(),
				description: request.description ?? ''
			}),
			resourceType: 'order'
		});

		const replayed = await this.replayedResult(claim);

		if (replayed) {
			return replayed;
		}

		const destination = await this.resolveDestination(undefined);
		const description = `${request.description ?? ''}`.trim().slice(0, 255) || PRORATION_TITLE;

		const cart = await this.buildCart({
			destination,
			customerId: request.customerId,
			currency,
			lines: [],
			setupFee: Money.zero(currency),
			source: SUBSCRIPTION_SOURCE,
			metadata: {
				subscriptionId: request.subscriptionId,
				proration: true,
				description,
				...(request.paymentAccountHolderId ? { paymentAccountHolderId: request.paymentAccountHolderId } : {}),
				...(request.paymentMethodTokenId ? { paymentMethodTokenId: request.paymentMethodTokenId } : {})
			},
			changeLine: { title: description, amount }
		});

		const order = await this.orderService.createFromCart(cart, {
			idempotencyKey: request.idempotencyKey,
			source: SUBSCRIPTION_SOURCE
		});
		const result = await this.resultOf(order);

		await this.idempotencyService.complete(claim.record, {
			responseStatus: 201,
			responseBody: result as unknown as Record<string, unknown>,
			resourceType: 'order',
			resourceId: order.id
		});

		return result;
	}

	/*
	|--------------------------------------------------------------------------
	| The request
	|--------------------------------------------------------------------------
	*/

	/**
	 * @param value The currency the cycle states.
	 * @returns It, canonicalised.
	 * @throws BadRequestException when it is not a three-letter code, because an amount without one
	 * cannot be priced, taxed or stored.
	 */
	private currencyOf(value?: CurrencyCode): CurrencyCode {
		const currency = typeof value === 'string' ? value.trim().toUpperCase() : '';

		if (currency.length !== 3) {
			throw new BadRequestException(
				'ORDER_SUBSCRIPTION_CURRENCY_REQUIRED: a cycle is billed in one named currency, and an amount without one cannot be raised as an order.'
			);
		}

		return currency as CurrencyCode;
	}

	/**
	 * @param request The cycle's recurring lines.
	 * @param currency The currency they are priced in.
	 * @returns The lines, with their quantities and unit prices as exact decimals.
	 * @throws BadRequestException when the cycle states no line, or a line that cannot be priced.
	 */
	private recurringLines(
		request: ISubscriptionOrderRequest,
		currency: CurrencyCode
	): Array<{ variantId: ID; quantity: DecimalString; unitPrice: DecimalString }> {
		const lines = request?.lines ?? [];

		if (!lines.length) {
			throw new BadRequestException(
				'ORDER_SUBSCRIPTION_LINES_REQUIRED: a cycle raises an order for at least one recurring line.'
			);
		}

		return lines.map((line) => {
			if (!line?.variantId) {
				throw new BadRequestException(
					'ORDER_SUBSCRIPTION_LINE_VARIANT_REQUIRED: a recurring line names the variant it delivers.'
				);
			}

			const quantity = this.decimalOf(line.quantity, 'quantity');

			if (compareDecimalStrings(quantity, '0') <= 0) {
				throw new BadRequestException(
					`ORDER_SUBSCRIPTION_LINE_QUANTITY_INVALID: the quantity of variant ${line.variantId} must be positive, and ${quantity} is not.`
				);
			}

			const unitPrice = this.decimalOf(line.unitPrice, 'unitPrice');

			if (compareDecimalStrings(unitPrice, '0') < 0) {
				throw new BadRequestException(
					`ORDER_SUBSCRIPTION_LINE_PRICE_INVALID: the unit price of variant ${line.variantId} cannot be negative, and ${unitPrice} is.`
				);
			}

			return { variantId: line.variantId, quantity, unitPrice };
		});
	}

	/**
	 * @param value A value the cycle stated.
	 * @param currency The currency it is expressed in.
	 * @param what What it represents, used in the refusal.
	 * @returns It as money, zero when the cycle stated nothing.
	 * @throws BadRequestException when it is not an exact decimal.
	 */
	private moneyOf(value: DecimalString | undefined, currency: CurrencyCode, what: string): Money {
		if (value === undefined || value === null || `${value}`.trim() === '') {
			return Money.zero(currency);
		}

		return Money.of(this.decimalOf(value, what), currency);
	}

	/**
	 * @param value A value the cycle stated.
	 * @param what What it represents, used in the refusal.
	 * @returns It as an exact decimal.
	 * @throws BadRequestException when it is not one, because a `number` is where precision is lost and
	 * coercion is therefore refused rather than performed.
	 */
	private decimalOf(value: DecimalString | number | null | undefined, what: string): DecimalString {
		const text = typeof value === 'number' ? `${value}` : `${value ?? ''}`.trim();

		if (!isValidDecimalString(text)) {
			throw new BadRequestException(
				`ORDER_SUBSCRIPTION_AMOUNT_INVALID: ${what} must be an exact decimal string, and "${text}" is not one.`
			);
		}

		return normalizeDecimalString(text);
	}

	/**
	 * @param request The cycle's request.
	 * @throws BadRequestException when it carries no key, because the key is what stops a retried
	 * attempt from placing a second order for one cycle.
	 */
	private assertIdempotencyKey(request: { idempotencyKey?: string }): void {
		if (!request?.idempotencyKey || `${request.idempotencyKey}`.trim() === '') {
			throw new BadRequestException(
				'ORDER_SUBSCRIPTION_KEY_REQUIRED: a cycle names the key its order is raised under, so a retry of the same attempt cannot place a second order.'
			);
		}
	}

	/**
	 * Refuses a cycle whose own amount is not what its lines produce.
	 *
	 * The lines are the order's subtotal and the discount is the ledger row that reduces it, so the
	 * two have to add up to what the cycle says it is billing — the totals chain rounds each line at
	 * the currency's scale before it sums them, and this compares in exactly those terms. A cycle that
	 * fails this would otherwise raise an order for one amount and record a billing row for another.
	 *
	 * @param lines The recurring lines.
	 * @param discount The plan discount granted on this cycle.
	 * @param amount The amount the cycle states.
	 * @param currency The currency all three are expressed in.
	 * @throws BadRequestException when they disagree.
	 */
	private assertLinesProduceTheAmount(
		lines: Array<{ variantId: ID; quantity: DecimalString; unitPrice: DecimalString }>,
		discount: Money,
		amount: Money,
		currency: CurrencyCode
	): void {
		const subtotal = Money.sum(this.grossesOf(lines, currency), currency);
		const produced = subtotal.subtract(discount).round(RoundingMode.HALF_UP);

		if (!produced.equals(amount)) {
			throw new BadRequestException(
				`ORDER_SUBSCRIPTION_AMOUNT_MISMATCH: the cycle states ${amount.toStorageString()} ${currency}, and its lines ` +
					`(${subtotal.toStorageString()}) less the ${discount.toStorageString()} discount produce ${produced.toStorageString()}.`
			);
		}
	}

	/**
	 * @param lines The recurring lines.
	 * @param currency The currency they are expressed in.
	 * @returns Each line's gross, rounded at the currency's scale, which is the boundary the totals
	 * chain rounds a line's subtotal at.
	 */
	private grossesOf(
		lines: Array<{ quantity: DecimalString; unitPrice: DecimalString }>,
		currency: CurrencyCode
	): Money[] {
		const decimals = this.decimalsOf(currency);

		return lines.map((line) =>
			Money.of(line.unitPrice, currency, decimals)
				.multiply(line.quantity)
				.round(RoundingMode.HALF_UP, decimals)
		);
	}

	/**
	 * @param currency The currency.
	 * @returns Its decimal places, taken from the money layer rather than stated here.
	 */
	private decimalsOf(currency: CurrencyCode): number {
		return Money.zero(currency).decimals;
	}

	/**
	 * @param claim What the idempotency store answered.
	 * @returns The result this key already produced, or null when this caller owns the work.
	 * @throws BadRequestException when the key belongs to a different request, or when another attempt
	 * at the same cycle is still running.
	 */
	private async replayedResult(claim: {
		outcome: IdempotencyOutcome;
		record?: { resourceId?: ID };
		response?: { body?: unknown };
	}): Promise<ISubscriptionOrderResult | null> {
		if (claim.outcome === IdempotencyOutcome.REPLAYED) {
			// The order this attempt would raise already exists. It is re-read and answered from its own
			// ledger rather than from the answer the first attempt stored, because the money may have
			// moved since: a cycle whose order has been paid in the meantime is settled now, and replaying
			// the first answer would report it as unpaid. The stored body is the fallback for a key whose
			// order cannot be read.
			const order = claim.record?.resourceId ? await this.findOrder(claim.record.resourceId) : null;

			return order
				? await this.resultOf(order)
				: ((claim.response?.body ?? null) as ISubscriptionOrderResult | null);
		}

		if (claim.outcome === IdempotencyOutcome.REUSED_KEY) {
			throw new BadRequestException(
				'ORDER_SUBSCRIPTION_KEY_REUSED: this key already raised an order for a different request, so it cannot raise another one.'
			);
		}

		if (claim.outcome === IdempotencyOutcome.IN_FLIGHT) {
			throw new BadRequestException(
				'ORDER_SUBSCRIPTION_IN_FLIGHT: another attempt at this cycle holds its key and is still working.'
			);
		}

		return null;
	}

	/*
	|--------------------------------------------------------------------------
	| What the order needs and the cycle does not state
	|--------------------------------------------------------------------------
	*/

	/**
	 * Resolves the channel, the region and the contact facts the order is raised with.
	 *
	 * The originating order is the subscription's own statement of where it was sold, so its channel,
	 * region and contact snapshots are reused verbatim: a renewal is the same purchase again. A
	 * subscription that names no originating order — one created outside a storefront — is raised in
	 * the organization's default channel, because a renewal has no request behind it to state one and
	 * the alternative is a subscription that can never bill. An organization with neither is refused
	 * with the code the order package already uses for exactly this.
	 *
	 * @param originOrderId The order that started the subscription, when the cycle names one.
	 * @returns The channel and the facts the cart and the order are built with.
	 * @throws BadRequestException when no channel can be resolved.
	 */
	private async resolveDestination(originOrderId?: ID): Promise<{
		channelId: ID;
		channelCode?: string;
		regionId?: ID;
		email?: string;
		locale?: string;
	}> {
		const origin = originOrderId ? await this.findOrder(originOrderId) : null;
		const channel = origin
			? await this.channelService.findChannel(origin.channelId)
			: await this.channelService.findDefaultChannel();

		if (!channel && !origin) {
			throw new BadRequestException(
				'ORDER_CHANNEL_REQUIRED: the cycle names no originating order and this organization has no default channel, so there is no sales channel to raise the renewal in.'
			);
		}

		return {
			channelId: (origin?.channelId ?? channel?.id) as ID,
			channelCode: channel?.code,
			regionId: origin?.regionId ?? channel?.defaultRegionId,
			email: origin?.email,
			locale: origin?.locale ?? channel?.defaultLocale
		};
	}

	/**
	 * Reads one order of the caller's organization.
	 *
	 * The answering form rather than the raising one, because a miss is an ordinary answer here: an
	 * origin the subscription names may not be this organization's, and a key may have raised an order
	 * that is no longer readable.
	 *
	 * @param id The order to read.
	 * @returns The order, or null when it is not this organization's.
	 */
	private async findOrder(id: ID): Promise<Order | null> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		return await this.typeOrmOrderRepository.findOne({
			where: {
				id,
				...(tenantId ? { tenantId } : {}),
				...(organizationId ? { organizationId } : {})
			} as FindOptionsWhere<Order>
		});
	}

	/**
	 * Whether the prices this cycle carries already contain tax.
	 *
	 * The cycle states an amount and a unit price, not a basis. Whether a price is inclusive is a
	 * pricing decision — a price row's own flag, its price list's, and then the organization's
	 * preference for the currency, the region or the channel — and the pricing capability owns that
	 * chain. A scope with no preference answers null, and a price is exclusive unless something says
	 * otherwise, which is the same default the cart applies.
	 *
	 * @param currency The currency the cycle is priced in.
	 * @param channelCode The channel the order is raised in, when it is known.
	 * @param regionId The region the order is raised in, when it is known.
	 * @returns True when the line's price is a gross.
	 */
	private async isTaxInclusive(currency: CurrencyCode, channelCode?: string, regionId?: ID): Promise<boolean> {
		const answer = await this.pricePreferenceService.resolveTaxInclusivity({
			currency,
			...(regionId ? { regionId } : {}),
			...(channelCode ? { channelCode } : {})
		});

		return answer === true;
	}

	/**
	 * Describes each recurring line as the catalogue describes it.
	 *
	 * The variant is read for the facts only the catalogue records — which tax category it is sold in,
	 * whether it ships, its operator's own reference — and the product's translated name is resolved
	 * through the platform's own translation rule, so a line title is the same words the storefront
	 * shows in the same language.
	 *
	 * @param lines The recurring lines.
	 * @param inclusive Whether the prices are gross.
	 * @returns One describable line per recurring line, in the order the cycle stated them.
	 * @throws BadRequestException when a variant is not this organization's, or when neither the
	 * product nor the variant can label the line.
	 */
	private async describeLines(
		lines: Array<{ variantId: ID; quantity: DecimalString; unitPrice: DecimalString }>,
		inclusive: boolean
	): Promise<
		Array<{
			productId?: ID;
			variantId: ID;
			title: string;
			weight?: number;
			requiresShipping: boolean;
			taxCategoryId?: ID;
			quantity: DecimalString;
			unitPrice: DecimalString;
			isTaxInclusive: boolean;
			position: number;
		}>
	> {
		const described = [];

		for (const [position, line] of lines.entries()) {
			const variant = await this.variantOf(line.variantId);

			if (!variant) {
				throw new BadRequestException(
					`ORDER_SUBSCRIPTION_VARIANT_NOT_FOUND: no variant ${line.variantId} exists in this organization, so the line the cycle bills cannot be described.`
				);
			}

			const product = variant.productId ? await this.productOf(variant.productId) : null;

			described.push({
				productId: variant.productId,
				variantId: variant.id,
				title: this.titleOf(product, variant),
				weight: variant.weight,
				requiresShipping: variant.requiresShipping !== false,
				taxCategoryId: variant.taxCategoryId,
				quantity: line.quantity,
				unitPrice: line.unitPrice,
				isTaxInclusive: inclusive,
				position
			});
		}

		return described;
	}

	/**
	 * @param id The variant.
	 * @returns The variant, scoped to the caller's organization, or null.
	 */
	private async variantOf(id: ID): Promise<ProductVariant | null> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		return await this.typeOrmProductVariantRepository.findOne({
			where: {
				id,
				...(tenantId ? { tenantId } : {}),
				...(organizationId ? { organizationId } : {})
			} as FindOptionsWhere<ProductVariant>
		});
	}

	/**
	 * @param id The product a variant belongs to.
	 * @returns The product, with the translations its name is resolved from, or null.
	 */
	private async productOf(id: ID): Promise<Product | null> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		return await this.typeOrmProductRepository.findOne({
			where: {
				id,
				...(tenantId ? { tenantId } : {}),
				...(organizationId ? { organizationId } : {})
			} as FindOptionsWhere<Product>,
			relations: { translations: true }
		});
	}

	/**
	 * @param product The product the variant belongs to, when it was found.
	 * @param variant The variant.
	 * @returns The words the line carries: the product's name in the request's language, and the
	 * variant's own reference beside it when it has one.
	 * @throws BadRequestException when neither names the line, or when the two together do not fit the
	 * column — a silently truncated title is a title nobody can search for.
	 */
	private titleOf(product: Product | null, variant: ProductVariant): string {
		// The product's name is a row of `product_translation`, and the platform's own `translate` is
		// what merges the row for the language the request asked for.
		const translated = product
			? (product.translate(RequestContext.getLanguageCode()) as { name?: string })
			: null;
		const named = `${translated?.name ?? ''}`.trim();
		const label = `${variant.internalReference ?? ''}`.trim();
		const title = [named, label].filter(Boolean).join(' — ');

		if (!title) {
			throw new BadRequestException(
				`ORDER_SUBSCRIPTION_LINE_TITLE_UNRESOLVED: variant ${variant.id} has no product name and no internal reference, so the line it bills cannot be titled.`
			);
		}

		if (title.length > 255) {
			throw new BadRequestException(
				`ORDER_SUBSCRIPTION_LINE_TITLE_TOO_LONG: the title of variant ${variant.id} is ${title.length} characters, and an order line states at most 255.`
			);
		}

		return title;
	}

	/*
	|--------------------------------------------------------------------------
	| The cart and the order
	|--------------------------------------------------------------------------
	*/

	/**
	 * Builds the cart the order is raised from.
	 *
	 * The cart is the documented first step of a billing cycle, and it is not an artefact: it is what
	 * the order records as its origin (`order.cartId`), and adding a line through it is what asks the
	 * inventory capability whether the renewal can be served at all. The cart is left `COMPLETED` and
	 * pointing at the order it became, which is the state a cart that became an order is in — a cart
	 * left `ACTIVE` would be reaped as abandoned while its order was perfectly alive.
	 *
	 * @param input The destination, the contact, the lines and what the order records.
	 * @returns The cart, with its lines, ready to be handed to the order path.
	 */
	private async buildCart(input: {
		destination: { channelId: ID; regionId?: ID; email?: string; locale?: string };
		customerId: ID;
		currency: CurrencyCode;
		lines: Array<{
			productId?: ID;
			variantId?: ID;
			title: string;
			weight?: number;
			requiresShipping: boolean;
			taxCategoryId?: ID;
			quantity: DecimalString;
			unitPrice: DecimalString;
			isTaxInclusive: boolean;
			position: number;
		}>;
		setupFee: Money;
		changeLine?: { title: string; amount: Money };
		source: string;
		metadata: Record<string, unknown>;
	}) {
		const decimals = this.decimalsOf(input.currency);

		const cart = await this.cartService.create({
			channelId: input.destination.channelId,
			regionId: input.destination.regionId,
			customerId: input.customerId,
			email: input.destination.email,
			locale: input.destination.locale,
			currency: input.currency,
			currencyDecimals: decimals,
			status: CommerceCartStatus.ACTIVE,
			metadata: { ...input.metadata, source: input.source }
		});

		for (const line of input.lines) {
			await this.cartService.addLine(cart.id, {
				productId: line.productId,
				variantId: line.variantId,
				title: line.title,
				quantity: this.numberOf(line.quantity, input.currency),
				unitPrice: this.numberOf(line.unitPrice, input.currency),
				originalUnitPrice: this.numberOf(line.unitPrice, input.currency),
				isTaxInclusive: line.isTaxInclusive,
				taxCategoryId: line.taxCategoryId,
				isDiscountable: true,
				requiresShipping: line.requiresShipping,
				weight: line.weight,
				position: line.position
			});
		}

		if (input.changeLine) {
			// A proration is one line of the difference the change produced, in the caller's own words.
			await this.cartService.addLine(cart.id, {
				title: input.changeLine.title,
				quantity: 1,
				unitPrice: this.numberOf(input.changeLine.amount.toStorageString(), input.currency),
				originalUnitPrice: this.numberOf(input.changeLine.amount.toStorageString(), input.currency),
				isTaxInclusive: false,
				isDiscountable: false,
				requiresShipping: false,
				position: 0
			});
		} else if (input.setupFee.isPositive()) {
			// The setup fee is an amount the plan charges once, with no catalogue item behind it: it is
			// a line of its own so the invoice shows what it is, and it is not discountable because the
			// plan's discount applies to the recurring amount, not to the fee that precedes it.
			await this.cartService.addLine(cart.id, {
				title: SETUP_FEE_TITLE,
				quantity: 1,
				unitPrice: this.numberOf(input.setupFee.toStorageString(), input.currency),
				originalUnitPrice: this.numberOf(input.setupFee.toStorageString(), input.currency),
				isTaxInclusive: false,
				isDiscountable: false,
				requiresShipping: false,
				position: input.lines.length
			});
		}

		return await this.cartService.findOneWithContent(cart.id);
	}

	/**
	 * @param value An exact decimal.
	 * @param currency The currency it is expressed in, used for the refusal.
	 * @returns It as the `numeric(20,6)` column carries it.
	 * @throws BadRequestException when the value carries more precision than the column stores, because
	 * a value that silently loses digits is a value that disagrees with the ledger it came from.
	 */
	private numberOf(value: DecimalString, currency: CurrencyCode): number {
		const exact = normalizeDecimalString(value);
		const text = String(Number(exact));

		if (!isValidDecimalString(text) || normalizeDecimalString(text) !== exact) {
			throw new BadRequestException(
				`ORDER_SUBSCRIPTION_PRECISION_LOST: ${exact} cannot be stored exactly in a ${currency} amount column, so the line would not carry what the cycle bills.`
			);
		}

		return Number(exact);
	}

	/*
	|--------------------------------------------------------------------------
	| What the cycle states beside the lines
	|--------------------------------------------------------------------------
	*/

	/**
	 * Records the plan's discount on the order, allocated across its lines.
	 *
	 * The discount is a price-level reduction, so it is a `PROMOTION` ledger row rather than a smaller
	 * unit price (doc 11 §10.10) — and it is allocated across the lines by the money layer's own
	 * largest-remainder split, because the totals chain reads discounts per line and a whole that is
	 * not split would reduce nothing at all. Each row carries the subscription it came from, so the
	 * discount stays attributable after the fact.
	 *
	 * @param order The order just raised.
	 * @param discount The discount granted on this cycle.
	 * @param subscriptionId The subscription whose plan granted it.
	 * @returns The share each line carries, keyed by line id, or an empty map when nothing was granted.
	 */
	private async attachDiscount(order: Order, discount: Money, subscriptionId: ID): Promise<Map<string, Money>> {
		const shares = new Map<string, Money>();

		if (!discount.isPositive()) {
			return shares;
		}

		const lines = await this.linesOf(order.id);
		const grosses = lines.map((line) =>
			Money.of(normalizeDecimalString(line.unitPrice), order.currency as CurrencyCode, order.currencyDecimals)
				.multiply(normalizeDecimalString(line.quantity))
				.round(RoundingMode.HALF_UP, order.currencyDecimals)
		);
		const parts = discount.allocateBy(grosses);

		for (const [index, line] of lines.entries()) {
			const part = parts[index];

			if (!part?.isPositive()) {
				continue;
			}

			await this.adjustmentService.append({
				ownerType: AdjustmentOwnerType.ORDER_LINE,
				ownerId: line.id,
				type: AdjustmentType.PROMOTION,
				amount: part.negate().toStorageString(),
				currency: order.currency as CurrencyCode,
				isTaxInclusive: false,
				referenceType: 'subscription',
				referenceId: subscriptionId,
				description: 'Recurring plan discount.'
			});

			shares.set(line.id, part);
		}

		return shares;
	}

	/**
	 * Records a deferred credit on the order.
	 *
	 * A credit is not a discount: it is value the customer already holds, so it is a credit line — the
	 * order's own register for money owed back — and the totals chain reduces what is outstanding by it
	 * rather than by the grand total. The cycle states it negative, because that is what it is.
	 *
	 * @param order The order just raised.
	 * @param credit The credit the cycle carried, negative when one was owed.
	 * @param subscriptionId The subscription the credit came from.
	 * @returns True when a credit line was written.
	 */
	private async attachCredit(order: Order, credit: Money, subscriptionId: ID): Promise<boolean> {
		if (!credit.isNegative()) {
			return false;
		}

		await this.creditLineService.create({
			orderId: order.id,
			version: Number(order.version ?? 1),
			referenceType: 'subscription',
			referenceId: subscriptionId,
			amount: this.numberOf(credit.abs().toStorageString(), order.currency as CurrencyCode),
			currency: order.currency,
			description: 'Credit from an earlier plan change.'
		});

		return true;
	}

	/**
	 * Rates the order's lines and writes the breakdown into the tax ledger.
	 *
	 * The tax capability computes and persists nothing; the ledger is the platform's and this is where
	 * its rows are written. Only lines that carry a tax category are rated: a catalogue line says which
	 * category it is sold in and the tax capability resolves the rate for it, while a fee or a
	 * proration line has no catalogue item behind it and no category to resolve. The plan discount
	 * reduces the base it is rated on, which is the rule the money specification states
	 * (`baseAmount` is the owner's net after discount), so the discounted share is subtracted here from
	 * the line that carries it.
	 *
	 * @param order The order just raised.
	 * @param currency The currency the order is priced in.
	 * @param regionId The region the order is taxed in, when one was resolved.
	 * @param discountShares The discount each line carries, keyed by line id; a line the allocation did
	 * not reach carries none.
	 * @returns How many tax lines were written, which is what tells the caller whether the order's
	 * totals have to be recomputed.
	 */
	private async writeTax(
		order: Order,
		currency: CurrencyCode,
		regionId: ID | undefined,
		discountShares: Map<string, Money>
	): Promise<number> {
		const lines = await this.linesOf(order.id);
		const rated = lines.filter((line) => Boolean(line.taxCategoryId));

		if (!rated.length) {
			return 0;
		}

		const calculation = await this.taxRateService.calculate({
			currency,
			...(regionId ? { regionId } : {}),
			// A renewal is not a checkout: there is nobody to ask about a catalogue that no rate matches,
			// so an unmatched destination is rated at zero — the tax capability's own rule for an untaxed
			// catalogue — rather than failing a cycle the customer cannot fix.
			allowUntaxedCatalog: true,
			lines: rated.map((line) => ({
				referenceId: line.id,
				taxCategoryId: line.taxCategoryId,
				amount: this.taxableBaseOf(
					line,
					discountShares.get(line.id) ?? Money.zero(currency, this.decimalsOf(currency)),
					currency
				),
				quantity: normalizeDecimalString(line.quantity)
			}))
		});

		let written = 0;

		for (const computed of calculation?.lines ?? []) {
			for (const draft of computed.taxLines ?? []) {
				await this.taxLineService.append({
					ownerType: TaxLineOwnerType.ORDER_LINE,
					ownerId: computed.referenceId,
					taxRateId: draft.taxRateId,
					code: draft.code,
					name: draft.name,
					rate: draft.rate,
					isCompound: draft.isCompound,
					isInclusive: draft.isInclusive,
					baseAmount: draft.baseAmount,
					amount: draft.amount,
					currency: draft.currency,
					providerKey: draft.providerKey,
					metadata: {
						...(draft.metadata ?? {}),
						...(draft.quantity ? { quantity: draft.quantity } : {}),
						...(draft.taxRatePartId ? { taxRatePartId: draft.taxRatePartId } : {}),
						...(draft.taxRegimeId ? { taxRegimeId: draft.taxRegimeId } : {}),
						...(draft.postingKey ? { postingKey: draft.postingKey } : {})
					}
				});

				written += 1;
			}
		}

		return written;
	}

	/**
	 * @param line One of the order's lines.
	 * @param share The discount this line carries.
	 * @param currency The currency the line is expressed in.
	 * @returns The amount the line is rated on: its gross, less the discount allocated to it.
	 */
	private taxableBaseOf(line: OrderLine, share: Money, currency: CurrencyCode): DecimalString {
		const decimals = this.decimalsOf(currency);
		const gross = Money.of(normalizeDecimalString(line.unitPrice), currency, decimals)
			.multiply(normalizeDecimalString(line.quantity))
			.round(RoundingMode.HALF_UP, decimals);
		const discounted = share.isPositive() ? gross.subtract(share) : gross;

		return (discounted.isNegative() ? Money.zero(currency, decimals) : discounted).toStorageString();
	}

	/**
	 * @param orderId The order whose lines are read.
	 * @returns Its lines, oldest position first, through the order package's own line service.
	 */
	private async linesOf(orderId: ID): Promise<OrderLine[]> {
		const lines = await this.lineService.findAll({ where: { orderId } });

		return [...((lines as { items?: OrderLine[] }).items ?? [])].sort(
			(left, right) => Number(left.position ?? 0) - Number(right.position ?? 0)
		);
	}

	/*
	|--------------------------------------------------------------------------
	| What the cycle receives back
	|--------------------------------------------------------------------------
	*/

	/**
	 * @param order The order the cycle produced.
	 * @returns The shape the subscription domain expects: the order, its total and its currency, and
	 * whether the money side is settled — read from the order's own ledger rather than claimed.
	 */
	private async resultOf(order: Order): Promise<ISubscriptionOrderResult> {
		const currency = order.currency as CurrencyCode;
		const decimals = order.currencyDecimals ?? this.decimalsOf(currency);
		const totals = await this.totalsService.computeTotals(order);
		// Settled means money moved and nothing is left owing. The totals chain is asked rather than the
		// order's cached columns, because a payment taken after the order was raised moves the ledger
		// and not the cache, and a cycle reported settled is a cycle the subscription marks paid.
		const paid = Number(totals.paidTotal ?? 0) > 0 && Number(totals.outstandingTotal ?? 0) <= 0;

		// No `paidAt`: the order path raises the document and takes no money, so the instant a settlement
		// happened is the ledger's, and an instant invented here would be a fact nobody recorded.
		return {
			orderId: order.id,
			grandTotal: Money.of(`${totals.grandTotal ?? 0}`, currency, decimals)
				.round(RoundingMode.HALF_UP, decimals)
				.toStorageString(),
			currency,
			paid
		};
	}

	/**
	 * @param value What to hash.
	 * @returns The SHA-256 of its canonical JSON form, which is what a request hash carries.
	 */
	private hash(value: Record<string, unknown>): string {
		return createHash('sha256').update(JSON.stringify(value)).digest('hex');
	}
}
