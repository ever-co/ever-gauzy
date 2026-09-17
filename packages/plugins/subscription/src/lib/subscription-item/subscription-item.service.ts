import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import { Money, RequestContext, TenantAwareCrudService } from '@gauzy/core';
import {
	ISubscriptionCatalogPort,
	ISubscriptionItem,
	ISubscriptionItemInput,
	ISubscriptionPricingPort,
	SUBSCRIPTION_CATALOG,
	SUBSCRIPTION_PRICING
} from '../subscription.types';
import { normalizeDecimal, recurringAmount } from '../subscription.cycle';
import { normalizeQuantity, toQuantityUnits } from '../subscription.quantity';
import { currentScope } from '../subscription.scope';
import { SubscriptionItem } from './subscription-item.entity';
import { MikroOrmSubscriptionItemRepository } from './repository/mikro-orm-subscription-item.repository';
import { TypeOrmSubscriptionItemRepository } from './repository/type-orm-subscription-item.repository';

/**
 * The recurring line set: what each cycle bills.
 *
 * Three rules shape every write here.
 *
 * **One row per `(subscription, variant)`.** A second row for the same variant would make "how many
 * of this does the customer get" answerable two ways, so a change to a variant's line is an update
 * of that row and never an insert beside it.
 *
 * **A removed line is soft-deleted, never erased.** A cycle that ran last month billed a line set
 * that must still be reconstructible, and the row that was removed is part of that answer.
 *
 * **A price is resolved, not invented.** When a caller states a unit price it is snapshotted as
 * given; when it does not, the price comes from the pricing capability. With no pricing capability
 * registered and no stated price, the write is refused rather than priced at zero, because a
 * recurring line that costs nothing is indistinguishable from a free plan.
 */
@Injectable()
export class SubscriptionItemService extends TenantAwareCrudService<SubscriptionItem> {
	constructor(
		readonly typeOrmSubscriptionItemRepository: TypeOrmSubscriptionItemRepository,
		readonly mikroOrmSubscriptionItemRepository: MikroOrmSubscriptionItemRepository,
		@Optional()
		@Inject(SUBSCRIPTION_PRICING)
		private readonly pricing?: ISubscriptionPricingPort,
		@Optional()
		@Inject(SUBSCRIPTION_CATALOG)
		private readonly catalog?: ISubscriptionCatalogPort
	) {
		super(typeOrmSubscriptionItemRepository, mikroOrmSubscriptionItemRepository);
	}

	/**
	 * Writes a subscription's whole line set, preserving the rows it replaces.
	 *
	 * Used at creation and by the prorated change path. Lines whose variant is no longer in the set
	 * are soft-deleted rather than removed; lines that are still there are updated in place, so their
	 * identity — and therefore any reference a cycle made to them — survives.
	 *
	 * @param subscriptionId The subscription the lines belong to.
	 * @param items The line set as the caller stated it.
	 * @param currency The currency the prices are expressed in.
	 * @param customerId The customer, so a customer-specific price list is honoured.
	 * @param defaultVariantId The variant to add when the caller named no lines at all.
	 * @returns The written lines, in position order.
	 */
	public async replaceItems(
		subscriptionId: ID,
		items: ISubscriptionItemInput[],
		currency: CurrencyCode,
		customerId?: ID,
		defaultVariantId?: ID
	): Promise<SubscriptionItem[]> {
		const requested = await this.prepareItems(items, currency, customerId, defaultVariantId);
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const existing = await this.findForSubscription(subscriptionId);
		const kept = new Set<ID>();

		const written: SubscriptionItem[] = [];

		for (const item of requested) {
			kept.add(item.variantId);

			const current = existing.find((row) => row.variantId === item.variantId);

			if (current) {
				await super.update(current.id, {
					quantity: item.quantity,
					unitPrice: item.unitPrice,
					position: item.position
				} as any);

				written.push(await this.findOneScoped(current.id));
				continue;
			}

			const created = await super.create({
				subscriptionId,
				variantId: item.variantId,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				position: item.position,
				metadata: item.metadata,
				tenantId,
				organizationId
			} as any);

			written.push(created);
		}

		for (const row of existing) {
			if (!kept.has(row.variantId)) {
				await super.softDelete(row.id);
			}
		}

		return written.sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
	}

