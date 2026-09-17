import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere } from 'typeorm';
import {
	AdjustmentOwnerType,
	CommerceCartStatus,
	CommerceCartValidationMode,
	CommerceCheckoutSessionStatus,
	ID,
	IPagination,
	TaxLineOwnerType
} from '@gauzy/contracts';
import { AdjustmentService, TaxLineService, TenantAwareCrudService } from '@gauzy/core';
import { CommerceCart } from './commerce-cart.entity';
import { CommerceCartLine } from '../commerce-cart-line/commerce-cart-line.entity';
import { CommerceCartLineService } from '../commerce-cart-line/commerce-cart-line.service';
import { CommerceCartShippingMethodService } from '../commerce-cart-shipping-method/commerce-cart-shipping-method.service';
import { CommerceCartPromotionService } from '../commerce-cart-promotion/commerce-cart-promotion.service';
import { CommerceCheckoutSessionService } from '../commerce-checkout-session/commerce-checkout-session.service';
import { TypeOrmCommerceCartRepository } from './repository/type-orm-commerce-cart.repository';
import { MikroOrmCommerceCartRepository } from './repository/mikro-orm-commerce-cart.repository';
import {
	ITotalsAdjustment,
	ITotalsContext,
	ITotalsLine,
	ITotalsShippingMethod,
	ITotalsSnapshot,
	ITotalsTaxLine,
	TotalsCalculator
} from '../totals/totals-calculator';
import { cartCheckoutRegistry } from '../checkout/cart-checkout.registry';

/**
 * How long a cart lives, in hours, when nothing narrower is configured.
 *
 * These are the documented defaults of the settings keys `commerce_cart.ttlHoursAnonymous` and
 * `commerce_cart.ttlHoursCustomer`; a settings store resolves the tenant, organization or channel
 * value in front of them.
 */
const DEFAULT_TTL_HOURS_ANONYMOUS = 168;
const DEFAULT_TTL_HOURS_CUSTOMER = 720;

/**
 * The cart aggregate's service.
 *
 * Every write here does three things in one place: it scopes the row to the caller's tenant and
 * organization, it leaves the money ledgers (the core `adjustment` and `tax_line` tables) as the only
 * record of *why* an amount changed, and it recomputes the cart's total cache from those ledgers
 * through `TotalsCalculator`. No method writes a total directly, which is what keeps the cache and the
 * ledgers from ever disagreeing.
 */
@Injectable()
export class CommerceCartService extends TenantAwareCrudService<CommerceCart> {
	constructor(
		readonly typeOrmCommerceCartRepository: TypeOrmCommerceCartRepository,
		readonly mikroOrmCommerceCartRepository: MikroOrmCommerceCartRepository,
		private readonly lineService: CommerceCartLineService,
		private readonly shippingMethodService: CommerceCartShippingMethodService,
		private readonly promotionService: CommerceCartPromotionService,
		private readonly checkoutSessionService: CommerceCheckoutSessionService,
		private readonly adjustmentService: AdjustmentService,
		private readonly taxLineService: TaxLineService
	) {
		super(typeOrmCommerceCartRepository, mikroOrmCommerceCartRepository);
	}

	/**
	 * Creates a cart.
	 *
	 * @param entity The cart to create.
	 * @returns The created cart, with its (empty) totals already computed.
	 */
	public async create(entity: DeepPartial<CommerceCart>): Promise<CommerceCart> {
		if (!entity.channelId) {
			throw new BadRequestException('CART_CHANNEL_REQUIRED: a cart belongs to a sales channel.');
		}
		if (!entity.currency) {
			throw new BadRequestException('CART_CURRENCY_REQUIRED: a cart is priced in one currency.');
		}

		const now = new Date();

		entity.status = CommerceCartStatus.ACTIVE;
		entity.version = 1;
		entity.lastActivityAt = now;
		entity.currencyDecimals = entity.currencyDecimals ?? 2;

		const cart = await super.create(entity);

		return this.recalculate(cart.id, 'CART_CREATED');
	}

