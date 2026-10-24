import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
	Optional,
	ServiceUnavailableException
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DeepPartial, FindOptionsWhere, In, IsNull, LessThanOrEqual } from 'typeorm';
import {
	AdjustmentOwnerType,
	AdjustmentType,
	CommerceCartStatus,
	CommerceCartValidationMode,
	CommerceCheckoutSessionStatus,
	CurrencyCode,
	ID,
	IPagination,
	RoundingMode,
	TaxLineOwnerType
} from '@gauzy/contracts';
import {
	AdjustmentService,
	IVersionExpectation,
	Money,
	RequestContext,
	TaxLineService,
	TenantAwareCrudService,
	assertPlainReferencesNotForeign,
	commitVersionedUpdate,
	currencyPrecision,
	normalizeDecimalString,
	parseEntityVersion
} from '@gauzy/core';
import { CommerceCart } from './commerce-cart.entity';
import { digestCartToken, issueCartToken } from './cart-token';
import { CommerceCartLine } from '../commerce-cart-line/commerce-cart-line.entity';
import { CommerceCartLineService } from '../commerce-cart-line/commerce-cart-line.service';
import { CommerceCartShippingMethod } from '../commerce-cart-shipping-method/commerce-cart-shipping-method.entity';
import { CommerceCartShippingMethodService } from '../commerce-cart-shipping-method/commerce-cart-shipping-method.service';
import { CommerceCartPromotion } from '../commerce-cart-promotion/commerce-cart-promotion.entity';
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
import {
	CART_PRICE_RESOLUTION,
	CART_PROMOTION_EVALUATION,
	CART_SHIPPING_RATE,
	CART_STOCK_AVAILABILITY,
	CART_TAX_CALCULATION,
	CART_TAX_CATEGORY,
	ICartPricePort,
	ICartShippingOption,
	ICartShippingRatePort,
	ICartTaxCategoryPort,
	ICartPromotionApplication,
	ICartPromotionPort,
	ICartResolvedPrice,
	ICartStockPort,
	ICartTaxPort
} from '../cart.types';
import { CART_REFERENCES } from '../cart.references';

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
 * How long a cart may sit untouched before the sweep treats it as abandoned.
 *
 * The documented default of the settings key `cart.abandonedAfterHours`, which `CART_SETTING_CONTRIBUTIONS`
 * declares and which nothing in the package read until the abandonment sweep existed.
 */
const DEFAULT_ABANDON_AFTER_HOURS = 24;

/**
 * The metadata key a ledger row written by the promotion rebuild carries.
 *
 * It is what makes the rebuild idempotent: the rows this service derives from the cart's promotion
 * snapshots are exactly the rows it may replace on the next recalculation, and a row an operator
 * entered by hand — a manual credit, a handling fee — carries no such key and is never touched.
 */
const CART_PROMOTION_ADJUSTMENT_KEY = 'cartPromotionId';

/**
 * The version a write that no caller conditioned on is predicated on.
 *
 * A write that arrives from a route is predicated on the version its caller stated, so a change based
 * on a cart that has moved on is refused rather than applied. A write that arrives from anywhere else
 * — the checkout handler's own follow-up, the merge of a second cart, the expiry pass — has no caller
 * to condition it, and is predicated on the version the row holds when the statement runs. Either way
 * the comparison and the increment are one statement, so no write here is a last-writer-wins write.
 */
const ANY_VERSION: IVersionExpectation = { wildcard: true, versions: [] };

/**
 * The statuses a cart may be claimed for checkout from — the same statuses the validation ladder lets
 * complete and the order package creates an order from.
 */
const CHECKOUT_CLAIMABLE_STATUSES = [CommerceCartStatus.ACTIVE, CommerceCartStatus.ABANDONED];

/**
 * How long a checkout's claim on a cart holds (R3-10).
 *
 * A checkout places its order in seconds; a claim this old belongs to a process that died between the
 * claim and the order, and lapses so the cart can be bought again. The order package's unique index on
 * `order.cartId` still stands behind a claim that lapsed while its checkout was, after all, alive.
 */
const CHECKOUT_CLAIM_TTL_MS = 10 * 60 * 1000;

/**
 * The line metadata key that records where a line's price came from (R3-07b).
 *
 * `ENGINE` — the price capability resolved it, and checkout resolves it again. `STATED` — an in-process caller
 * that resolved the price itself stated it (the subscription cycle's cart); checkout keeps it. A line without
 * the key predates the rule and is re-priced at checkout. A caller cannot set the key: a route's metadata is
 * overwritten with the line's own source.
 */
const LINE_PRICE_SOURCE = 'priceSource';

/** How a caller adds or changes a line. */
export interface ICartLineWriteOptions {
	/**
	 * The caller resolved the price itself and states it (R3-07b). Only an in-process caller does — the
	 * subscription cycle builds its cart from the recurring price it resolved — and no route passes it:
	 * without it the price capability prices the line and any stated price is ignored.
	 */
	readonly statedPrice?: boolean;
}

/**
 * What the `STOCK` step refuses with: the ladder's error shape, plus what it measured, so an operator
 * reading the refusal can see the quantity that was asked for and the one that could have been served.
 */