	/**
	 * Resolves a line set without writing it.
	 *
	 * Separated from `replaceItems` so a caller that has to write the lines inside its own transaction
	 * — creating a subscription writes the agreement, its lines, its first cycle and its event
	 * together — can still have the prices resolved by the one service that knows how.
	 *
	 * @param items The line set as the caller stated it.
	 * @param currency The currency the prices are expressed in.
	 * @param customerId The customer, so a customer-specific price list is honoured.
	 * @param defaultVariantId The variant to use when the caller named no lines at all.
	 * @returns The resolved lines, in position order.
	 * @throws BadRequestException when the set is empty, names no variant, or names one variant twice.
	 */
	public async prepareItems(
		items: ISubscriptionItemInput[],
		currency: CurrencyCode,
		customerId?: ID,
		defaultVariantId?: ID
	): Promise<
		Array<{ variantId: ID; quantity: DecimalString; unitPrice: DecimalString; position: number; metadata?: Record<string, unknown> }>
	> {
		const requested = items?.length ? items : defaultVariantId ? [{ variantId: defaultVariantId }] : [];

		if (!requested.length) {
			throw new BadRequestException(
				'SUBSCRIPTION_ITEMS_REQUIRED: a subscription must name at least one recurring line, or a plan whose catalogue target resolves to a variant.'
			);
		}

		const prepared: Array<{
			variantId: ID;
			quantity: DecimalString;
			unitPrice: DecimalString;
			position: number;
			metadata?: Record<string, unknown>;
		}> = [];
		const seen = new Set<ID>();

		for (const [index, item] of requested.entries()) {
			if (!item?.variantId) {
				throw new BadRequestException('A subscription line must name the variant it delivers.');
			}

			if (seen.has(item.variantId)) {
				throw new BadRequestException(
					`SUBSCRIPTION_ITEM_DUPLICATED: variant ${item.variantId} appears twice in the line set; state its quantity once.`
				);
			}

			seen.add(item.variantId);

			prepared.push({
				variantId: item.variantId,
				quantity: this.storeQuantity(normalizeDecimal(item.quantity, '1')),
				unitPrice: await this.resolveUnitPrice(item.variantId, currency, item.unitPrice, customerId),
				position: Number.isFinite(Number(item.position)) ? Number(item.position) : index,
				metadata: item.metadata
			});
		}

		return prepared;
	}

	/**
	 * Adds or updates one line without touching the rest of the set.
	 *
	 * @param subscriptionId The subscription the line belongs to.
	 * @param item The line as the caller stated it.
	 * @param currency The currency the price is expressed in.
	 * @param customerId The customer, so a customer-specific price list is honoured.
	 * @returns The written line.
	 */
	public async addItem(
		subscriptionId: ID,
		item: ISubscriptionItemInput,
		currency: CurrencyCode,
		customerId?: ID
	): Promise<SubscriptionItem> {
		const written = await this.replaceItems(
			subscriptionId,
			[...(await this.findForSubscription(subscriptionId)).map((row) => ({
				variantId: row.variantId,
				quantity: row.quantity,
				unitPrice: row.unitPrice,
				position: row.position
			})), item],
			currency,
			customerId
		);

		return written.find((row) => row.variantId === item.variantId);
	}

	/**
	 * Changes the quantity of one line.
	 *
	 * @param subscriptionId The subscription the line belongs to.
	 * @param variantId The variant whose line is changing.
	 * @param quantity The new quantity, as an exact decimal.
	 * @param currency The subscription's currency, which is stated by every caller of this method. It
	 * is not what the quantity is measured against — a quantity is stored at the quantity column's own
	 * scale, never at the currency's minor unit — but it stays on the signature so the callers that
	 * resolve a subscription's currency first do not have to special-case this one write.
	 * @returns The updated line.
	 * @throws NotFoundException when the subscription has no line for that variant.
	 */
	public async changeQuantity(
		subscriptionId: ID,
		variantId: ID,
		quantity: DecimalString | number,
		currency: CurrencyCode
	): Promise<SubscriptionItem> {
		const existing = await this.findForSubscription(subscriptionId);
		const current = existing.find((row) => row.variantId === variantId);

		if (!current) {
			throw new NotFoundException(
				`SUBSCRIPTION_ITEM_NOT_FOUND: subscription ${subscriptionId} has no recurring line for variant ${variantId}.`
			);
		}

		await super.update(current.id, { quantity: this.storeQuantity(normalizeDecimal(quantity, '1')) } as any);

		return await this.findOneScoped(current.id);
	}

	/**
	 * Removes one line, preserving the row as history.
	 *
	 * @param subscriptionId The subscription the line belongs to.
	 * @param variantId The variant whose line is being removed.
	 * @returns The removed line's id.
	 * @throws BadRequestException when it is the subscription's last line, because a subscription with
	 * no lines bills nothing and would look like a free plan.
	 */
	public async removeItem(subscriptionId: ID, variantId: ID): Promise<ID> {
		const existing = await this.findForSubscription(subscriptionId);
		const current = existing.find((row) => row.variantId === variantId);

		if (!current) {
			throw new NotFoundException(
				`SUBSCRIPTION_ITEM_NOT_FOUND: subscription ${subscriptionId} has no recurring line for variant ${variantId}.`
			);
		}

		if (existing.length <= 1) {
			throw new BadRequestException(
				'SUBSCRIPTION_LAST_ITEM: a subscription must keep at least one recurring line; pause or cancel it instead of emptying it.'
			);
		}

		await super.softDelete(current.id);

		return current.id;
	}