	/**
	 * Reads a cart with everything a caller needs to render it.
	 *
	 * @param id The cart's id.
	 * @returns The cart with its lines, shipping methods and promotions.
	 */
	public async findOneWithContent(id: ID): Promise<CommerceCart> {
		const cart = await this.findOneByIdString(id, {
			relations: ['lines', 'shippingMethods', 'promotions']
		});

		if (!cart) {
			throw new NotFoundException(`CART_NOT_FOUND: no cart exists with id ${id}.`);
		}

		return cart;
	}

	/**
	 * Adds a line to a cart, merging into an existing line when every attribute that distinguishes two
	 * lines matches.
	 *
	 * The price is **not** resolved here: resolving a price is the pricing package's job, and a cart
	 * that invented one would be a second price resolver. The caller states the resolved unit price and
	 * the line snapshots it.
	 *
	 * @param cartId The cart.
	 * @param line The line to add.
	 * @returns The cart after the addition, re-priced.
	 */
	public async addLine(cartId: ID, line: DeepPartial<CommerceCartLine>): Promise<CommerceCart> {
		const cart = await this.assertMutable(cartId);

		if (!line.variantId) {
			throw new BadRequestException('CART_LINE_VARIANT_REQUIRED: a line needs a variant.');
		}
		if (!line.quantity || line.quantity <= 0) {
			throw new BadRequestException('CART_LINE_QUANTITY_INVALID: a line quantity must be positive.');
		}
		if (line.unitPrice === undefined || line.unitPrice === null) {
			throw new BadRequestException(
				'CART_LINE_PRICE_REQUIRED: the resolved unit price must be supplied by the price resolver.'
			);
		}

		const existing = (await this.lineService.findAll({ where: { cartId: cart.id } })) as IPagination<CommerceCartLine>;
		const match = existing.items.find(
			(candidate: CommerceCartLine) =>
				candidate.variantId === line.variantId &&
				(candidate.warehouseId ?? null) === (line.warehouseId ?? null) &&
				Number(candidate.unitPrice) === Number(line.unitPrice) &&
				candidate.isTaxInclusive === (line.isTaxInclusive ?? false) &&
				(candidate.subscriptionPlanId ?? null) === (line.subscriptionPlanId ?? null)
		);

		if (match) {
			await this.lineService.update(match.id, {
				quantity: Number(match.quantity) + Number(line.quantity)
			});
		} else {
			await this.lineService.create({
				...line,
				cartId: cart.id,
				originalUnitPrice: line.originalUnitPrice ?? line.unitPrice,
				isTaxInclusive: line.isTaxInclusive ?? false,
				isDiscountable: line.isDiscountable ?? true,
				requiresShipping: line.requiresShipping ?? true,
				position: line.position ?? existing.items.length
			} as DeepPartial<CommerceCartLine>);
		}

		return this.recalculate(cart.id, 'LINE_ADDED');
	}

	/**
	 * Changes a line's quantity, note or custom price.
	 *
	 * @param cartId The cart.
	 * @param lineId The line.
	 * @param changes The fields to change.
	 * @returns The cart after the change, re-priced.
	 */
	public async updateLine(
		cartId: ID,
		lineId: ID,
		changes: DeepPartial<CommerceCartLine>
	): Promise<CommerceCart> {
		await this.assertMutable(cartId);
		await this.assertLineBelongsToCart(cartId, lineId);

		if (changes.quantity !== undefined && Number(changes.quantity) <= 0) {
			throw new BadRequestException('CART_LINE_QUANTITY_INVALID: a line quantity must be positive.');
		}

		await this.lineService.update(lineId, changes as any);

		return this.recalculate(cartId, 'LINE_UPDATED');
	}

	/**
	 * Removes a line.
	 *
	 * @param cartId The cart.
	 * @param lineId The line.
	 * @returns The cart after the removal, re-priced.
	 */
	public async removeLine(cartId: ID, lineId: ID): Promise<CommerceCart> {
		await this.assertMutable(cartId);
		await this.assertLineBelongsToCart(cartId, lineId);

		await this.lineService.delete(lineId);

		return this.recalculate(cartId, 'LINE_REMOVED');
	}