interface IStockRefusal {
	readonly code: string;
	readonly step: string;
	readonly message: string;
	readonly details: Record<string, unknown>;
}

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
		private readonly taxLineService: TaxLineService,
		@Optional()
		@Inject(CART_STOCK_AVAILABILITY)
		private readonly stockAvailability?: ICartStockPort,
		@Optional()
		@Inject(CART_TAX_CALCULATION)
		private readonly taxCalculation?: ICartTaxPort,
		@Optional()
		@Inject(CART_PROMOTION_EVALUATION)
		private readonly promotionEvaluation?: ICartPromotionPort,
		@Optional()
		@Inject(CART_PRICE_RESOLUTION)
		private readonly priceResolution?: ICartPricePort,
		@Optional()
		@Inject(CART_SHIPPING_RATE)
		private readonly shippingRate?: ICartShippingRatePort,
		@Optional()
		@Inject(CART_TAX_CATEGORY)
		private readonly taxCategories?: ICartTaxCategoryPort
	) {
		super(typeOrmCommerceCartRepository, mikroOrmCommerceCartRepository);
	}

	/**
	 * The scope a conditional write on a cart is predicated on, beyond the row's own identity.
	 *
	 * `commitVersionedUpdate` documents its `where` as the place the tenant and organization scope
	 * belongs, and states it in the negative: a conditional statement that names only an identifier is
	 * one another tenant's identifier can satisfy. The base class merges the caller's tenant into every
	 * `UPDATE` it issues, so this is belt and braces rather than the only guard — but it is the guard
	 * that survives a future call that assembles its criteria by hand, and it costs a predicate.
	 *
	 * @returns The conditions a write is scoped by, or nothing when there is no caller in context —
	 * a job, a seeder or a test has no tenant to be scoped by and must not be scoped by an absent one.
	 */
	private get writeScope(): Record<string, unknown> {
		const tenantId = RequestContext.currentTenantId();

		return tenantId ? { tenantId } : {};
	}

	/**
	 * Refuses a cart, or a change to one, that names a channel, region, customer or user of another tenant
	 * (`CART_REFERENCES`). Checked on the TypeORM manager, which reads these tables under either ORM.
	 *
	 * @param payload The cart, or the change set, about to be written.
	 * @throws ForbiddenException when a reference names a row of another tenant.
	 */
	private async assertReferences(payload: object): Promise<void> {
		await assertPlainReferencesNotForeign(
			this.typeOrmCommerceCartRepository.manager,
			payload,
			CART_REFERENCES,
			RequestContext.currentTenantId()
		);
	}

	/**
	 * Writes the fields a caller changed onto a cart, under the version that caller read.
	 *
	 * The write is predicated on the caller's version rather than on the one the row happens to hold,
	 * which is what turns a second editor's change to the same cart into a refusal instead of a silent
	 * overwrite. The cart is re-priced afterwards, so the totals cache never outlives the fields it was
	 * computed from.
	 *
	 * @param id The cart.
	 * @param changes The fields to change.
	 * @param expectation The version the caller read the cart at.
	 * @param reason The reason code the recomputation records, which names what the change was.
	 * @returns The changed cart, with its recomputed totals.
	 */
	public async applyChanges(
		id: ID,
		changes: DeepPartial<CommerceCart>,
		expectation: IVersionExpectation = ANY_VERSION,
		reason: string = 'CART_UPDATED'
	): Promise<CommerceCart> {
		// A cart a checkout has claimed is the one its order is being built from (R3-10): an address or a
		// currency changed now would be on the cart and not on the order.
		// A miss is left to the conditional write below, which answers it the way every versioned write does.
		const current = await this.findOneByIdString(id).catch((error: unknown) => {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		});

		if (current && this.holdsLiveCheckoutClaim(current)) {
			throw this.checkoutInProgress(id);
		}

		await this.assertReferences(changes ?? {});

		await commitVersionedUpdate<CommerceCart>(this, {
			id,
			expectation,
			where: this.writeScope,
			// The version is written by the conditional update and never by the caller's payload, so a
			// body that carried one cannot move the row past the version the write was predicated on.
			patch: { ...(changes as Record<string, unknown>) }
		});

		return this.recalculate(id, reason, ANY_VERSION);
	}

	/**
	 * Creates a cart and issues its guest-access token.
	 *
	 * @param entity The cart to create.
	 * @returns The created cart, with its (empty) totals already computed and its guest-access token in
	 * `token` — the one answer that carries it.
	 */
	public async create(entity: DeepPartial<CommerceCart>): Promise<CommerceCart & { token: string }> {
		if (!entity.channelId) {
			throw new BadRequestException('CART_CHANNEL_REQUIRED: a cart belongs to a sales channel.');
		}
		if (!entity.currency) {
			throw new BadRequestException('CART_CURRENCY_REQUIRED: a cart is priced in one currency.');
		}

		await this.assertReferences(entity);

		const now = new Date();

		entity.status = CommerceCartStatus.ACTIVE;
		entity.version = 1;
		entity.lastActivityAt = now;
		// **Not two.** The literal default priced every currency at two decimals, so a KWD cart — three
		// decimal places — had every amount computed and rounded at the wrong scale (a 1.234 KWD line
		// became 1.23 while the unit price column kept 1.234, and the buyer was undercharged), and a JPY
		// cart, which has none, could hold a grand total of 100.25 that no payment provider will accept.
		// The platform has a precision table for exactly this question and it was dead code outside the
		// money layer itself; the stored column remains the override, so a caller that states a scale
		// still gets it and existing rows are untouched.
		entity.currencyDecimals = entity.currencyDecimals ?? this.decimalsOf(entity.currency as CurrencyCode);

		// The guest-access token. Only its digest is written to the cart, and the token itself is put on this
		// answer: no read of the cart answers it again. (A create sent under an idempotency key is replayed
		// from the platform's record of this answer, token included, for the key's retention window — that
		// replay is the one way a client that lost the answer gets its token back.) Anything
		// the caller sent under either name is overwritten rather than trusted — a caller that chose its
		// own token would have chosen one somebody else can guess.
		const token = issueCartToken();

		delete (entity as Record<string, unknown>)['token'];
		entity.tokenHash = digestCartToken(token);

		// R2-G19: `createCart` states no organization and the tenant-aware base stamps the tenant only, so a
		// cart created over GraphQL had `organizationId = NULL`. A stated organization is kept (REST states it,
		// validated against the caller).
		entity.organizationId = entity.organizationId ?? RequestContext.currentOrganizationId() ?? undefined;

		const cart = await super.create(entity);
		const created = await this.recalculate(cart.id, 'CART_CREATED');

		return Object.assign(this.withoutTokenHash(created), { token });
	}

	/**
	 * Reads the cart a guest-access token names, within the caller's tenant.
	 *
	 * The token is hashed and the digest looked up, so the plaintext is never compared, logged or
	 * stored, and a database that leaked would not yield a token that works. The lookup **fails closed**:
	 * with no tenant in context there is nothing to scope it by, and an unscoped lookup by a bearer token
	 * is a cross-tenant read, so it answers nothing instead. The tenant is stated in the `where` as well
	 * as merged in by the base class, which is the guard that survives a future caller that assembles the
	 * criteria by hand.
	 *
	 * @param token The plaintext token the create answered with.
	 * @returns The cart with its lines, delivery choices and promotions, or null when no cart of the
	 * caller's tenant carries that token.
	 */
	public async findByToken(token: string): Promise<CommerceCart | null> {
		const tenantId = RequestContext.currentTenantId();

		if (!tenantId || typeof token !== 'string' || token.trim() === '') {
			return null;
		}

		try {
			const cart = await this.findOneByOptions({
				where: { tokenHash: digestCartToken(token), tenantId } as FindOptionsWhere<CommerceCart>,
				relations: ['lines', 'shippingMethods', 'promotions']
			});

			return this.withoutTokenHash(cart);
		} catch (error) {
			// The read raises on a miss (`CrudService.findOneByOptions`); a miss is this method's ordinary
			// answer, and anything else — the store being down — is not one and is raised as it came.
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * A cart as the two token paths answer it: without the digest, whatever the read loaded.
	 *
	 * Neither ORM hands the digest out — TypeORM does not select it and MikroORM does not serialize it —
	 * so this is belt and braces on the two answers that sit next to the token, where a digest beside the
	 * token it was computed from would be the one place both halves were on one page.
	 *
	 * @param cart The cart as it was read.
	 * @returns The same cart, without `tokenHash`.
	 */
	private withoutTokenHash(cart: CommerceCart): CommerceCart {
		if (cart && 'tokenHash' in cart) {
			delete cart.tokenHash;
		}

		return cart;
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
	 * **The price is the pricing package's, never the caller's (R3-07b).** The price capability
	 * (`CART_PRICE_RESOLUTION`) prices the line for the cart's currency, channel, region and buyer and for
	 * the quantity the line will hold — a line that merges into an existing one is priced, with it, for the
	 * sum — and a `unitPrice`, `originalUnitPrice` or `isTaxInclusive` in the request is ignored. The cart
	 * does not invent a price: with no capability bound the addition is refused, and a variant the
	 * capability cannot price is refused. Only an in-process caller that resolved the price itself states it
	 * (`options.statedPrice`).
	 *
	 * @param cartId The cart.
	 * @param line The line to add.
	 * @param expectation The version the caller read the cart at.
	 * @param options Whether the in-process caller states a price it resolved itself.
	 * @returns The cart after the addition, re-priced.
	 */
	public async addLine(
		cartId: ID,
		line: DeepPartial<CommerceCartLine>,
		expectation: IVersionExpectation = ANY_VERSION,
		options: ICartLineWriteOptions = {}
	): Promise<CommerceCart> {
		const cart = await this.assertMutable(cartId);
		const stated = options.statedPrice === true;

		if (!line.variantId) {
			throw new BadRequestException('CART_LINE_VARIANT_REQUIRED: a line needs a variant.');
		}
		if (!line.quantity || line.quantity <= 0) {
			throw new BadRequestException('CART_LINE_QUANTITY_INVALID: a line quantity must be positive.');
		}
		if (stated && (line.unitPrice === undefined || line.unitPrice === null)) {
			throw new BadRequestException(
				'CART_LINE_PRICE_REQUIRED: the resolved unit price must be supplied by the price resolver.'
			);
		}

		// What the line names has to be the caller's tenant's (P0 #6c): refused before the stock of the variant and
		// location it names is read, and before the version moves.
		await this.lineService.assertReferences(line);

		const existing = (await this.lineService.findAll({ where: { cartId: cart.id } })) as IPagination<CommerceCartLine>;
		// A line the capability prices merges with the line of the same variant, location and plan whatever its
		// current price, and both are priced together for the sum: a quantity band applies to what the cart holds.
		const match = existing.items.find(
			(candidate: CommerceCartLine) =>
				candidate.variantId === line.variantId &&
				(candidate.warehouseId ?? null) === (line.warehouseId ?? null) &&
				(stated
					? Number(candidate.unitPrice) === Number(line.unitPrice) &&
					  candidate.isTaxInclusive === (line.isTaxInclusive ?? false)
					: this.priceSourceOf(candidate) !== 'STATED') &&
				(candidate.subscriptionPlanId ?? null) === (line.subscriptionPlanId ?? null)
		);
		const total = Number(line.quantity) + Number(match?.quantity ?? 0);
		const priced = stated ? null : await this.resolveLinePrice(cart, line.variantId as ID, total);
		// R3-07c: the line's tax category is the catalogue's, never the request's (the in-process caller that
		// states a price states the category it resolved with it).
		const taxCategoryId = stated
			? line.taxCategoryId
			: (await this.taxCategoriesOfVariants([line.variantId as ID])).get(String(line.variantId)) ?? null;

		// What the cart would hold after the addition, which is what has to be available: a line that
		// merges into an existing one asks for the sum of the two. The refusal happens here, where the
		// buyer can still change the quantity, rather than at checkout, where the reservation step of
		// the operation would fail on an order that was already being built.
		await this.assertStockAvailable({
			variantId: line.variantId,
			warehouseId: line.warehouseId,
			quantity: total
		});

		// The caller's version decides before a row is written, not after: an addition the cart is
		// going to refuse must not leave a line behind, for the same reason a removal it refuses must
		// not destroy one.
		await this.spendVersion(cart.id, expectation);

		if (match) {
			await this.lineService.update(match.id, {
				quantity: total,
				...(priced ? { ...this.pricedFields(priced, cart, match.metadata), taxCategoryId } : {})
			} as any);
		} else {
			await this.lineService.create({
				...line,
				cartId: cart.id,
				// A line belongs to its cart's organization (R2-G19).
				organizationId: line.organizationId ?? cart.organizationId,
				taxCategoryId,
				...(priced
					? this.pricedFields(priced, cart, line.metadata as Record<string, unknown>)
					: {
							unitPrice: this.toColumnAmount(line.unitPrice, cart),
							originalUnitPrice: this.toColumnAmount(line.originalUnitPrice ?? line.unitPrice, cart),
							isTaxInclusive: line.isTaxInclusive ?? false,
							metadata: {
								...((line.metadata as Record<string, unknown>) ?? {}),
								[LINE_PRICE_SOURCE]: 'STATED'
							}
					  }),
				isDiscountable: line.isDiscountable ?? true,
				requiresShipping: line.requiresShipping ?? true,
				position: line.position ?? existing.items.length
			} as DeepPartial<CommerceCartLine>);
		}

		return this.recalculate(cart.id, 'LINE_ADDED', ANY_VERSION);
	}

	/**
	 * Changes a line's quantity or note.
	 *
	 * **A line's price is not a field a caller changes (R3-07b).** `unitPrice`, `originalUnitPrice` and
	 * `isTaxInclusive` in the request are ignored, and a line the price capability priced is priced again for
	 * its new quantity — a quantity band follows the quantity. The line's price source is kept whatever the
	 * request's `metadata` says. Only an in-process caller that resolved the price itself states one
	 * (`options.statedPrice`).
	 *
	 * @param cartId The cart.
	 * @param lineId The line.
	 * @param changes The fields to change.
	 * @param expectation The version the caller read the cart at.
	 * @param options Whether the in-process caller states a price it resolved itself.
	 * @returns The cart after the change, re-priced.
	 */
	public async updateLine(
		cartId: ID,
		lineId: ID,
		changes: DeepPartial<CommerceCartLine>,
		expectation: IVersionExpectation = ANY_VERSION,
		options: ICartLineWriteOptions = {}
	): Promise<CommerceCart> {
		const cart = await this.assertMutable(cartId);
		const line = await this.assertLineBelongsToCart(cartId, lineId);
		const stated = options.statedPrice === true;

		if (changes.quantity !== undefined && Number(changes.quantity) <= 0) {
			throw new BadRequestException('CART_LINE_QUANTITY_INVALID: a line quantity must be positive.');
		}

		const editable = this.editableLineFields(changes, cart) as Record<string, unknown>;

		if (!stated) {
			delete editable['unitPrice'];
			delete editable['originalUnitPrice'];
			delete editable['isTaxInclusive'];
			// R3-07c: nor is its tax category, which is the catalogue's.
			delete editable['taxCategoryId'];

			// The source of the line's price is the line's, not the request's.
			if (editable['metadata'] !== undefined) {
				editable['metadata'] = {
					...((editable['metadata'] as Record<string, unknown>) ?? {}),
					[LINE_PRICE_SOURCE]: line.metadata?.[LINE_PRICE_SOURCE] ?? null
				};
			}

			if (changes.quantity !== undefined && this.priceSourceOf(line) !== 'STATED') {
				const priced = await this.resolveLinePrice(cart, line.variantId, Number(changes.quantity));

				Object.assign(
					editable,
					this.pricedFields(priced, cart, (editable['metadata'] as Record<string, unknown>) ?? line.metadata)
				);
			}
		}

		// A change pointing the line at another tenant's row is refused before any stock is read (P0 #6c).
		await this.lineService.assertReferences(editable);

		if (changes.quantity !== undefined) {
			await this.assertStockAvailable({
				variantId: line.variantId,
				warehouseId: changes.warehouseId ?? line.warehouseId,
				quantity: Number(changes.quantity)
			});
		}

		// The caller's version is spent before the child row is touched — see `spendVersion`.
		await this.spendVersion(cartId, expectation);
		await this.lineService.update(lineId, editable as DeepPartial<CommerceCartLine>);

		return this.recalculate(cartId, 'LINE_UPDATED', ANY_VERSION);
	}

	/**
	 * Removes a line.
	 *
	 * **The version is spent before the line is touched**, which is the whole of this method's
	 * ordering. It used to delete the row first and let `recalculate` evaluate the caller's version
	 * afterwards: two operators reading version 7, the first removing a line and taking the cart to 8,
	 * and the second was told `409 ENTITY_VERSION_CONFLICT` — "read it again and reapply your change" —
	 * about a line that had already been destroyed by the refusal itself. `CrudService.delete` is a
	 * hard delete and nothing rolled it back, so the write the caller was told did not happen had
	 * happened, irrecoverably, and the cart's cached totals still described a cart containing the line.
	 *
	 * @param cartId The cart.
	 * @param lineId The line.
	 * @param expectation The version the caller read the cart at.
	 * @returns The cart after the removal, re-priced.
	 */
	public async removeLine(cartId: ID, lineId: ID, expectation: IVersionExpectation = ANY_VERSION): Promise<CommerceCart> {
		await this.assertMutable(cartId);
		await this.assertLineBelongsToCart(cartId, lineId);

		await this.spendVersion(cartId, expectation);
		await this.lineService.softDelete(lineId);

		return this.recalculate(cartId, 'LINE_REMOVED', ANY_VERSION);
	}

	/**
	 * Sets the cart's delivery choice, replacing whatever was there.
	 *
	 * A cart holds at most one method per call to this method: setting a new one soft-deletes the
	 * previous rows so that `shippingSubtotal` is never the sum of a stale and a current choice.
	 *
	 * **The amount is the configured option's rate, never the caller's (R3-07c).** The caller names a
	 * shipping option; its name, its amount on this cart and how it is taxed come from the fulfilment package
	 * (`CART_SHIPPING_RATE`), and a `name`, `amount`, `isTaxInclusive`, `taxCategoryId` or `isManual` in the
	 * request is ignored. A choice with no option is refused (there is no operator override), as is one the
	 * capability cannot rate on this cart; with no capability bound every choice is refused.
	 *
	 * @param cartId The cart.
	 * @param method The chosen method: its `shippingOptionId`.
	 * @param expectation The version the caller read the cart at.
	 * @returns The cart after the choice, re-priced.
	 */
	public async setShippingMethod(
		cartId: ID,
		method: DeepPartial<CommerceCartShippingMethod>,
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<CommerceCart> {
		const cart = await this.assertMutable(cartId);

		const existing = (await this.shippingMethodService.findAll({
			where: { cartId }
		})) as IPagination<CommerceCartShippingMethod>;

		// A choice naming another tenant's option is refused here, before the previous choice is retired (P0 #6c).
		await this.shippingMethodService.assertReferences(method);

		const rated = await this.resolveShippingRate(cart, method.shippingOptionId as ID);

		// The caller's version decides before any row is replaced: the docstring above promises the
		// previous choice is replaced by this one, not that it is destroyed by a request the cart then
		// refuses.
		await this.spendVersion(cartId, expectation);

		for (const previous of existing.items) {
			// Soft, as this method's own docstring says: the row keeps its `deletedAt`, so the
			// `CART_SHIPPING` adjustments and tax lines that name it stay attributable and a reader can
			// still answer what delivery the buyer had chosen before.
			await this.shippingMethodService.softDelete(previous.id);
		}

		await this.shippingMethodService.create({
			...method,
			cartId,
			organizationId: method.organizationId ?? cart.organizationId,
			...this.ratedFields(rated, cart),
			isManual: false
		} as DeepPartial<CommerceCartShippingMethod>);

		return this.recalculate(cartId, 'SHIPPING_CHANGED', ANY_VERSION);
	}

	/**
	 * Applies a promotion to the cart as a snapshot row.
	 *
	 * **The discount is the promotion engine's, never the caller's (R3-07).** The caller names the
	 * promotion — its code, or its id for an automatic one — and the amount is what the engine grants
	 * on this cart, through `CART_PROMOTION_EVALUATION`. An `amount` in the request is ignored: this
	 * method used to record whatever amount it was handed, so `POST /carts/:id/promotions` and
	 * `applyCartPromotion` let a buyer state their own discount. With no engine bound the application
	 * is refused (`CART_PROMOTION_ENGINE_MISSING`) rather than falling back to the stated amount.
	 *
	 * The engine's answer is recorded and the cart re-priced, so removing a promotion later rebuilds the
	 * whole set from the ledger rather than unpicking one row.
	 *
	 * @param cartId The cart.
	 * @param promotion The promotion to apply: its `code` and/or `promotionId` (and `couponId`).
	 * @param expectation The version the caller read the cart at.
	 * @returns The cart after the application, re-priced.
	 */
	public async applyPromotion(
		cartId: ID,
		promotion: DeepPartial<CommerceCartPromotion>,
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<CommerceCart> {
		const cart = await this.assertMutable(cartId);

		// A promotion or coupon of another tenant is refused before anything is evaluated or the version
		// moves (P0 #6c).
		await this.promotionService.assertReferences(promotion);

		const { granted, amount, answerFor } = await this.grantedPromotion(cart, promotion);

		const existing = (await this.promotionService.findAll({
			where: { cartId }
		})) as IPagination<CommerceCartPromotion>;

		const duplicate = existing.items.find(
			(candidate: CommerceCartPromotion) =>
				(granted.promotionId && candidate.promotionId === granted.promotionId) ||
				(granted.code && candidate.code === granted.code)
		);

		await this.spendVersion(cartId, expectation);

		// Every promotion already on the cart takes the engine's answer for the whole set (R3-07): the set was
		// evaluated together, so a promotion the new one excludes - an exclusive member of its stacking group,
		// or one left nothing to discount - is retired rather than kept beside it, and one whose share moved
		// is recorded at its new amount. Keeping only the new grant would let two exclusive discounts stack.
		for (const row of existing.items) {
			if (duplicate && row.id === duplicate.id) {
				continue;
			}

			const answer = answerFor(row.promotionId, row.code);

			if (!answer) {
				await this.promotionService.softDelete(row.id);
				continue;
			}

			const recorded = this.toColumnAmount(answer, cart);

			if (Number(row.amount) !== recorded) {
				await this.promotionService.update(row.id, { amount: recorded } as any);
			}
		}

		if (duplicate) {
			await this.promotionService.update(duplicate.id, {
				amount: this.toColumnAmount(amount, cart)
			} as any);
		} else {
			await this.promotionService.create({
				...promotion,
				cartId,
				organizationId: promotion.organizationId ?? cart.organizationId,
				// The identity and the amount are the engine's: the row records what was granted, under
				// the promotion that granted it, whatever the request said about either.
				promotionId: granted.promotionId,
				code: granted.code ?? promotion.code,
				amount: this.toColumnAmount(amount, cart),
				isAutomatic: granted.isAutomatic ?? false,
				appliedAt: new Date()
			} as DeepPartial<CommerceCartPromotion>);
		}

		// The recalculation rebuilds the `adjustment` ledger from these snapshot rows before it totals
		// anything, which is what turns an applied promotion into a discount the buyer is actually
		// given — see `syncPromotionAdjustments`.
		return this.recalculate(cartId, 'PROMOTION_CHANGED', ANY_VERSION);
	}

	/**
	 * Removes an applied promotion.
	 *
	 * @param cartId The cart.
	 * @param code The code, or the promotion's id, of the promotion to remove.
	 * @param expectation The version the caller read the cart at.
	 * @returns The cart after the removal, re-priced.
	 */
	public async removePromotion(cartId: ID, code: string, expectation: IVersionExpectation = ANY_VERSION): Promise<CommerceCart> {
		await this.assertMutable(cartId);

		const existing = (await this.promotionService.findAll({
			where: { cartId }
		})) as IPagination<CommerceCartPromotion>;

		await this.spendVersion(cartId, expectation);

		for (const applied of existing.items) {
			if (applied.code === code || applied.promotionId === code) {
				await this.promotionService.softDelete(applied.id);
			}
		}

		// The recalculation rebuilds the ledger from whatever promotion rows survive, so the removed
		// promotion's adjustments go with it and the discount total really does fall back.
		return this.recalculate(cartId, 'PROMOTION_REMOVED', ANY_VERSION);
	}

	/**
	 * Recomputes the cart's totals from its lines, its shipping methods and the core money ledgers.
	 *
	 * This is the only writer of the total columns. It bumps the cart's version, touches its activity
	 * stamp and refreshes its expiry, so a caller that reads the cart afterwards sees one consistent
	 * state rather than a partially updated one.
	 *
	 * The version is written by the conditional update rather than carried in the patch, which is what
	 * makes the totals and the version they belong to one statement: a cart that moved on while the
	 * totals were being computed from its lines is refused instead of being given totals computed from
	 * rows that no longer describe it.
	 *
	 * @param cartId The cart.
	 * @param reason The reason code, recorded for diagnostics.
	 * @param expectation The version the caller read the cart at.
	 * @returns The cart with its recomputed totals.
	 */
	public async recalculate(
		cartId: ID,
		reason: string,
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<CommerceCart> {
		const cart = await this.findOneByIdString(cartId);

		if (!cart) {
			throw new NotFoundException(`CART_NOT_FOUND: no cart exists with id ${cartId}.`);
		}

		// The two ledgers are rebuilt before they are read. A promotion the buyer applied is a row in
		// `commerce_cart_promotion`, and it was *only* that row: nothing wrote the matching `adjustment`,
		// so the cart came back with `discountTotal = 0` and the buyer paid the undiscounted price while
		// the promotion sat there in the response. Tax had the same shape of hole — no cart operation
		// ever produced a tax line — so `taxTotal` was structurally zero. Both are derived here, from
		// the rows that describe what the cart is now, rather than appended at the moment of a mutation:
		// a discount is allocated across the lines it applies to, and the lines move.
		await this.syncPromotionAdjustments(cart);
		await this.syncTaxLines(cart);

		const snapshot = await this.computeTotals(cart);
		const now = new Date();

		await commitVersionedUpdate<CommerceCart>(this, {
			id: cart.id,
			expectation,
			where: this.writeScope,
			patch: {
				itemSubtotal: snapshot.itemSubtotal,
				itemDiscountTotal: snapshot.itemDiscountTotal,
				itemTaxTotal: snapshot.itemTaxTotal,
				shippingSubtotal: snapshot.shippingSubtotal,
				shippingDiscountTotal: snapshot.shippingDiscountTotal,
				shippingTaxTotal: snapshot.shippingTaxTotal,
				discountTotal: snapshot.discountTotal,
				taxTotal: snapshot.taxTotal,
				grandTotal: snapshot.grandTotal,
				lastActivityAt: now,
				expiresAt: this.expiryOf(cart, now),
				metadata: { ...(cart.metadata ?? {}), lastRecalculationReason: reason }
			}
		});

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

		// Step 10 — `STOCK`. It is the one step this package cannot answer from its own rows: what is
		// on hand belongs to the inventory capability, which is reached through the optional port.
		const stock = await this.stockStep(cart);

		steps.push({ step: 'STOCK', status: stock.status });
		errors.push(...stock.errors);

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
	 * A cart that already became an order is refused before the ladder runs, with `CART_ALREADY_COMPLETED`
	 * rather than the `CART_STATUS_INVALID` a completed cart would otherwise collect: the ladder answers
	 * "this status cannot complete", while the caller needs to hear that the completion it is asking for
	 * has already happened and where the order it produced is.
	 *
	 * The handler is what makes this legal across the package boundary — the cart never imports the
	 * order package. An installation without a handler gets a loud failure rather than a cart that
	 * silently never becomes an order.
	 *
	 * **The cart is claimed before the order exists (R3-10).** The first write this call makes is the
	 * claim (`claimForCheckout`): one conditional update predicated on the version that was validated, a
	 * completable status and `orderId IS NULL`. Of two concurrent completions only one claim lands, so
	 * only one reaches the handler; the other is refused with `CART_CHECKOUT_IN_PROGRESS` (or
	 * `CART_ALREADY_COMPLETED` once the order is recorded). A handler that fails releases the claim.
	 * The order package's unique index on `order.cartId` is the database's own backstop behind this.
	 *
	 * @param cartId The cart.
	 * @param options The checkout request.
	 * @param expectation The version the caller read the cart at. It is spent by the first write this
	 * call makes to the cart — the claim that precedes the order — because the cart's revision moves
	 * with that write and the revision the caller stated no longer exists afterwards.
	 * @returns The placed order's identity and the cart it came from.
	 */
	public async complete(
		cartId: ID,
		options: { idempotencyKey?: string; paymentSessionId?: string } = {},
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<{ cart: CommerceCart; orderId: string; orderNumber: string }> {
		const existing = await this.findOneWithContent(cartId);

		// A cart that already became an order is refused with the code that names what happened, and
		// not with the ladder's generic status refusal: the caller's next move is to read the order the
		// cart points at, which the code and the id tell it how to do (doc 06, 409).
		if (existing.orderId) {
			throw this.alreadyCompleted(cartId, existing.orderId);
		}

		// Another completion holds the cart and is placing its order right now.
		if (this.holdsLiveCheckoutClaim(existing)) {
			throw this.checkoutInProgress(cartId);
		}

		const verdict = await this.validate(cartId, CommerceCartValidationMode.STRICT);

		if (!verdict.valid) {
			throw new BadRequestException({
				message: 'The cart cannot be completed.',
				code: verdict.errors[0]?.code ?? 'CART_NOT_COMPLETABLE',
				details: { errors: verdict.errors, steps: verdict.steps }
			});
		}

		const handler = cartCheckoutRegistry.resolve();

		// Resolved before the claim, so an installation without a handler refuses without ever holding
		// the cart.
		if (!handler) {
			throw new ServiceUnavailableException(
				'CHECKOUT_HANDLER_MISSING: no package has registered a checkout handler for this installation.'
			);
		}

		const claimId = randomUUID();

		await this.claimForCheckout(existing, claimId, expectation);

		let cart: CommerceCart;
		let result: { orderId: string; orderNumber: string };

		try {
			// R3-07b: every line the price capability priced is priced again now, so the order is built from
			// today's price and never from one a line was given before the rule (or before the price changed).
			await this.priceForCheckout(existing);

			// The caller's version was spent by the claim; the recomputation rides on the version the
			// claim produced, and the claim keeps every other writer off the cart meanwhile.
			cart = await this.recalculate(cartId, 'CHECKOUT_VALIDATION', ANY_VERSION);
			result = await handler.complete({
				cart,
				idempotencyKey: options.idempotencyKey,
				paymentSessionId: options.paymentSessionId
			});
		} catch (error) {
			await this.releaseCheckoutClaim(cartId, claimId);

			throw error;
		}

		const completedAt = new Date();

		await commitVersionedUpdate<CommerceCart>(this, {
			id: cart.id,
			// The caller's version was spent by the claim above; this write rides on the version the
			// recomputation produced. `orderId IS NULL` is what makes the order recorded exactly once, and the
			// claim id is what keeps a checkout that outlived its claim from recording over the one that took
			// the cart over (it is refused, and the next completion is answered with its order — the order
			// package's checkout handler returns a cart's placed order rather than placing a second one).
			expectation: ANY_VERSION,
			where: { ...this.writeScope, orderId: IsNull(), checkoutClaimId: claimId },
			patch: {
				status: CommerceCartStatus.COMPLETED,
				orderId: result.orderId,
				completedAt,
				lastActivityAt: completedAt,
				checkoutClaimId: null,
				checkoutClaimedAt: null,
				metadata: {
					...(cart.metadata ?? {}),
					checkoutStartedAt: null,
					checkoutOperationId: null,
					checkoutCompletedAt: completedAt.toISOString()
				}
			}
		});

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
	 * @param expectation The version the caller read the cart at.
	 * @returns The abandoned cart.
	 */
	public async abandon(cartId: ID, expectation: IVersionExpectation = ANY_VERSION): Promise<CommerceCart> {
		const cart = await this.findOneByIdString(cartId);

		if (!cart) {
			throw new NotFoundException(`CART_NOT_FOUND: no cart exists with id ${cartId}.`);
		}

		if (cart.status === CommerceCartStatus.COMPLETED || cart.status === CommerceCartStatus.MERGED) {
			throw new BadRequestException(`CART_STATUS_INVALID: a ${cart.status} cart cannot be abandoned.`);
		}

		await commitVersionedUpdate<CommerceCart>(this, {
			id: cart.id,
			expectation,
			where: this.writeScope,
			patch: { status: CommerceCartStatus.ABANDONED, abandonedAt: new Date() }
		});

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
	 * @param expectation The version the caller read the surviving cart at.
	 * @returns The target cart, re-priced.
	 */
	public async merge(
		targetCartId: ID,
		sourceCartId: ID,
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<CommerceCart> {
		if (targetCartId === sourceCartId) {
			throw new BadRequestException('CART_MERGE_INVALID: a cart cannot be merged into itself.');
		}

		await this.assertMutable(targetCartId);
		// **With its content.** `assertMutable` reads the row and nothing else, so `target.shippingMethods`
		// was always `undefined` and the guard below — "copy the source's delivery choice only when the
		// target has none" — read `(undefined ?? []).length === 0`, which is true for every cart that has
		// ever existed. A buyer signing in with an anonymous cart therefore had the delivery choice on
		// their saved cart replaced by the anonymous one on every merge, which is the exact opposite of
		// the rule this method's own docstring states.
		const target = await this.findOneWithContent(targetCartId);
		const source = await this.findOneWithContent(sourceCartId);

		if (!source || source.status === CommerceCartStatus.COMPLETED || source.status === CommerceCartStatus.MERGED) {
			throw new BadRequestException(`CART_MERGE_INVALID: a ${source?.status ?? 'missing'} cart cannot be merged.`);
		}

		// A source a checkout is turning into an order is not merged away underneath it (R3-10): the buyer would
		// get the order and the same lines again in the surviving cart.
		if (this.holdsLiveCheckoutClaim(source)) {
			throw this.checkoutInProgress(source.id);
		}

		// The caller's version is spent by the first write this merge makes to the surviving cart: every
		// statement after it rides on the version that write produced, because the revision the caller
		// stated stops existing the moment the merge begins changing the row it named.
		let pending = expectation;
		const spend = (): IVersionExpectation => {
			const current = pending;

			pending = ANY_VERSION;

			return current;
		};

		const lines = (source.lines ?? []).map(
			(line) =>
				({
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
				}) as DeepPartial<CommerceCartLine>
		);
		// R3-07c: a delivery choice is carried over only when it names a configured option, which the surviving
		// cart rates again; a choice from before the rule, with no option, is left behind for the buyer to make.
		const sourceMethod =
			(target.shippingMethods ?? []).length === 0
				? (source.shippingMethods ?? []).find((candidate) => Boolean(candidate.shippingOptionId))
				: undefined;
		const method = sourceMethod
			? ({
					shippingOptionId: sourceMethod.shippingOptionId,
					name: sourceMethod.name,
					amount: sourceMethod.amount,
					isTaxInclusive: sourceMethod.isTaxInclusive,
					taxCategoryId: sourceMethod.taxCategoryId,
					data: sourceMethod.data,
					isManual: sourceMethod.isManual
				} as DeepPartial<CommerceCartShippingMethod>)
			: undefined;

		// Everything the merge copies is held to the caller's tenant before its first write (P0 #6c). Each verb below
		// checks what it writes as well, but one at a time: a source cart written before the check existed can name
		// another tenant's row on its second line or on its delivery choice, and a refusal there would leave the
		// target with the lines already copied and its version spent — and a retry would copy them again.
		await this.lineService.assertReferences(lines);

		if (method) {
			await this.shippingMethodService.assertReferences(method);
		}

		// R3-07b: every copied line is priced for the surviving cart before the first one is written, so a line
		// the capability cannot price there refuses the merge with the target untouched — rather than after the
		// lines before it were copied, which a retry would copy again.
		await this.assertLinesPriceable(target, lines);

		if (method) {
			// Rated against what the surviving cart will hold once the lines are copied — its own shippable items
			// and the source's — which is what `setShippingMethod` rates it against below.
			await this.resolveShippingRate(target, method.shippingOptionId as ID, {
				extraItemCount: lines
					.filter((line) => line.requiresShipping !== false)
					.reduce((count, line) => count + Number(line.quantity ?? 0), 0),
				extraOrderTotal: Number(source.itemSubtotal ?? 0)
			});
		}

		for (const line of lines) {
			await this.addLine(target.id, line, spend());
		}

		if (method) {
			await this.setShippingMethod(target.id, method, spend());
		}

		const mergedAt = new Date();

		// The source is a different row from the one the caller conditioned on, so this write is
		// predicated on the version the source holds rather than on the target's.
		await commitVersionedUpdate<CommerceCart>(this, {
			id: source.id,
			expectation: ANY_VERSION,
			where: this.writeScope,
			patch: {
				status: CommerceCartStatus.MERGED,
				metadata: { ...(source.metadata ?? {}), mergedIntoCartId: target.id, mergedAt: mergedAt.toISOString() }
			}
		});

		// The source keeps no lines: its rows are soft-deleted so that the totals of a merged cart and
		// the promise that it is empty agree. Soft, and not the hard `delete` this used to call — the
		// docstring promised one and the code did the other, which destroyed the audit trail the
		// `mergedIntoCartId` metadata written above exists to point at.
		for (const line of source.lines ?? []) {
			await this.lineService.softDelete(line.id);
		}

		const recalculated = await this.recalculate(target.id, 'CART_MERGED', spend());

		await commitVersionedUpdate<CommerceCart>(this, {
			id: recalculated.id,
			expectation: ANY_VERSION,
			where: this.writeScope,
			patch: {
				metadata: {
					...(recalculated.metadata ?? {}),
					mergedFromCartIds: [
						...((recalculated.metadata?.mergedFromCartIds as string[]) ?? []),
						source.id
					]
				}
			}
		});

		return this.findOneByIdString(target.id);
	}

	/**
	 * Expires every cart past its expiry instant.
	 *
	 * **Three things were wrong with the scan and all three were about which rows it read.** It
	 * selected `ACTIVE` only, while an `ABANDONED` cart is still mutable (`assertMutable` admits it) and
	 * still carries an `expiresAt` that every recalculation refreshes — so an abandoned cart could never
	 * reach `EXPIRED` at all. It compared `expiresAt` in the application, so the predicate the database
	 * could have evaluated was evaluated on rows it had already shipped. And it took no bound, so a
	 * tenant with two hundred thousand live carts materialised all of them to expire at most five
	 * hundred. The bound is now the query's, and the loop's `break` is the safety net it was meant to be
	 * rather than the only limit.
	 *
	 * @param limit The maximum number of carts to process in one run.
	 * @returns The ids of the carts that were expired.
	 */
	public async expireDueCarts(limit = 500): Promise<ID[]> {
		const due = (await this.findAll({
			where: {
				status: In([CommerceCartStatus.ACTIVE, CommerceCartStatus.ABANDONED]),
				expiresAt: LessThanOrEqual(new Date())
			},
			order: { expiresAt: 'ASC' },
			take: limit
		} as never)) as IPagination<CommerceCart>;
		const now = Date.now();
		const expired: ID[] = [];

		for (const cart of due.items) {
			if (expired.length >= limit) {
				break;
			}

			// A cart a checkout holds is being turned into an order right now (R3-10); the checkout's own last
			// write decides what it becomes, and the next sweep expires it if the checkout let it go.
			if (this.holdsLiveCheckoutClaim(cart)) {
				continue;
			}

			if (cart.expiresAt && new Date(cart.expiresAt).getTime() <= now) {
				// The pass runs on a schedule and has no caller to condition its write, so the write is
				// predicated on the version the row holds; a cart a buyer touched since the scan began is
				// therefore refused rather than expired underneath them.
				await commitVersionedUpdate<CommerceCart>(this, {
					id: cart.id,
					expectation: ANY_VERSION,
					where: this.writeScope,
					patch: { status: CommerceCartStatus.EXPIRED }
				});
				expired.push(cart.id);
			}
		}

		return expired;
	}

	/**
	 * Marks as abandoned every active cart nobody has touched for longer than the configured window.
	 *
	 * `cart.abandonedAfterHours` is declared in `CART_SETTING_CONTRIBUTIONS` — "how long a cart may sit
	 * untouched before it is treated as abandoned" — and was read by nothing at all, so no cart was ever
	 * abandoned automatically and the abandoned-cart audience that setting describes never existed. It
	 * is a status change and not a deletion: the cart and its lines stay readable, which is what lets a
	 * buyer come back to it, and an abandoned cart is still expired by the sweep above once its own TTL
	 * runs out.
	 *
	 * @param hours How long a cart may sit untouched; the setting's documented default when omitted.
	 * @param limit The maximum number of carts to process in one run.
	 * @returns The ids of the carts that were abandoned.
	 */
	public async abandonDueCarts(hours = DEFAULT_ABANDON_AFTER_HOURS, limit = 500): Promise<ID[]> {
		const cutoff = new Date(Date.now() - Math.max(1, hours) * 60 * 60 * 1000);
		const due = (await this.findAll({
			where: {
				status: CommerceCartStatus.ACTIVE,
				lastActivityAt: LessThanOrEqual(cutoff)
			},
			order: { lastActivityAt: 'ASC' },
			take: limit
		} as never)) as IPagination<CommerceCart>;
		const abandoned: ID[] = [];

		for (const cart of due.items) {
			if (abandoned.length >= limit) {
				break;
			}

			await commitVersionedUpdate<CommerceCart>(this, {
				id: cart.id,
				expectation: ANY_VERSION,
				where: this.writeScope,
				patch: { status: CommerceCartStatus.ABANDONED, abandonedAt: new Date() }
			});
			abandoned.push(cart.id);
		}

		return abandoned;
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

		// **The four lookups per owner are independent, so they are not serialised.** Each one is keyed
		// by nothing but the owner's id; a fifty-line cart with three delivery options used to spend a
		// hundred and six sequential round trips here, on every add-line, remove-line, apply-coupon and
		// set-shipping call, because the reads sat inside the `for` bodies that consume them. The loop
		// bodies below are unchanged — they read from what was fetched rather than fetching.
		const [lineLedgers, shippingLedgers, documentAdjustmentRows] = await Promise.all([
			Promise.all(
				lines.map(async (line) => ({
					id: line.id,
					adjustments: await this.adjustmentService.findByOwner(AdjustmentOwnerType.CART_LINE, line.id),
					taxLines: await this.taxLineService.findByOwner(TaxLineOwnerType.CART_LINE, line.id)
				}))
			),
			Promise.all(
				shippingMethods.map(async (method) => ({
					id: method.id,
					adjustments: await this.adjustmentService.findByOwner(
						AdjustmentOwnerType.CART_SHIPPING,
						method.id
					),
					taxLines: await this.taxLineService.findByOwner(TaxLineOwnerType.CART_SHIPPING, method.id)
				}))
			),
			// The cart-level ledger: `AdjustmentOwnerType.CART` is documented as "an order-level
			// discount, a fee, a rounding correction", and until the chain was given a document leg
			// every one of those rows was written and then read by nothing.
			this.adjustmentService.findByOwner(AdjustmentOwnerType.CART, cart.id)
		]);

		for (const ledger of lineLedgers) {
			for (const adjustment of ledger.adjustments) {
				lineAdjustments.push({
					ownerId: ledger.id,
					amount: Number(adjustment.amount),
					isTaxInclusive: Boolean(adjustment.isTaxInclusive),
					netAmount: this.netAmountOf(adjustment.metadata)
				});
			}

			for (const taxLine of ledger.taxLines) {
				lineTaxLines.push({ ownerId: ledger.id, amount: Number(taxLine.amount) });
			}
		}

		for (const ledger of shippingLedgers) {
			for (const adjustment of ledger.adjustments) {
				shippingAdjustments.push({
					ownerId: ledger.id,
					amount: Number(adjustment.amount),
					isTaxInclusive: Boolean(adjustment.isTaxInclusive),
					netAmount: this.netAmountOf(adjustment.metadata)
				});
			}

			for (const taxLine of ledger.taxLines) {
				shippingTaxLines.push({ ownerId: ledger.id, amount: Number(taxLine.amount) });
			}
		}

		const documentAdjustments: ITotalsAdjustment[] = documentAdjustmentRows.map((adjustment) => ({
			ownerId: cart.id,
			amount: Number(adjustment.amount),
			isTaxInclusive: Boolean(adjustment.isTaxInclusive),
			netAmount: this.netAmountOf(adjustment.metadata)
		}));

		const context: ITotalsContext = {
			currency: cart.currency,
			currencyDecimals: cart.currencyDecimals ?? this.decimalsOf(cart.currency as CurrencyCode),
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
			documentAdjustments,
			lineTaxLines,
			shippingTaxLines
		};

		return TotalsCalculator.compute(context);
	}

	/**
	 * The `STOCK` step of the ladder: what is on hand for every line.
	 *
	 * What may be sold belongs to the inventory capability, so it is asked for through the optional
	 * `CART_STOCK_AVAILABILITY` port rather than read from a stock table. With no capability registered
	 * the step is reported as `SKIPPED` and the cart validates exactly as it did before the step
	 * existed — an installation that runs this package without the inventory package still sells — and
	 * the availability is then decided by the checkout operation's own `reserve-stock` step, which
	 * fails the reservation rather than a cart that could never have been filled.
	 *
	 * @param cart The cart.
	 * @returns The verdict of the step and the errors it found, one per line that cannot be served.
	 */
	private async stockStep(
		cart: CommerceCart
	): Promise<{ status: 'PASSED' | 'FAILED' | 'SKIPPED'; errors: IStockRefusal[] }> {
		if (!this.stockAvailability) {
			return { status: 'SKIPPED', errors: [] };
		}

		const errors: IStockRefusal[] = [];

		for (const line of cart.lines ?? []) {
			const refusal = await this.stockRefusalOf(line);

			if (refusal) {
				errors.push(refusal);
			}
		}

		return { status: errors.length === 0 ? 'PASSED' : 'FAILED', errors };
	}

	/**
	 * Measures one line against the ladder's rule: `sellableQuantity + (allowBackorder ? backorderLimit
	 * : 0) >= quantity` (doc 10 §2.5 step 10).
	 *
	 * A line asking for more than is on hand is `CART_BACKORDER_LIMIT_EXCEEDED` where the location takes
	 * backorders — the limit is the bound it broke — and `CART_INSUFFICIENT_STOCK` where it does not.
	 *
	 * @param line The line.
	 * @returns The refusal, or null when the line can be served.
	 */
	private async stockRefusalOf(
		line: Pick<CommerceCartLine, 'variantId' | 'warehouseId' | 'quantity'>
	): Promise<IStockRefusal | null> {
		const quantity = Number(line.quantity);

		if (!this.stockAvailability || quantity <= 0) {
			return null;
		}

		const availability = await this.stockAvailability.availabilityOf({
			variantId: line.variantId,
			warehouseId: line.warehouseId
		});

		// A variant the capability does not stock at the line's location has nothing to sell, which is
		// the same answer as zero on hand for the purpose of this rule.
		const sellable = Number(availability?.sellableQuantity ?? 0);
		const backorderLimit = availability?.allowBackorder ? Number(availability.backorderLimit ?? 0) : 0;

		if (sellable + backorderLimit >= quantity) {
			return null;
		}

		const details = {
			variantId: line.variantId,
			warehouseId: line.warehouseId,
			requestedQuantity: quantity,
			sellableQuantity: sellable,
			backorderLimit
		};

		return availability?.allowBackorder
			? {
					code: 'CART_BACKORDER_LIMIT_EXCEEDED',
					step: 'STOCK',
					message: `Only ${sellable} unit(s) can be sold from stock and the backorder limit of ${backorderLimit} does not cover ${quantity}.`,
					details
				}
			: {
					code: 'CART_INSUFFICIENT_STOCK',
					step: 'STOCK',
					message: `Only ${sellable} unit(s) of variant ${line.variantId} can be sold.`,
					details
				};
	}

	/**
	 * Refuses a quantity the stock capability cannot serve.
	 *
	 * @param line The variant, the location and the quantity the cart would hold.
	 * @throws BadRequestException with the ladder's own code for the step, so a refusal at the moment
	 * of writing reads the same as the same refusal found by `validate`.
	 */
	private async assertStockAvailable(
		line: Pick<CommerceCartLine, 'variantId' | 'warehouseId' | 'quantity'>
	): Promise<void> {
		const refusal = await this.stockRefusalOf(line);

		if (refusal) {
			throw new BadRequestException({
				message: refusal.message,
				code: refusal.code,
				details: { step: refusal.step, ...refusal.details }
			});
		}
	}

	/**
	 * Spends the caller's version on the cart before a child row of it is written.
	 *
	 * **This is a precondition, not a replacement for the conditional update.** The authority is still
	 * the predicated `UPDATE` inside `recalculate`; what this adds is that the predicate is evaluated
	 * *first*, so a request the cart is going to refuse refuses before it has destroyed a line, replaced
	 * a delivery choice or removed a promotion. The cart's own revision moves with this write — a child
	 * change is a change to the cart, and the buyer reading the cart afterwards has to see a new version
	 * whether the recalculation that follows changes a total or not — so the recalculation that follows
	 * rides on `ANY_VERSION`: the revision the caller stated has been spent and no longer exists.
	 *
	 * The child write and the recomputation are still two statements rather than one transaction. Making
	 * them one would mean threading an `EntityManager` through every child service and through both
	 * ORMs, and it would not close the window this method closes: the refusal now happens before the
	 * irreversible half, which is what the caller was promised.
	 *
	 * @param cartId The cart the caller conditioned its request on.
	 * @param expectation The version the caller read the cart at.
	 * @throws ApiException `ENTITY_VERSION_CONFLICT` when the cart moved on, before anything is written.
	 */
	private async spendVersion(cartId: ID, expectation: IVersionExpectation): Promise<void> {
		await commitVersionedUpdate<CommerceCart>(this, {
			id: cartId,
			expectation,
			where: this.writeScope,
			patch: { lastActivityAt: new Date() }
		});
	}

	/**
	 * The fields of a line a caller may change.
	 *
	 * A change set reaches `CrudService.update` and from there the ORM's update builder, which raises
	 * `EntityPropertyNotFoundError` for a member it cannot map to a column — so a GraphQL mutation that
	 * forwarded its whole input, routing members and all, failed every time with a 400 naming a property
	 * the caller never meant as a column. The REST surface escaped it only because its validation pipe
	 * whitelists against a DTO. Filtering here puts the same guarantee under both surfaces, and it is a
	 * whitelist rather than a blacklist so a member nobody anticipated cannot smuggle itself into a
	 * write either.
	 *
	 * @param changes What the caller asked to change.
	 * @param cart The cart the line belongs to, whose currency the money members are normalised in.
	 * @returns The subset of it the line owns.
	 */
	private editableLineFields(
		changes: DeepPartial<CommerceCartLine>,
		cart: Pick<CommerceCart, 'currency' | 'currencyDecimals'>
	): DeepPartial<CommerceCartLine> {
		const editable: Array<keyof CommerceCartLine> = [
			'quantity',
			'unitPrice',
			'originalUnitPrice',
			'title',
			'sku',
			'thumbnail',
			'isTaxInclusive',
			'taxCategoryId',
			'isDiscountable',
			'requiresShipping',
			'weight',
			'position',
			'note',
			'warehouseId',
			'subscriptionPlanId',
			'metadata'
		];
		const money: Array<keyof CommerceCartLine> = ['unitPrice', 'originalUnitPrice'];
		const filtered: Record<string, unknown> = {};

		for (const field of editable) {
			if (changes[field] === undefined) {
				continue;
			}

			filtered[field as string] = money.includes(field)
				? this.toColumnAmount(changes[field], cart)
				: changes[field];
		}

		return filtered as DeepPartial<CommerceCartLine>;
	}

	/**
	 * @param currency The currency a document is priced in.
	 * @returns How many decimal places that currency carries.
	 */
	private decimalsOf(currency?: CurrencyCode): number {
		return currencyPrecision.decimalsFor(currency as CurrencyCode);
	}

	/**
	 * Normalises a money amount a caller stated into the form its column carries.
	 *
	 * The REST DTOs accept an exact decimal string as well as a number, because the GraphQL schema
	 * declares money as `Decimal` and the two surfaces have to mean the same thing by one field. The
	 * column is `numeric(20,6)` read through the platform's numeric transformer, so the value becomes a
	 * `number` exactly once, here, after the money layer has confirmed it is an amount that can be
	 * carried exactly. A value the money layer refuses is a 400 rather than a silently truncated price:
	 * `unitPrice: 1234567890.123456` used to pass `@IsNumber()` and be stored as `1234567890.1234560`,
	 * a different amount, with nothing reporting the loss.
	 *
	 * The amount is **not** rounded to the currency's scale. A unit price legitimately carries more
	 * digits than the currency does — a price per litre, a three-decimal dinar — and the rounding
	 * boundary is the totals chain's, not this one's.
	 *
	 * @param value The amount as the caller stated it.
	 * @param cart The cart it belongs to, which carries the currency.
	 * @returns The amount as the column carries it.
	 * @throws BadRequestException when the value is not an amount a money column can hold exactly.
	 */
	private toColumnAmount(value: unknown, cart: Pick<CommerceCart, 'currency' | 'currencyDecimals'>): number {
		if (value === undefined || value === null || value === '') {
			return 0;
		}

		const currency = cart.currency as CurrencyCode;
		const decimals = cart.currencyDecimals ?? this.decimalsOf(currency);

		try {
			return Number(Money.of(value as never, currency, decimals).toStorageString());
		} catch (error) {
			throw new BadRequestException(
				`CART_AMOUNT_INVALID: "${String(value)}" is not a money amount this platform can carry exactly ` +
					`(${error instanceof Error ? error.message : String(error)}).`
			);
		}
	}

	/**
	 * Rebuilds the `adjustment` rows that the cart's applied promotions represent.
	 *
	 * **Why a rebuild and not an append at the moment of application.** A promotion's discount is an
	 * amount against the cart, and it has to be attributed to the lines it applies to before the totals
	 * chain can read it — but the lines move: one is added, one is removed, a quantity changes, and an
	 * attribution computed when the promotion was applied no longer describes the cart it is attached
	 * to. The snapshot rows in `commerce_cart_promotion` are the record of *which* promotions apply and
	 * for how much; this derives the ledger that says *where* each of those amounts lands, from the cart
	 * as it is now. The entity's own docstring states the same rule: "the set of rows is rebuilt on
	 * every totals recalculation, never appended to blindly".
	 *
	 * The split across lines is `Money.allocateBy`, the largest-remainder allocation, so the parts sum
	 * back to the promotion's amount exactly — a 10.00 discount over three equal lines is 3.34/3.33/3.33
	 * and never 9.99.
	 *
	 * Only the rows this method wrote before are replaced. A row an operator entered by hand carries no
	 * `cartPromotionId` in its metadata and is left exactly where it is.
	 *
	 * @param cart The cart being recalculated.
	 */
	private async syncPromotionAdjustments(cart: CommerceCart): Promise<void> {
		const currency = cart.currency as CurrencyCode;
		const decimals = cart.currencyDecimals ?? this.decimalsOf(currency);
		const lines = ((await this.lineService.findAll({
			where: { cartId: cart.id }
		})) as IPagination<CommerceCartLine>).items;
		const promotions = ((await this.promotionService.findAll({
			where: { cartId: cart.id }
		})) as IPagination<CommerceCartPromotion>).items;

		// What the ledger should hold, per line, for every promotion on the cart.
		const desired = new Map<string, Money>();

		for (const promotion of promotions) {
			const amount = Money.fromStorage(promotion.amount, currency, decimals).abs();

			if (!amount.isPositive()) {
				continue;
			}

			// A promotion discounts the lines that accept a discount. A cart whose lines all refuse one
			// — or a cart with no lines at all — has nothing to attribute the amount to, and inventing an
			// owner for it would mean charging a discount to a line the catalogue excluded from
			// promotions: the promotion stays listed on the cart and moves no total, which is the honest
			// answer rather than a silent one.
			const targets = lines.filter((line) => line.isDiscountable !== false);

			if (!targets.length) {
				continue;
			}

			const weights = targets.map((line) =>
				Money.fromStorage(line.unitPrice, currency, decimals).multiply(Number(line.quantity ?? 0))
			);
			const parts = amount.allocateBy(weights);

			for (const [index, part] of parts.entries()) {
				if (!part.isPositive()) {
					continue;
				}

				const lineId = targets[index].id;
				desired.set(lineId, (desired.get(lineId) ?? Money.zero(currency, decimals)).add(part));
			}
		}

		// The rows currently owned by this rebuild, per line, read once per line rather than per
		// promotion.
		const owned = await Promise.all(
			lines.map(async (line) => ({
				lineId: line.id,
				rows: (await this.adjustmentService.findByOwner(AdjustmentOwnerType.CART_LINE, line.id)).filter(
					(row) => Boolean(row.metadata?.[CART_PROMOTION_ADJUSTMENT_KEY])
				)
			}))
		);

		for (const { lineId, rows } of owned) {
			const target = desired.get(lineId) ?? Money.zero(currency, decimals);
			const current = rows.reduce(
				(total, row) => total.add(Money.fromStorage(row.amount, currency, decimals).abs()),
				Money.zero(currency, decimals)
			);

			// The ledger already says what it should say, in the one row this rebuild writes. Rewriting
			// it would churn rows and move their `createdAt`, which is the order `findByOwner` reports
			// the ledger in.
			if (rows.length <= 1 && current.equals(target)) {
				desired.delete(lineId);
				continue;
			}

			for (const row of rows) {
				await this.adjustmentService.delete(row.id);
			}
		}

		for (const [lineId, amount] of desired.entries()) {
			if (!amount.isPositive()) {
				continue;
			}

			const line = lines.find((candidate) => candidate.id === lineId);

			await this.adjustmentService.append({
				ownerType: AdjustmentOwnerType.CART_LINE,
				ownerId: lineId,
				// Negative: the ledger's sign convention is that a row which reduces what the customer
				// pays is below zero, and `AdjustmentService` refuses a `PROMOTION` row that is not.
				amount: amount.negate().toStorageString(),
				currency,
				type: AdjustmentType.PROMOTION,
				isTaxInclusive: Boolean(line?.isTaxInclusive),
				description: 'Promotion applied to the cart',
				metadata: { [CART_PROMOTION_ADJUSTMENT_KEY]: cart.id }
			});
		}
	}

	/**
	 * Rebuilds the cart's rows in the platform's `tax_line` ledger.
	 *
	 * With no `CART_TAX_CALCULATION` provider registered this does nothing at all and the cart's tax
	 * totals stay zero, which is exactly how the package behaved before the port existed. With one
	 * registered, every line and every shipping method that the capability rates gets its breakdown
	 * written through `TaxLineService` — the platform's ledger, never a table of this package's own —
	 * and `computeTotals` reads it back on the next line of `recalculate`.
	 *
	 * The taxable base is the line's amount **after** the discounts the rebuild above just attributed to
	 * it, which is the rule the money specification states: tax is charged on what the customer actually
	 * pays for the line, not on what the catalogue asked for it.
	 *
	 * @param cart The cart being recalculated.
	 */
	private async syncTaxLines(cart: CommerceCart): Promise<void> {
		if (!this.taxCalculation) {
			return;
		}

		const currency = cart.currency as CurrencyCode;
		const decimals = cart.currencyDecimals ?? this.decimalsOf(currency);
		const lines = ((await this.lineService.findAll({
			where: { cartId: cart.id }
		})) as IPagination<CommerceCartLine>).items;
		const shippingMethods = ((await this.shippingMethodService.findAll({
			where: { cartId: cart.id }
		})) as IPagination<CommerceCartShippingMethod>).items;

		if (!lines.length && !shippingMethods.length) {
			return;
		}

		const address = (cart.shippingAddressSnapshot ?? cart.billingAddressSnapshot ?? {}) as Record<string, unknown>;
		const discounts = await this.discountByOwner(lines, shippingMethods, currency, decimals);
		const query = {
			currency,
			...(cart.regionId ? { regionId: cart.regionId } : {}),
			...(typeof address['countryCode'] === 'string' ? { countryCode: address['countryCode'] } : {}),
			...(typeof address['provinceCode'] === 'string' ? { provinceCode: address['provinceCode'] } : {}),
			...(typeof address['postalCode'] === 'string' ? { postalCode: address['postalCode'] } : {}),
			// A cart is re-priced on every edit and there is nobody to answer a refusal in the middle of
			// one, so a destination no rate matches is rated at zero rather than made uneditable.
			allowUntaxedCatalog: true,
			lines: [
				...lines.map((line) => ({
					referenceId: line.id,
					...(line.taxCategoryId ? { taxCategoryId: line.taxCategoryId } : {}),
					amount: this.taxableBaseOf(
						Money.fromStorage(line.unitPrice, currency, decimals).multiply(Number(line.quantity ?? 0)),
						discounts.get(`LINE:${line.id}`),
						currency,
						decimals
					),
					quantity: normalizeDecimalString(Number(line.quantity ?? 0))
				})),
				...shippingMethods.map((method) => ({
					referenceId: method.id,
					...(method.taxCategoryId ? { taxCategoryId: method.taxCategoryId } : {}),
					amount: this.taxableBaseOf(
						Money.fromStorage(method.amount, currency, decimals),
						discounts.get(`SHIPPING:${method.id}`),
						currency,
						decimals
					),
					quantity: '1'
				}))
			]
		};

		const calculation = await this.taxCalculation.calculate(query);
		const ownerOf = new Map<string, TaxLineOwnerType>([
			...lines.map((line): [string, TaxLineOwnerType] => [line.id, TaxLineOwnerType.CART_LINE]),
			...shippingMethods.map((method): [string, TaxLineOwnerType] => [
				method.id,
				TaxLineOwnerType.CART_SHIPPING
			])
		]);

		// A recomputed breakdown replaces the previous one whole: `TaxLineService.append` refuses a
		// second basis for a rate an owner already carries, and a half-rewritten breakdown reconciles
		// against nothing.
		for (const [ownerId, ownerType] of ownerOf.entries()) {
			for (const existing of await this.taxLineService.findByOwner(ownerType, ownerId)) {
				await this.taxLineService.delete(existing.id);
			}
		}

		for (const computed of calculation?.lines ?? []) {
			const ownerId = computed.referenceId;
			const ownerType = ownerId ? ownerOf.get(String(ownerId)) : undefined;

			if (!ownerId || !ownerType) {
				continue;
			}

			for (const draft of computed.taxLines ?? []) {
				await this.taxLineService.append({
					ownerType,
					ownerId,
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
			}
		}
	}

	/**
	 * The discount each taxable owner carries, read from the ledger the promotion rebuild just wrote.
	 *
	 * @param lines The cart's lines.
	 * @param shippingMethods The cart's shipping methods.
	 * @param currency The currency the cart is priced in.
	 * @param decimals The currency's scale.
	 * @returns The discount per owner key, as a positive magnitude.
	 */
	private async discountByOwner(
		lines: CommerceCartLine[],
		shippingMethods: CommerceCartShippingMethod[],
		currency: CurrencyCode,
		decimals: number
	): Promise<Map<string, Money>> {
		const discounts = new Map<string, Money>();
		const owners: Array<{ key: string; ownerType: AdjustmentOwnerType; ownerId: ID }> = [
			...lines.map((line) => ({
				key: `LINE:${line.id}`,
				ownerType: AdjustmentOwnerType.CART_LINE,
				ownerId: line.id
			})),
			...shippingMethods.map((method) => ({
				key: `SHIPPING:${method.id}`,
				ownerType: AdjustmentOwnerType.CART_SHIPPING,
				ownerId: method.id
			}))
		];

		const read = await Promise.all(
			owners.map(async (owner) => ({
				key: owner.key,
				rows: await this.adjustmentService.findByOwner(owner.ownerType, owner.ownerId)
			}))
		);

		for (const { key, rows } of read) {
			let discount = Money.zero(currency, decimals);

			for (const row of rows) {
				const amount = Money.fromStorage(row.amount, currency, decimals);

				if (amount.isNegative()) {
					discount = discount.add(amount.abs());
				}
			}

			discounts.set(key, discount);
		}

		return discounts;
	}

	/**
	 * @param gross What the owner is worth before the adjustment layer.
	 * @param discount What the ledger takes off it, when anything does.
	 * @param currency The currency.
	 * @param decimals The currency's scale.
	 * @returns The amount the owner is rated on, never below zero.
	 */
	private taxableBaseOf(gross: Money, discount: Money | undefined, currency: CurrencyCode, decimals: number): string {
		const rounded = gross.round(RoundingMode.HALF_UP, decimals);
		const discounted = discount?.isPositive() ? rounded.subtract(discount) : rounded;

		return (discounted.isNegative() ? Money.zero(currency, decimals) : discounted).toStorageString();
	}

	/**
	 * Asks the promotion engine what a promotion grants on this cart (R3-07).
	 *
	 * The engine is handed the cart as it is — its discountable lines at their unit price times their
	 * quantity, its delivery choices, its currency, channel and buyer — and **every code the cart already
	 * carries plus the one being applied**, so stacking, exclusivity and the remaining-discountable amount
	 * are judged on the whole set rather than on the new promotion alone. The application that names the
	 * requested promotion is the answer; nothing the request said about an amount is read.
	 *
	 * @param cart The cart.
	 * @param requested The promotion the caller named.
	 * @returns What the engine granted for it.
	 * @throws BadRequestException `CART_PROMOTION_REFERENCE_REQUIRED` when the request names no promotion,
	 * or `CART_PROMOTION_NOT_APPLICABLE` (with the engine's notices) when the engine grants it nothing.
	 * @throws ServiceUnavailableException `CART_PROMOTION_ENGINE_MISSING` when no engine is bound.
	 */
	private async grantedPromotion(
		cart: CommerceCart,
		requested: DeepPartial<CommerceCartPromotion>
	): Promise<{
		granted: ICartPromotionApplication;
		amount: string;
		answerFor: (promotionId?: ID, code?: string) => string | null;
	}> {
		const normalized = (value?: string | null): string => `${value ?? ''}`.trim().toUpperCase();
		const code = normalized(requested?.code as string) || undefined;
		const promotionId = requested?.promotionId ? String(requested.promotionId) : undefined;

		if (!code && !promotionId) {
			throw new BadRequestException({
				message:
					'CART_PROMOTION_REFERENCE_REQUIRED: name the promotion by its code or its id; the discount is computed by the promotion engine.',
				code: 'CART_PROMOTION_REFERENCE_REQUIRED'
			});
		}

		if (!this.promotionEvaluation) {
			throw new ServiceUnavailableException({
				message:
					'CART_PROMOTION_ENGINE_MISSING: no promotion engine is bound for this installation, and a cart never records a discount the caller stated.',
				code: 'CART_PROMOTION_ENGINE_MISSING'
			});
		}

		const currency = cart.currency as CurrencyCode;
		const decimals = cart.currencyDecimals ?? this.decimalsOf(currency);
		const lines = (
			(await this.lineService.findAll({ where: { cartId: cart.id } })) as IPagination<CommerceCartLine>
		).items.filter((line) => line.isDiscountable !== false && Number(line.quantity) > 0);
		const shipping = (
			(await this.shippingMethodService.findAll({
				where: { cartId: cart.id }
			})) as IPagination<CommerceCartShippingMethod>
		).items;
		const applied = (
			(await this.promotionService.findAll({ where: { cartId: cart.id } })) as IPagination<CommerceCartPromotion>
		).items;
		const codes = [...new Set([...applied.map((row) => normalized(row.code)), code].filter(Boolean))];

		const evaluation = await this.promotionEvaluation.evaluate({
			currency: cart.currency,
			channelId: cart.channelId,
			customerId: cart.customerId,
			codes,
			lines: lines.map((line) => ({
				id: line.id,
				amount: Money.fromStorage(line.unitPrice, currency, decimals)
					.multiply(Number(line.quantity))
					.toStorageString(),
				quantity: Number(line.quantity),
				variantId: line.variantId,
				sku: line.sku
			})),
			shipping: shipping.map((method) => ({
				id: method.id,
				amount: Money.fromStorage(method.amount, currency, decimals).toStorageString()
			}))
		});

		const applications = evaluation?.result?.applications ?? [];
		const allocations = evaluation?.allocations;
		const find = (id?: ID, stated?: string): ICartPromotionApplication | undefined =>
			id || stated
				? applications.find(
						(application) =>
							(!id || String(application.promotionId) === String(id)) &&
							(!stated || normalized(application.code) === normalized(stated))
				  )
				: undefined;
		/**
		 * What the cart records for one application: the part the engine allocated to the cart's lines.
		 * The cart attributes a promotion's amount across its lines (`syncPromotionAdjustments`), so a part the
		 * engine allocated to a delivery choice would be moved onto the items - reducing their tax base instead
		 * of shipping's. That part is not recorded until the cart applies delivery discounts (Q7). An engine
		 * that reports no allocations is taken at its application's amount.
		 */
		const lineAmountOf = (application: ICartPromotionApplication): string => {
			if (!Array.isArray(allocations)) {
				return application.amount;
			}

			return Money.sum(
				allocations
					.filter(
						(allocation) =>
							allocation.ownerType === 'LINE' &&
							String(allocation.promotionId) === String(application.promotionId)
					)
					.map((allocation) => Money.of(allocation.amount as never, currency, decimals).abs()),
				currency
			).toStorageString();
		};

		const granted = find(promotionId, code);
		const amount = granted ? lineAmountOf(granted) : '0';

		if (!granted || !(Number(amount) > 0)) {
			const notices = (evaluation?.result?.notices ?? []).filter(
				(notice) =>
					(promotionId && String(notice.promotionId) === promotionId) ||
					(code && normalized(notice.code) === code)
			);

			throw new BadRequestException({
				message: 'CART_PROMOTION_NOT_APPLICABLE: the promotion engine grants this cart nothing for that promotion.',
				code: 'CART_PROMOTION_NOT_APPLICABLE',
				details: {
					code: code ?? null,
					promotionId: promotionId ?? null,
					notices: granted
						? [
								...notices,
								{
									promotionId: granted.promotionId,
									code: granted.code ?? code ?? '',
									notice: 'SHIPPING_DISCOUNT_NOT_SUPPORTED',
									message:
										'The promotion discounts delivery only, and the cart does not yet apply delivery discounts.'
								}
						  ]
						: notices
				}
			});
		}

		return {
			granted,
			amount,
			answerFor: (id?: ID, stated?: string) => {
				// A row recorded under a promotion id is matched by it; a row recorded by code alone, by its code.
				const answer = find(id || undefined, id ? undefined : stated);

				if (!answer) {
					return null;
				}

				const share = lineAmountOf(answer);

				return Number(share) > 0 ? share : null;
			}
		};
	}

	/**
	 * Loads a cart that must be mutable, or refuses.
	 *
	 * @param cartId The cart.
	 * @returns The cart.
	 * @throws NotFoundException when no such cart exists.
	 * @throws BadRequestException when the cart is no longer mutable.
	 * @throws ConflictException when a checkout holds the cart while its order is being placed.
	 */
	private async assertMutable(cartId: ID): Promise<CommerceCart> {
		const cart = await this.findOneByIdString(cartId);

		if (!cart) {
			throw new NotFoundException(`CART_NOT_FOUND: no cart exists with id ${cartId}.`);
		}

		if (![CommerceCartStatus.ACTIVE, CommerceCartStatus.ABANDONED].includes(cart.status)) {
			throw new BadRequestException(`CART_STATUS_INVALID: a ${cart.status} cart is immutable.`);
		}

		// A cart a checkout has claimed is the one its order is being built from: a line added now would
		// be on the cart and not on the order, so the change waits until the checkout ends either way.
		if (this.holdsLiveCheckoutClaim(cart)) {
			throw this.checkoutInProgress(cart.id);
		}

		return cart;
	}

	/**
	 * Refuses a line that belongs to another cart, so a caller cannot edit across aggregates.
	 *
	 * @param cartId The cart.
	 * @param lineId The line.
	 * @returns The line.
	 */
	private async assertLineBelongsToCart(cartId: ID, lineId: ID): Promise<CommerceCartLine> {
		const line = await this.lineService.findOneByWhereOptions({ id: lineId } as FindOptionsWhere<CommerceCartLine>);

		if (!line || line.cartId !== cartId) {
			throw new NotFoundException(`CART_LINE_NOT_FOUND: cart ${cartId} has no line ${lineId}.`);
		}

		return line;
	}

	/**
	 * Asks the price capability what one unit of a variant costs on this cart, for a quantity (R3-07b).
	 *
	 * @param cart The cart: its currency, channel, region and buyer.
	 * @param variantId The variant.
	 * @param quantity The quantity the line will hold, which selects the quantity band.
	 * @returns The resolved price.
	 * @throws ServiceUnavailableException `CART_PRICE_ENGINE_MISSING` when no capability is bound.
	 * @throws BadRequestException `CART_LINE_PRICE_UNRESOLVED` when the capability has no price for it.
	 */
	private async resolveLinePrice(cart: CommerceCart, variantId: ID, quantity: number): Promise<ICartResolvedPrice> {
		if (!this.priceResolution) {
			throw new ServiceUnavailableException({
				message:
					'CART_PRICE_ENGINE_MISSING: no price capability is bound for this installation, and a cart line is never priced at what its caller stated.',
				code: 'CART_PRICE_ENGINE_MISSING'
			});
		}

		const prices = await this.priceResolution.resolvePrices({
			variantIds: [variantId],
			currency: cart.currency as CurrencyCode,
			quantity,
			channelId: cart.channelId,
			regionId: cart.regionId,
			customerId: cart.customerId
		});
		const price = (prices ?? []).find((candidate) => String(candidate.variantId) === String(variantId));

		// A price in another currency is not this cart's price: the capability's legacy fallback answers with the
		// variant's retail price in whatever currency it was entered in, and recording it would charge 100 JPY for
		// a 100 USD price. Nothing is converted here; a conversion is the pricing package's decision.
		const sameCurrency =
			!price?.currency || `${price.currency}`.toUpperCase() === `${cart.currency ?? ''}`.toUpperCase();

		if (!price || price.amount === undefined || price.amount === null || !sameCurrency) {
			throw new BadRequestException({
				message: `CART_LINE_PRICE_UNRESOLVED: variant ${variantId} has no price in ${cart.currency} for this cart.`,
				code: 'CART_LINE_PRICE_UNRESOLVED',
				details: {
					variantId,
					currency: cart.currency,
					quantity,
					...(price && !sameCurrency ? { priceCurrency: price.currency } : {})
				}
			});
		}

		return price;
	}

	/**
	 * The columns a resolved price writes onto a line, and the record of where it came from.
	 *
	 * @param price The resolved price.
	 * @param cart The cart, which carries the currency's scale.
	 * @param metadata The line's metadata the record is merged into.
	 * @returns The fields to write.
	 */
	private pricedFields(
		price: ICartResolvedPrice,
		cart: Pick<CommerceCart, 'currency' | 'currencyDecimals'>,
		metadata?: Record<string, unknown> | null
	): Record<string, unknown> {
		// The previous resolution's trace goes with the previous price: a price from no list must not keep the
		// list the last one came from.
		const kept: Record<string, unknown> = { ...(metadata ?? {}) };

		delete kept['priceId'];
		delete kept['priceListId'];

		return {
			unitPrice: this.toColumnAmount(price.amount, cart),
			originalUnitPrice: this.toColumnAmount(price.originalAmount ?? price.amount, cart),
			isTaxInclusive: price.taxInclusive === true,
			metadata: {
				...kept,
				[LINE_PRICE_SOURCE]: 'ENGINE',
				...(price.priceId ? { priceId: price.priceId } : {}),
				...(price.priceListId ? { priceListId: price.priceListId } : {})
			}
		};
	}

	/**
	 * Where a line's price came from: `ENGINE`, `STATED`, or nothing for a line that predates the rule.
	 *
	 * @param line The line.
	 * @returns The source.
	 */
	private priceSourceOf(line: Pick<CommerceCartLine, 'metadata'>): string | undefined {
		const source = line?.metadata?.[LINE_PRICE_SOURCE];

		return typeof source === 'string' ? source : undefined;
	}

	/**
	 * Refuses a set of lines the price capability cannot price on a cart, before any of them is written.
	 *
	 * Each line is resolved for the quantity it will hold on that cart — with the line it merges into, when
	 * there is one — which is the resolution `addLine` makes for it next.
	 *
	 * @param cart The cart the lines are about to be added to, with its lines.
	 * @param lines The lines.
	 */
	private async assertLinesPriceable(cart: CommerceCart, lines: DeepPartial<CommerceCartLine>[]): Promise<void> {
		for (const line of lines) {
			if (!line.variantId) {
				throw new BadRequestException('CART_LINE_VARIANT_REQUIRED: a line needs a variant.');
			}

			const into = (cart.lines ?? []).find(
				(candidate) =>
					candidate.variantId === line.variantId &&
					(candidate.warehouseId ?? null) === (line.warehouseId ?? null) &&
					(candidate.subscriptionPlanId ?? null) === (line.subscriptionPlanId ?? null) &&
					this.priceSourceOf(candidate) !== 'STATED'
			);

			const quantity = Number(line.quantity) + Number(into?.quantity ?? 0);

			await this.resolveLinePrice(cart, line.variantId as ID, quantity);
		}
	}

	/**
	 * Prices **every** line, and rates every delivery choice, again at checkout (R3-07b, R3-07c).
	 *
	 * Nothing a line carries is trusted at the moment it becomes an order: not its stored price, and not its
	 * `metadata.priceSource`, which a direct write to the line resource can set. The cart a buyer completes is
	 * therefore priced entirely by the capability, for each line's quantity — a line the capability priced, a
	 * line that predates the rule and a line marked stated alike. (The one cart built from stated prices, the
	 * subscription cycle's, never goes through checkout: it becomes its order directly.) A line whose price
	 * moved is rewritten; a line with no variant, or a variant the capability cannot price any more, refuses
	 * the checkout.
	 *
	 * @param cart The cart being checked out.
	 */
	private async priceForCheckout(cart: CommerceCart): Promise<void> {
		const lines = (
			(await this.lineService.findAll({ where: { cartId: cart.id } })) as IPagination<CommerceCartLine>
		).items;
		const methods = (
			(await this.shippingMethodService.findAll({
				where: { cartId: cart.id }
			})) as IPagination<CommerceCartShippingMethod>
		).items;
		const categories = await this.taxCategoriesOfVariants(
			lines.map((line) => line.variantId).filter(Boolean) as ID[]
		);

		// Every price and rate is resolved before anything is written: a line or a delivery choice that cannot
		// be priced refuses the checkout with the cart exactly as it was, rather than with some rows re-priced
		// under totals that were not.
		const repriced: Array<{ line: CommerceCartLine; fields: Record<string, unknown> }> = [];

		for (const line of lines) {
			if (!line.variantId) {
				throw new BadRequestException({
					message: `CART_LINE_PRICE_UNRESOLVED: line ${line.id} names no variant, so nothing can price it.`,
					code: 'CART_LINE_PRICE_UNRESOLVED',
					details: { lineId: line.id }
				});
			}

			const priced = await this.resolveLinePrice(cart, line.variantId, Number(line.quantity));

			repriced.push({
				line,
				fields: {
					...this.pricedFields(priced, cart, line.metadata),
					// R3-07c: the catalogue's category, whatever the line was written with.
					taxCategoryId: categories.get(String(line.variantId)) ?? null
				}
			});
		}

		const ratedChoices: Array<{ method: CommerceCartShippingMethod; fields: Record<string, unknown> }> = [];

		for (const method of methods) {
			ratedChoices.push({
				method,
				fields: this.ratedFields(await this.resolveShippingRate(cart, method.shippingOptionId), cart)
			});
		}

		for (const { line, fields } of repriced) {
			const trace = fields['metadata'] as Record<string, unknown>;

			// The resolution's trace counts as part of the price: an order copies it, and a price from another
			// list at the same amount is still another price.
			if (
				Number(line.unitPrice) !== fields['unitPrice'] ||
				Number(line.originalUnitPrice) !== fields['originalUnitPrice'] ||
				Boolean(line.isTaxInclusive) !== fields['isTaxInclusive'] ||
				(line.taxCategoryId ?? null) !== fields['taxCategoryId'] ||
				this.priceSourceOf(line) !== 'ENGINE' ||
				(line.metadata?.['priceId'] ?? null) !== (trace['priceId'] ?? null) ||
				(line.metadata?.['priceListId'] ?? null) !== (trace['priceListId'] ?? null)
			) {
				await this.lineService.update(line.id, fields as any);
			}
		}

		for (const { method, fields } of ratedChoices) {
			if (
				Number(method.amount) !== fields['amount'] ||
				method.name !== fields['name'] ||
				Boolean(method.isTaxInclusive) !== fields['isTaxInclusive'] ||
				(method.taxCategoryId ?? null) !== fields['taxCategoryId'] ||
				Boolean(method.isManual)
			) {
				await this.shippingMethodService.update(method.id, { ...fields, isManual: false } as any);
			}
		}
	}

	/**
	 * Rates a configured shipping option on a cart (R3-07c).
	 *
	 * @param cart The cart: its channel, region, currency and what it holds.
	 * @param optionId The option the delivery choice names.
	 * @param pending What the cart is about to hold besides its own lines, for a merge rated before it copies.
	 * @returns The option and what it costs on this cart.
	 * @throws BadRequestException `CART_SHIPPING_OPTION_REQUIRED` when no option is named,
	 * `CART_SHIPPING_OPTION_INELIGIBLE` when the option does not serve this cart, or `CART_SHIPPING_RATE_UNRESOLVED`
	 * when it cannot be rated here — an unknown option, a calculated rate no strategy prices, another currency.
	 * @throws ServiceUnavailableException `CART_SHIPPING_ENGINE_MISSING` when no capability is bound.
	 */
	private async resolveShippingRate(
		cart: CommerceCart,
		optionId: ID | undefined,
		pending: { extraItemCount?: number; extraOrderTotal?: number } = {}
	): Promise<{ option: ICartShippingOption; amount: number | string }> {
		if (!optionId) {
			throw new BadRequestException({
				message:
					'CART_SHIPPING_OPTION_REQUIRED: a delivery choice names a configured shipping option; its amount is that option\'s rate.',
				code: 'CART_SHIPPING_OPTION_REQUIRED'
			});
		}

		if (!this.shippingRate) {
			throw new ServiceUnavailableException({
				message:
					'CART_SHIPPING_ENGINE_MISSING: no delivery-rate capability is bound for this installation, and a delivery choice is never recorded at what its caller stated.',
				code: 'CART_SHIPPING_ENGINE_MISSING'
			});
		}

		const unresolved = (reason: string, details: Record<string, unknown> = {}) =>
			new BadRequestException({
				message: `CART_SHIPPING_RATE_UNRESOLVED: shipping option ${optionId} cannot be rated for this cart (${reason}).`,
				code: 'CART_SHIPPING_RATE_UNRESOLVED',
				details: { shippingOptionId: optionId, reason, ...details }
			});

		const option = await this.shippingRate.findOneByIdString(optionId).catch((error: unknown) => {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		});

		if (!option) {
			throw unresolved('SHIPPING_OPTION_NOT_FOUND');
		}

		const shippable = (
			(await this.lineService.findAll({ where: { cartId: cart.id } })) as IPagination<CommerceCartLine>
		).items.filter((line) => line.requiresShipping !== false);
		const rate = await this.shippingRate.calculate(optionId, {
			channelId: cart.channelId,
			regionId: cart.regionId,
			itemCount:
				shippable.reduce((count, line) => count + Number(line.quantity ?? 0), 0) +
				Number(pending.extraItemCount ?? 0),
			orderTotal: Number(cart.itemSubtotal ?? 0) + Number(pending.extraOrderTotal ?? 0)
		});

		if (!rate?.eligible) {
			throw new BadRequestException({
				message: `CART_SHIPPING_OPTION_INELIGIBLE: shipping option ${optionId} does not serve this cart.`,
				code: 'CART_SHIPPING_OPTION_INELIGIBLE',
				details: { shippingOptionId: optionId, reason: rate?.reason ?? null }
			});
		}

		// A calculated option is priced by a provider strategy, and nothing in this installation calls one yet:
		// its `0` is not a rate, and recording it would ship for free.
		if (rate.providerKey) {
			throw unresolved('CALCULATED_BY_STRATEGY', { providerKey: rate.providerKey });
		}

		if (
			Number(rate.amount) !== 0 &&
			rate.currency &&
			`${rate.currency}`.toUpperCase() !== `${cart.currency ?? ''}`.toUpperCase()
		) {
			throw unresolved('CURRENCY_MISMATCH', { rateCurrency: rate.currency });
		}

		return { option, amount: rate.amount };
	}

	/**
	 * The columns a rated option writes onto a delivery choice.
	 *
	 * @param rated The option and its rate.
	 * @param cart The cart, which carries the currency's scale.
	 * @returns The fields to write.
	 */
	private ratedFields(
		rated: { option: ICartShippingOption; amount: number | string },
		cart: Pick<CommerceCart, 'currency' | 'currencyDecimals'>
	): Record<string, unknown> {
		return {
			shippingOptionId: rated.option.id,
			name: rated.option.name,
			amount: this.toColumnAmount(rated.amount, cart),
			isTaxInclusive: rated.option.isTaxInclusive === true,
			taxCategoryId: rated.option.taxCategoryId ?? null
		};
	}

	/**
	 * The tax category each variant is taxed under, by the catalogue (R3-07c).
	 *
	 * @param variantIds The variants.
	 * @returns The category per variant id; a variant with none, or every variant when no capability is bound,
	 * maps to nothing — the rate resolution then applies the organization's default.
	 */
	private async taxCategoriesOfVariants(variantIds: ID[]): Promise<Map<string, ID | null>> {
		const categories = new Map<string, ID | null>();

		if (!this.taxCategories || !variantIds.length) {
			return categories;
		}

		for (const answer of (await this.taxCategories.taxCategoriesOf(variantIds)) ?? []) {
			categories.set(String(answer.variantId), answer.taxCategoryId ?? null);
		}

		return categories;
	}

	/**
	 * Claims a cart for one checkout, before any order exists (R3-10).
	 *
	 * Two completions of the same cart used to both reach the checkout handler: the cart was marked
	 * completed only *after* the order was created, and the recomputation that ran first was predicated
	 * on whatever version the row held when it ran — so a second completion that read the cart after the
	 * first one's recomputation passed every check and placed a second order. The claim closes that
	 * window with one statement: `UPDATE … SET checkoutClaimId, checkoutClaimedAt, version = v + 1 WHERE
	 * id AND version = v AND status IN (ACTIVE, ABANDONED) AND orderId IS NULL`, where `v` is the version
	 * this completion read and validated. Of two completions that read the same version only one update
	 * matches the row; a completion that read the cart after the claim sees the claim and is refused
	 * before it gets here. Both ORMs run the same statement through `commitVersionedUpdate`.
	 *
	 * @param cart The cart as this completion read and validated it.
	 * @param claimId The id this completion claims the cart under.
	 * @param expectation The version the caller read the cart at; the claim is the write that spends it.
	 * @throws ConflictException `CART_ALREADY_COMPLETED` or `CART_CHECKOUT_IN_PROGRESS` when another
	 * completion got there first, or the kernel's version conflict when the cart simply moved on.
	 */
	private async claimForCheckout(
		cart: CommerceCart,
		claimId: string,
		expectation: IVersionExpectation
	): Promise<void> {
		const claimedAt = new Date();

		try {
			await commitVersionedUpdate<CommerceCart>(this, {
				id: cart.id,
				expectation,
				// A wildcard resolves to the version this completion *validated*, not to whatever the row
				// holds by the time the statement runs: a cart that moved on between the two is refused.
				readVersion: async () => parseEntityVersion(cart.version),
				where: {
					...this.writeScope,
					status: In(CHECKOUT_CLAIMABLE_STATUSES),
					orderId: IsNull()
				},
				patch: { checkoutClaimId: claimId, checkoutClaimedAt: claimedAt }
			});
		} catch (error) {
			// The statement matched nothing. The row is read again only to tell the caller *why*: a
			// completion that won the race is a different answer from a cart that was simply edited.
			const current = await this.findOneByIdString(cart.id).catch((): CommerceCart | null => null);

			if (current?.orderId) {
				throw this.alreadyCompleted(cart.id, current.orderId);
			}

			if (current && current.checkoutClaimId !== claimId && this.holdsLiveCheckoutClaim(current)) {
				throw this.checkoutInProgress(cart.id);
			}

			throw error;
		}
	}

	/**
	 * Releases this checkout's claim after the handler failed, so the buyer can try again at once.
	 *
	 * The release is predicated on the claim being this checkout's and on the cart still having no
	 * order, so it can never clear another completion's claim or reopen a completed cart. It is best
	 * effort: a release that does not land leaves a claim that lapses on its own after
	 * `CHECKOUT_CLAIM_TTL_MS`, and the handler's own error is what the caller needs to hear.
	 *
	 * @param cartId The cart.
	 * @param claimId The id this checkout claimed the cart under.
	 */
	private async releaseCheckoutClaim(cartId: ID, claimId: string): Promise<void> {
		try {
			await commitVersionedUpdate<CommerceCart>(this, {
				id: cartId,
				expectation: ANY_VERSION,
				where: { ...this.writeScope, checkoutClaimId: claimId, orderId: IsNull() },
				patch: { checkoutClaimId: null, checkoutClaimedAt: null }
			});
		} catch {
			// Deliberately swallowed — see above.
		}
	}

	/**
	 * Whether a checkout currently holds the cart.
	 *
	 * A claim older than `CHECKOUT_CLAIM_TTL_MS` has lapsed: it belongs to a checkout that died before it
	 * could record an order or release the cart, and a cart held by it forever could never be bought.
	 *
	 * @param cart The cart.
	 * @returns True when a claim is present and has not lapsed.
	 */
	private holdsLiveCheckoutClaim(cart: CommerceCart): boolean {
		if (!cart?.checkoutClaimId || !cart.checkoutClaimedAt) {
			return false;
		}

		const claimedAt = new Date(cart.checkoutClaimedAt).getTime();

		return Number.isFinite(claimedAt) && Date.now() - claimedAt < CHECKOUT_CLAIM_TTL_MS;
	}

	/**
	 * The refusal a completion of a cart that already became an order gets.
	 *
	 * @param cartId The cart.
	 * @param orderId The order it became.
	 * @returns The exception.
	 */
	private alreadyCompleted(cartId: ID, orderId: ID): ConflictException {
		return new ConflictException({
			message: `CART_ALREADY_COMPLETED: cart ${cartId} already became order ${orderId}.`,
			code: 'CART_ALREADY_COMPLETED',
			details: { cartId, orderId }
		});
	}

	/**
	 * The refusal a write to a cart a checkout holds gets.
	 *
	 * @param cartId The cart.
	 * @returns The exception.
	 */
	private checkoutInProgress(cartId: ID): ConflictException {
		return new ConflictException({
			message: `CART_CHECKOUT_IN_PROGRESS: cart ${cartId} is being checked out; read it again once it ends.`,
			code: 'CART_CHECKOUT_IN_PROGRESS',
			details: { cartId }
		});
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

		if (typeof netAmount === 'number') {
			return Number.isFinite(netAmount) ? netAmount : undefined;
		}

		// **A decimal string counts too.** Money crosses every boundary on this branch as an exact
		// decimal string, so a producer that followed that convention wrote `"4.950000"` here and the
		// `typeof === 'number'` test silently answered "this row carries no net" — which makes an
		// inclusive discount reduce the taxable base by its gross. A value that is not a number the
		// totals chain can read is still ignored, which is the behaviour a malformed row had before.
		if (typeof netAmount === 'string' && netAmount.trim() !== '') {
			const parsed = Number(netAmount);

			return Number.isFinite(parsed) ? parsed : undefined;
		}

		return undefined;
	}
}