	/**
	 * @param subscriptionId The subscription to read the lines of.
	 * @returns Its live lines, in position order.
	 */
	public async findForSubscription(subscriptionId: ID): Promise<SubscriptionItem[]> {
		return await this.typeOrmSubscriptionItemRepository.find({
			where: {
				subscriptionId,
				...currentScope()
			},
			order: { position: 'ASC' }
		});
	}

	/**
	 * @param subscriptionId The subscription to total.
	 * @param currency The currency the lines are expressed in.
	 * @returns The exact recurring amount of the line set, before any plan discount.
	 */
	public async recurringAmountOf(subscriptionId: ID, currency: CurrencyCode): Promise<Money> {
		return recurringAmount(await this.findForSubscription(subscriptionId), currency);
	}

	/**
	 * Reads a line inside the caller's tenant and organization.
	 *
	 * @param id The line to read.
	 * @returns The line.
	 * @throws NotFoundException when it is not the caller's.
	 */
	public async findOneScoped(id: ID): Promise<SubscriptionItem> {
		const item = await this.typeOrmSubscriptionItemRepository.findOne({
			where: {
				id,
				...currentScope()
			}
		});

		if (!item) {
			throw new NotFoundException('The subscription item was not found.');
		}

		return item;
	}

	/**
	 * The variant a product-level plan bills, when the caller named no lines.
	 *
	 * @param plan The plan being subscribed to.
	 * @returns The variant, or undefined for a plan that delivers nothing the catalogue knows about.
	 */
	public async variantOfPlan(plan: { productId?: ID; variantId?: ID }): Promise<ID | undefined> {
		if (plan?.variantId) {
			return plan.variantId;
		}

		if (plan?.productId && this.catalog) {
			return (await this.catalog.defaultVariantOf(plan.productId)) ?? undefined;
		}

		return undefined;
	}

	/**
	 * Resolves the recurring unit price of a line.
	 *
	 * @param variantId The variant being priced.
	 * @param currency The currency the price must be expressed in.
	 * @param stated The price the caller stated, when it stated one.
	 * @param customerId The customer, so a customer-specific price list is honoured.
	 * @returns The unit price at the money layer's storage scale.
	 * @throws BadRequestException when no price was stated and the pricing capability is not registered
	 * or returned nothing.
	 */
	public async resolveUnitPrice(
		variantId: ID,
		currency: CurrencyCode,
		stated?: DecimalString | number,
		customerId?: ID
	): Promise<DecimalString> {
		if (stated !== undefined && stated !== null && String(stated) !== '') {
			return this.store(normalizeDecimal(stated, '0'), currency);
		}

		if (!this.pricing) {
			throw new BadRequestException(
				`SUBSCRIPTION_PRICING_UNAVAILABLE: no price was stated for variant ${variantId} and the pricing capability is not registered, so its recurring price cannot be resolved.`
			);
		}

		const resolved = await this.pricing.resolveRecurringPrice({ variantId, customerId, currency });

		if (!resolved?.unitPrice) {
			throw new BadRequestException(
				`SUBSCRIPTION_PRICE_NOT_FOUND: no recurring price was resolved for variant ${variantId} in ${currency}.`
			);
		}

		return this.store(normalizeDecimal(resolved.unitPrice, '0'), currency);
	}

	/**
	 * Stores a recurring quantity at the scale its own column declares.
	 *
	 * A quantity is a count of units, so the currency of the prices beside it has no say in how it is
	 * measured: it is kept at `numeric(20,6)`, which is what `subscription_item.quantity` is. Rounding
	 * it at the currency's minor unit instead would silently change what the customer is billed — half
	 * a unit in a currency with no minor unit would become one.
	 *
	 * @param value An exact decimal quantity.
	 * @returns The quantity at the quantity column's scale.
	 * @throws BadRequestException when the quantity is negative or is not an exact decimal.
	 */
	private storeQuantity(value: DecimalString): DecimalString {
		if (toQuantityUnits(value) < 0n) {
			throw new BadRequestException(
				'SUBSCRIPTION_AMOUNT_INVALID: a recurring quantity or price cannot be negative.'
			);
		}

		return normalizeQuantity(value);
	}

	/**
	 * @param value An exact decimal.
	 * @param currency The currency it is expressed in.
	 * @returns The value at the storage scale of a money column.
	 * @throws BadRequestException when the value is negative or is not an exact decimal.
	 */
	private store(value: DecimalString, currency: CurrencyCode): DecimalString {
		const money = Money.of(value, currency).round();

		if (money.isNegative()) {
			throw new BadRequestException('SUBSCRIPTION_AMOUNT_INVALID: a recurring quantity or price cannot be negative.');
		}

		return money.toStorageString();
	}
}