	/**
	 * Sets the cart's delivery choice, replacing whatever was there.
	 *
	 * A cart holds at most one method per call to this method: setting a new one soft-deletes the
	 * previous rows so that `shippingSubtotal` is never the sum of a stale and a current choice.
	 *
	 * @param cartId The cart.
	 * @param method The chosen method.
	 * @returns The cart after the choice, re-priced.
	 */
	public async setShippingMethod(cartId: ID, method: DeepPartial<CommerceCartShippingMethod>): Promise<CommerceCart> {
		await this.assertMutable(cartId);

		if (!method.name) {
			throw new BadRequestException('CART_SHIPPING_METHOD_NAME_REQUIRED: a shipping method needs a name.');
		}
		if (method.amount === undefined || method.amount === null) {
			throw new BadRequestException(
				'CART_SHIPPING_PRICE_REQUIRED: the computed shipping amount must be supplied by the calculator.'
			);
		}

		const existing = (await this.shippingMethodService.findAll({
			where: { cartId }
		})) as IPagination<CommerceCartShippingMethod>;

		for (const previous of existing.items) {
			await this.shippingMethodService.delete(previous.id);
		}

		await this.shippingMethodService.create({
			...method,
			cartId,
			isTaxInclusive: method.isTaxInclusive ?? false,
			isManual: method.isManual ?? false
		} as DeepPartial<CommerceCartShippingMethod>);

		return this.recalculate(cartId, 'SHIPPING_CHANGED');
	}

	/**
	 * Applies a promotion to the cart as a snapshot row.
	 *
	 * The discount amount is produced by the promotion engine and handed here; this service records it
	 * and re-prices, so removing a promotion later rebuilds the whole set from the ledger rather than
	 * unpicking one row.
	 *
	 * @param cartId The cart.
	 * @param promotion The applied promotion.
	 * @returns The cart after the application, re-priced.
	 */
	public async applyPromotion(cartId: ID, promotion: DeepPartial<CommerceCartPromotion>): Promise<CommerceCart> {
		await this.assertMutable(cartId);

		if (promotion.amount === undefined || promotion.amount === null) {
			throw new BadRequestException(
				'CART_PROMOTION_AMOUNT_REQUIRED: the discount amount must be produced by the promotion engine.'
			);
		}

		const existing = (await this.promotionService.findAll({
			where: { cartId }
		})) as IPagination<CommerceCartPromotion>;

		const duplicate = existing.items.find(
			(candidate: CommerceCartPromotion) =>
				(promotion.promotionId && candidate.promotionId === promotion.promotionId) ||
				(promotion.code && candidate.code === promotion.code)
		);

		if (duplicate) {
			await this.promotionService.update(duplicate.id, {
				amount: promotion.amount
			} as any);
		} else {
			await this.promotionService.create({
				...promotion,
				cartId,
				isAutomatic: promotion.isAutomatic ?? false,
				appliedAt: new Date()
			} as DeepPartial<CommerceCartPromotion>);
		}

		return this.recalculate(cartId, 'PROMOTION_CHANGED');
	}

	/**
	 * Removes an applied promotion.
	 *
	 * @param cartId The cart.
	 * @param code The code, or the promotion's id, of the promotion to remove.
	 * @returns The cart after the removal, re-priced.
	 */
	public async removePromotion(cartId: ID, code: string): Promise<CommerceCart> {
		await this.assertMutable(cartId);

		const existing = (await this.promotionService.findAll({
			where: { cartId }
		})) as IPagination<CommerceCartPromotion>;

		for (const applied of existing.items) {
			if (applied.code === code || applied.promotionId === code) {
				await this.promotionService.delete(applied.id);
			}
		}

		return this.recalculate(cartId, 'PROMOTION_REMOVED');
	}

	/**
	 * Recomputes the cart's totals from its lines, its shipping methods and the core money ledgers.
	 *
	 * This is the only writer of the total columns. It bumps the cart's version, touches its activity
	 * stamp and refreshes its expiry, so a caller that reads the cart afterwards sees one consistent
	 * state rather than a partially updated one.
	 *
	 * @param cartId The cart.
	 * @param reason The reason code, recorded for diagnostics.
	 * @returns The cart with its recomputed totals.
	 */
	public async recalculate(cartId: ID, reason: string): Promise<CommerceCart> {
		const cart = await this.findOneByIdString(cartId);

		if (!cart) {
			throw new NotFoundException(`CART_NOT_FOUND: no cart exists with id ${cartId}.`);
		}

		const snapshot = await this.computeTotals(cart);
		const now = new Date();

		await this.update(cart.id, {
			itemSubtotal: snapshot.itemSubtotal,
			itemDiscountTotal: snapshot.itemDiscountTotal,
			itemTaxTotal: snapshot.itemTaxTotal,
			shippingSubtotal: snapshot.shippingSubtotal,
			shippingDiscountTotal: snapshot.shippingDiscountTotal,
			shippingTaxTotal: snapshot.shippingTaxTotal,
			discountTotal: snapshot.discountTotal,
			taxTotal: snapshot.taxTotal,
			grandTotal: snapshot.grandTotal,
			version: Number(cart.version) + 1,
			lastActivityAt: now,
			expiresAt: this.expiryOf(cart, now),
			metadata: { ...(cart.metadata ?? {}), lastRecalculationReason: reason }
		} as any);

		return this.findOneByIdString(cart.id);
	}

	/**
	 * Runs the checkout validation ladder without writing anything.
	 *
	 * @param cartId The cart.
	 * @param mode How much of the report the caller wants.
	 * @returns The verdict, with one entry per step that ran.
	 */
	public async validate(
		cartId: ID,
		mode: CommerceCartValidationMode = CommerceCartValidationMode.STRICT
	): Promise<{
		valid: boolean;
		mode: CommerceCartValidationMode;
		cartVersion: number;
		errors: Array<{ code: string; step: string; message: string }>;
		steps: Array<{ step: string; status: string }>;
	}> {
		const cart = await this.findOneWithContent(cartId);
		const errors: Array<{ code: string; step: string; message: string }> = [];
		const steps: Array<{ step: string; status: string }> = [];

		const check = (step: string, code: string, message: string, passed: boolean) => {
			steps.push({ step, status: passed ? 'PASSED' : 'FAILED' });

			if (!passed) {
				errors.push({ code, step, message });
			}

			return passed;
		};

		const running = check(
			'CART_STATUS',
			'CART_STATUS_INVALID',
			`A cart in status ${cart.status} cannot complete.`,
			[CommerceCartStatus.ACTIVE, CommerceCartStatus.ABANDONED].includes(cart.status)
		);

		if (mode === CommerceCartValidationMode.STRICT && !running) {
			return { valid: false, mode, cartVersion: cart.version, errors, steps };
		}

		check(
			'CART_NOT_EMPTY',
			'CART_EMPTY',
			'A cart needs at least one line with a positive quantity.',
			(cart.lines ?? []).some((line) => Number(line.quantity) > 0)
		);
		check(
			'CART_EXPIRY',
			'CART_EXPIRED',
			'The cart is past its expiry instant.',
			!cart.expiresAt || new Date(cart.expiresAt).getTime() > Date.now()
		);
		check(
			'CUSTOMER',
			'CART_EMAIL_REQUIRED',
			'A guest checkout needs an email address the order can be sent to.',
			Boolean(cart.customerId || cart.email)
		);
		check(
			'SHIPPING_METHOD',
			'CART_SHIPPING_METHOD_REQUIRED',
			'A cart with a shippable line needs a delivery choice.',
			!(cart.lines ?? []).some((line) => line.requiresShipping) || (cart.shippingMethods ?? []).length > 0
		);
		check(
			'ADDRESS',
			'CART_SHIPPING_ADDRESS_REQUIRED',
			'A cart with a shippable line needs a shipping address snapshot.',
			!(cart.lines ?? []).some((line) => line.requiresShipping) ||
				Boolean(cart.shippingAddressId || cart.shippingAddressSnapshot)
		);
		check(
			'CURRENCY',
			'CART_CURRENCY_REQUIRED',
			'The cart must be priced in a currency.',
			Boolean(cart.currency)
		);

		return { valid: errors.length === 0, mode, cartVersion: cart.version, errors, steps };
	}

	/**
	 * Completes a cart: it is validated strictly, its totals are recomputed once more, and the order is
	 * placed through the registered checkout handler.
	 *
	 * The handler is what makes this legal across the package boundary — the cart never imports the
	 * order package. An installation without a handler gets a loud failure rather than a cart that
	 * silently never becomes an order.
	 *
	 * @param cartId The cart.
	 * @param options The checkout request.
	 * @returns The placed order's identity and the cart it came from.
	 */
	public async complete(
		cartId: ID,
		options: { idempotencyKey?: string; paymentSessionId?: string } = {}
	): Promise<{ cart: CommerceCart; orderId: string; orderNumber: string }> {
		const verdict = await this.validate(cartId, CommerceCartValidationMode.STRICT);

		if (!verdict.valid) {
			throw new BadRequestException({
				message: 'The cart cannot be completed.',
				code: verdict.errors[0]?.code ?? 'CART_NOT_COMPLETABLE',
				details: { errors: verdict.errors, steps: verdict.steps }
			});
		}

		const cart = await this.recalculate(cartId, 'CHECKOUT_VALIDATION');
		const handler = cartCheckoutRegistry.resolve();

		if (!handler) {
			throw new ServiceUnavailableException(
				'CHECKOUT_HANDLER_MISSING: no package has registered a checkout handler for this installation.'
			);
		}

		const result = await handler.complete({
			cart,
			idempotencyKey: options.idempotencyKey,
			paymentSessionId: options.paymentSessionId
		});

		const completedAt = new Date();

		await this.update(cart.id, {
			status: CommerceCartStatus.COMPLETED,
			orderId: result.orderId,
			completedAt,
			version: Number(cart.version) + 1,
			lastActivityAt: completedAt,
			metadata: {
				...(cart.metadata ?? {}),
				checkoutStartedAt: null,
				checkoutOperationId: null,
				checkoutCompletedAt: completedAt.toISOString()
			}
		} as any);

		await this.checkoutSessionService.closeForCart(cart.id, CommerceCheckoutSessionStatus.COMPLETED);

		return { cart: await this.findOneByIdString(cart.id), orderId: result.orderId, orderNumber: result.orderNumber };
	}

	/**
	 * Marks a cart abandoned.
	 *
	 * The cart and its lines stay readable so the buyer can return to it, which is why abandonment is a
	 * status and not a deletion.
	 *
	 * @param cartId The cart.
	 * @returns The abandoned cart.
	 */
	public async abandon(cartId: ID): Promise<CommerceCart> {
		const cart = await this.findOneByIdString(cartId);

		if (!cart) {
			throw new NotFoundException(`CART_NOT_FOUND: no cart exists with id ${cartId}.`);
		}

		if (cart.status === CommerceCartStatus.COMPLETED || cart.status === CommerceCartStatus.MERGED) {
			throw new BadRequestException(`CART_STATUS_INVALID: a ${cart.status} cart cannot be abandoned.`);
		}

		await this.update(cart.id, {
			status: CommerceCartStatus.ABANDONED,
			abandonedAt: new Date(),
			version: Number(cart.version) + 1
		} as any);

		return this.findOneByIdString(cart.id);
	}

	/**
	 * Merges a source cart into a target cart.
	 *
	 * The target wins: its custom prices and its promotions survive, and the source keeps no lines
	 * afterwards because they were moved rather than copied.
	 *
	 * @param targetCartId The cart that survives.
	 * @param sourceCartId The cart that is merged away.
	 * @returns The target cart, re-priced.
	 */
	public async merge(targetCartId: ID, sourceCartId: ID): Promise<CommerceCart> {
		if (targetCartId === sourceCartId) {
			throw new BadRequestException('CART_MERGE_INVALID: a cart cannot be merged into itself.');
		}

		const target = await this.assertMutable(targetCartId);
		const source = await this.findOneWithContent(sourceCartId);

		if (!source || source.status === CommerceCartStatus.COMPLETED || source.status === CommerceCartStatus.MERGED) {
			throw new BadRequestException(`CART_MERGE_INVALID: a ${source?.status ?? 'missing'} cart cannot be merged.`);
		}

		for (const line of source.lines ?? []) {
			await this.addLine(target.id, {
				productId: line.productId,
				variantId: line.variantId,
				sellerId: line.sellerId,
				title: line.title,
				sku: line.sku,
				thumbnail: line.thumbnail,
				quantity: line.quantity,
				unitPrice: line.unitPrice,
				originalUnitPrice: line.originalUnitPrice,
				isTaxInclusive: line.isTaxInclusive,
				taxCategoryId: line.taxCategoryId,
				isDiscountable: line.isDiscountable,
				requiresShipping: line.requiresShipping,
				weight: line.weight,
				warehouseId: line.warehouseId,
				subscriptionPlanId: line.subscriptionPlanId,
				metadata: line.metadata
			} as DeepPartial<CommerceCartLine>);
		}

		if ((target.shippingMethods ?? []).length === 0 && (source.shippingMethods ?? []).length > 0) {
			const sourceMethod = (source.shippingMethods ?? [])[0];

			await this.setShippingMethod(target.id, {
				shippingOptionId: sourceMethod.shippingOptionId,
				name: sourceMethod.name,
				amount: sourceMethod.amount,
				isTaxInclusive: sourceMethod.isTaxInclusive,
				taxCategoryId: sourceMethod.taxCategoryId,
				data: sourceMethod.data,
				isManual: sourceMethod.isManual
			} as DeepPartial<CommerceCartShippingMethod>);
		}

		const mergedAt = new Date();

		await this.update(source.id, {
			status: CommerceCartStatus.MERGED,
			version: Number(source.version) + 1,
			metadata: { ...(source.metadata ?? {}), mergedIntoCartId: target.id, mergedAt: mergedAt.toISOString() }
		} as any);

		// The source keeps no lines: its rows are soft-deleted so that the totals of a merged cart and
		// the promise that it is empty agree.
		for (const line of source.lines ?? []) {
			await this.lineService.delete(line.id);
		}

		const recalculated = await this.recalculate(target.id, 'CART_MERGED');

		await this.update(recalculated.id, {
			metadata: {
				...(recalculated.metadata ?? {}),
				mergedFromCartIds: [
					...((recalculated.metadata?.mergedFromCartIds as string[]) ?? []),
					source.id
				]
			}
		} as any);

		return this.findOneByIdString(target.id);
	}

	/**
	 * Expires every cart past its expiry instant.
	 *
	 * @param limit The maximum number of carts to process in one run.
	 * @returns The ids of the carts that were expired.
	 */
	public async expireDueCarts(limit = 500): Promise<ID[]> {
		const due = (await this.findAll({ where: { status: CommerceCartStatus.ACTIVE } })) as IPagination<CommerceCart>;
		const now = Date.now();
		const expired: ID[] = [];

		for (const cart of due.items) {
			if (expired.length >= limit) {
				break;
			}

			if (cart.expiresAt && new Date(cart.expiresAt).getTime() <= now) {
				await this.update(cart.id, {
					status: CommerceCartStatus.EXPIRED,
					version: Number(cart.version) + 1
				} as any);
				expired.push(cart.id);
			}
		}

		return expired;
	}

	/**
	 * Computes a cart's totals from the ledgers.
	 *
	 * @param cart The cart.
	 * @returns The computed totals.
	 */
	public async computeTotals(cart: CommerceCart): Promise<ITotalsSnapshot> {
		const lines = cart.lines ?? ((await this.lineService.findAll({ where: { cartId: cart.id } })) as IPagination<CommerceCartLine>).items;
		const shippingMethods =
			cart.shippingMethods ??
			((await this.shippingMethodService.findAll({
				where: { cartId: cart.id }
			})) as IPagination<CommerceCartShippingMethod>).items;

		const lineAdjustments: ITotalsAdjustment[] = [];
		const shippingAdjustments: ITotalsAdjustment[] = [];
		const lineTaxLines: ITotalsTaxLine[] = [];
		const shippingTaxLines: ITotalsTaxLine[] = [];

		for (const line of lines) {
			for (const adjustment of await this.adjustmentService.findByOwner(AdjustmentOwnerType.CART_LINE, line.id)) {
				lineAdjustments.push({
					ownerId: line.id,
					amount: Number(adjustment.amount),
					isTaxInclusive: Boolean(adjustment.isTaxInclusive),
					netAmount: this.netAmountOf(adjustment.metadata)
				});
			}

			for (const taxLine of await this.taxLineService.findByOwner(TaxLineOwnerType.CART_LINE, line.id)) {
				lineTaxLines.push({ ownerId: line.id, amount: Number(taxLine.amount) });
			}
		}

		for (const method of shippingMethods) {
			for (const adjustment of await this.adjustmentService.findByOwner(
				AdjustmentOwnerType.CART_SHIPPING,
				method.id
			)) {
				shippingAdjustments.push({
					ownerId: method.id,
					amount: Number(adjustment.amount),
					isTaxInclusive: Boolean(adjustment.isTaxInclusive),
					netAmount: this.netAmountOf(adjustment.metadata)
				});
			}

			for (const taxLine of await this.taxLineService.findByOwner(TaxLineOwnerType.CART_SHIPPING, method.id)) {
				shippingTaxLines.push({ ownerId: method.id, amount: Number(taxLine.amount) });
			}
		}

		const context: ITotalsContext = {
			currency: cart.currency,
			currencyDecimals: cart.currencyDecimals ?? 2,
			lines: lines.map(
				(line): ITotalsLine => ({
					id: line.id,
					quantity: Number(line.quantity),
					unitPrice: Number(line.unitPrice),
					isTaxInclusive: Boolean(line.isTaxInclusive)
				})
			),
			shippingMethods: shippingMethods.map(
				(method): ITotalsShippingMethod => ({
					id: method.id,
					amount: Number(method.amount),
					isTaxInclusive: Boolean(method.isTaxInclusive)
				})
			),
			lineAdjustments,
			shippingAdjustments,
			lineTaxLines,
			shippingTaxLines
		};

		return TotalsCalculator.compute(context);
	}

	/**
	 * Loads a cart that must be mutable, or refuses.
	 *
	 * @param cartId The cart.
	 * @returns The cart.
	 */
	private async assertMutable(cartId: ID): Promise<CommerceCart> {
		const cart = await this.findOneByIdString(cartId);

		if (!cart) {
			throw new NotFoundException(`CART_NOT_FOUND: no cart exists with id ${cartId}.`);
		}

		if (![CommerceCartStatus.ACTIVE, CommerceCartStatus.ABANDONED].includes(cart.status)) {
			throw new BadRequestException(`CART_STATUS_INVALID: a ${cart.status} cart is immutable.`);
		}

		return cart;
	}

	/**
	 * Refuses a line that belongs to another cart, so a caller cannot edit across aggregates.
	 *
	 * @param cartId The cart.
	 * @param lineId The line.
	 */
	private async assertLineBelongsToCart(cartId: ID, lineId: ID): Promise<void> {
		const line = await this.lineService.findOneByWhereOptions({ id: lineId } as FindOptionsWhere<CommerceCartLine>);

		if (!line || line.cartId !== cartId) {
			throw new NotFoundException(`CART_LINE_NOT_FOUND: cart ${cartId} has no line ${lineId}.`);
		}
	}

	/**
	 * @param cart The cart.
	 * @param from The instant the lifetime starts.
	 * @returns The instant the cart expires.
	 */
	private expiryOf(cart: CommerceCart, from: Date): Date {
		const hours = cart.customerId ? DEFAULT_TTL_HOURS_CUSTOMER : DEFAULT_TTL_HOURS_ANONYMOUS;

		return new Date(from.getTime() + hours * 60 * 60 * 1000);
	}

	/**
	 * Reads the net part an inclusive adjustment recorded in its metadata.
	 *
	 * @param metadata The ledger row's metadata.
	 * @returns The net amount, or undefined when the row does not carry one.
	 */
	private netAmountOf(metadata: Record<string, unknown> | undefined): number | undefined {
		const netAmount = metadata?.['netAmount'];

		return typeof netAmount === 'number' ? netAmount : undefined;
	}
}
