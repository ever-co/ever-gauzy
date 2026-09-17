import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import {
	Money,
	Organization,
	OrganizationVendor,
	ProductVariant,
	ProductVariantPrice,
	RequestContext,
	TenantAwareCrudService
} from '@gauzy/core';
import {
	IVendorProductTerm,
	IVendorProductTermInput,
	IVendorTermContext,
	IVendorTermLinePricing,
	IVendorTermResolution,
	PurchasingCodes,
	VendorTermStatus
} from '../purchasing.types';
import {
	compareQuantity,
	isAtLeastQuantity,
	isSameQuantity,
	normalizeQuantity,
	QUANTITY_SCALE,
	toQuantityUnits
} from '../purchasing.quantity';
import { PurchaseOrderLine } from '../purchase-order-line/purchase-order-line.entity';
import { VendorProductTerm } from './vendor-product-term.entity';
import { MikroOrmVendorProductTermRepository } from './repository/mikro-orm-vendor-product-term.repository';
import { TypeOrmVendorProductTermRepository } from './repository/type-orm-vendor-product-term.repository';

/** The priority a term is written with when the caller states none. */
const DEFAULT_PRIORITY = 100;

/** The fraction the tolerance columns are read at, when a row states none. */
const NO_TOLERANCE = '0';

/** What the supplier master can say about a vendor, as this domain reads it. */
interface IVendorDefaults {
	/** The supplier's own purchase currency, which a term inherits when it states none. */
	currency?: string;
	/** Days from order confirmation to receipt, at vendor level. */
	leadTimeDays?: number;
	/** The floor on one order, at vendor level. */
	minimumOrderAmount?: DecimalString;
}

/**
 * The negotiated agreements with the organization's suppliers, and the resolution that prices an order
 * line from them.
 *
 * **The precedence, stated once and authoritatively: term row → vendor row → organization setting →
 * none.** `leadTimeDays`, `minimumOrderAmount` and `currency` on the supplier master are vendor-level
 * *defaults*; they are read only when the winning term row does not carry its own. That is what makes
 * a mixed basket correct: one supplier's 500-unit break of one variant and 100-unit break of another
 * are two rows, and each line is dated and priced by its own.
 *
 * **The resolution order** is the domain's contract and is implemented by `resolve()`:
 *
 * 1. the context is `{ vendorId, variantId, quantity, currency, date }`, the quantity being the
 *    quantity in the reference unit;
 * 2. the candidates are the `ACTIVE` rows of that supplier and variant whose window contains the date
 *    and whose quantity break the requested quantity reaches;
 * 3. they are ordered by `priority`, then by `minQuantity` **descending** — the best break the quantity
 *    actually reaches — then by unit cost, then by id, so the answer never depends on row order;
 * 4. the winner's price and negotiated fraction are applied. **The conversion step is deliberately
 *    single-currency**: this package holds no exchange-rate reader, so a term stated in another
 *    currency is refused with `PRICE_EXCHANGE_RATE_MISSING` rather than converted at an assumed 1:1 —
 *    inventing a rate would be worse than refusing, because the wrong price is then snapshotted onto a
 *    placed order and nothing can tell that it was a guess;
 * 5. the lead time the winner resolved is reported, so the caller can date the line from the instant
 *    the order is actually sent;
 * 6. when nothing matches, the variant's own cost price is used if it is stated in the order's
 *    currency, and otherwise the line is entered by hand — a missing term is a **warning**
 *    (`VENDOR_TERM_NOT_FOUND`), never a refusal, because an order may be raised against a supplier the
 *    organization has no standing agreement with;
 * 7. `priceLine()` returns the term's identity as **provenance**. The line stores it and never re-reads
 *    the term afterwards, so a term renegotiated today changes future orders only — which is the
 *    intent, and must be stated so nobody "fixes" it by re-resolving open orders.
 *
 * **The invariant the service owns (I-82):** for one organization, supplier, variant and currency, two
 * `ACTIVE` rows whose windows overlap may not claim the same quantity band — a row's band runs from its
 * `minQuantity` to the next higher one, open-ended at the top — and a breach is refused with
 * `VENDOR_TERM_OVERLAP`. The database cannot state it (the band's upper bound is another row's lower
 * bound), so the service checks it on every write and the nightly `purchase-three-way-audit` re-derives
 * it and reports divergence.
 */
@Injectable()
export class VendorProductTermService extends TenantAwareCrudService<VendorProductTerm> {
	constructor(
		readonly typeOrmVendorProductTermRepository: TypeOrmVendorProductTermRepository,
		readonly mikroOrmVendorProductTermRepository: MikroOrmVendorProductTermRepository
	) {
		super(typeOrmVendorProductTermRepository, mikroOrmVendorProductTermRepository);
	}

	/*
	|--------------------------------------------------------------------------
	| Writing
	|--------------------------------------------------------------------------
	*/

	/**
	 * Writes a term.
	 *
	 * The supplier has to be usable and the variant has to exist in this organization, because a term
	 * is a statement about a real unit bought from a real supplier; the currency is defaulted from the
	 * supplier's own purchase currency and then from the organization's base currency, because a price
	 * without its currency cannot be compared with an order; and the new row is refused when it would
	 * claim a quantity band another live row of the same supplier, variant and currency already claims.
	 *
	 * @param entity The term to write.
	 * @returns The written term.
	 * @throws NotFoundException when the supplier or the variant does not exist in this organization.
	 * @throws ConflictException when the supplier is archived or inactive, when the window is not a
	 * window, or when the band overlaps a live row's.
	 * @throws BadRequestException when neither a unit price nor a pack price and size were stated.
	 */
	public async create(entity: Partial<VendorProductTerm> & IVendorProductTermInput): Promise<VendorProductTerm> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = this.currentOrganization();

		if (!entity.vendorId) {
			throw new BadRequestException('VENDOR_TERM_VENDOR_REQUIRED: a term must name the supplier it is with.');
		}

		if (!entity.variantId) {
			throw new BadRequestException('VENDOR_TERM_VARIANT_REQUIRED: a term must name the unit it is about.');
		}

		await this.assertVendorUsable(entity.vendorId);
		await this.assertVariantExists(entity.variantId);

		const currency = (entity.currency ?? (await this.defaultCurrency(entity.vendorId))) as CurrencyCode;
		const unitCost = this.deriveUnitCost(entity, currency);
		const minQuantity = normalizeQuantity(entity.minQuantity ?? 0);
		const window = this.assertWindow(entity.startsAt, entity.endsAt);
		const status = entity.status ?? VendorTermStatus.ACTIVE;

		if (status === VendorTermStatus.ACTIVE) {
			await this.assertBandsDoNotOverlap({
				vendorId: entity.vendorId,
				variantId: entity.variantId,
				currency,
				minQuantity,
				startsAt: window.startsAt,
				endsAt: window.endsAt
			});
		}

		const written = await super.create({
			vendorId: entity.vendorId,
			variantId: entity.variantId,
			currency,
			unitCost,
			discountPercent:
				entity.discountPercent === undefined ? undefined : normalizeQuantity(entity.discountPercent),
			minQuantity,
			packSize: entity.packSize === undefined ? undefined : normalizeQuantity(entity.packSize),
			packLabel: entity.packLabel,
			leadTimeDays: entity.leadTimeDays,
			vendorProductCode: entity.vendorProductCode,
			vendorProductName: entity.vendorProductName,
			overReceiptTolerancePercent:
				entity.overReceiptTolerancePercent === undefined
					? undefined
					: normalizeQuantity(entity.overReceiptTolerancePercent),
			priority: entity.priority ?? DEFAULT_PRIORITY,
			startsAt: window.startsAt,
			endsAt: window.endsAt,
			status,
			metadata: entity.metadata,
			tenantId,
			organizationId
		} as any);

		return await this.findScoped(written.id);
	}

	/**
	 * Amends a term.
	 *
	 * A renegotiation is an amendment of the window rather than an edit of history: the price of a term
	 * that has already priced orders is never rewritten in place, because the orders carry the price
	 * they were raised at and the point of keeping the term is to explain where that price came from.
	 * The band check runs again on every amendment that leaves a row `ACTIVE`, which is exactly where an
	 * overlap is introduced.
	 *
	 * @param id The term to amend.
	 * @param entity The fields to change.
	 * @returns The amended term.
	 * @throws NotFoundException when the term is not the caller's.
	 * @throws ConflictException when the amendment would overlap a live row's band, or is not a window.
	 */
	public async update(id: ID, entity: Partial<VendorProductTerm>): Promise<VendorProductTerm> {
		const term = await this.findScoped(id);
		const vendorId = entity.vendorId ?? term.vendorId;
		const variantId = entity.variantId ?? term.variantId;
		const currency = (entity.currency ?? term.currency) as CurrencyCode;
		const minQuantity = entity.minQuantity === undefined ? term.minQuantity : normalizeQuantity(entity.minQuantity);
		const status = entity.status ?? term.status;
		const window = this.assertWindow(
			entity.startsAt === undefined ? term.startsAt : entity.startsAt,
			entity.endsAt === undefined ? term.endsAt : entity.endsAt
		);

		if (status === VendorTermStatus.ACTIVE) {
			await this.assertBandsDoNotOverlap(
				{ vendorId, variantId, currency, minQuantity, startsAt: window.startsAt, endsAt: window.endsAt },
				id
			);
		}

		const changes: Record<string, unknown> = {
			vendorId,
			variantId,
			currency,
			minQuantity,
			startsAt: window.startsAt,
			endsAt: window.endsAt,
			status
		};

		for (const field of [
			'unitCost',
			'discountPercent',
			'packSize',
			'packLabel',
			'leadTimeDays',
			'vendorProductCode',
			'vendorProductName',
			'overReceiptTolerancePercent',
			'priority',
			'metadata'
		] as const) {
			if (entity[field] !== undefined) {
				changes[field] = entity[field];
			}
		}

		await super.update(id, changes as any);

		return await this.findScoped(id);
	}

	/**
	 * Retires a term.
	 *
	 * **A term a placed order used is never deleted.** When any purchase-order line names this row, the
	 * row is moved to `INACTIVE` instead of being deleted, so "why was this ordered at 4.20?" stays
	 * answerable after the renegotiation that replaced it — and the line's `vendorTermId` keeps pointing
	 * at something. A term nothing has used is deleted normally.
	 *
	 * @param id The term to retire.
	 * @returns The retired term when it was kept, otherwise the deletion result.
	 * @throws NotFoundException when the term is not the caller's.
	 */
	public async delete(id: ID): Promise<any> {
		await this.findScoped(id);

		const used = await this.typeOrmVendorProductTermRepository.manager.count(PurchaseOrderLine, {
			where: { vendorTermId: id } as any
		});

		if (used > 0) {
			await super.update(id, { status: VendorTermStatus.INACTIVE } as any);

			return await this.findScoped(id);
		}

		return await super.delete(id);
	}

	/**
	 * Writes several terms in one call.
	 *
	 * This is the sanctioned way to write a product-wide agreement. A term with no variant is
	 * deliberately not supported — it would create a second resolution path and a precedence question
	 * ("does the variant row beat the template row?") for a convenience — so a catalogue-wide price is
	 * one row per variant, and the operation that makes that bearable is this one. A row whose business
	 * key already exists is amended in place rather than duplicated.
	 *
	 * @param inputs The terms to write.
	 * @returns The written terms.
	 * @throws BadRequestException when no term was given.
	 */
	public async bulkUpsert(inputs: IVendorProductTermInput[]): Promise<VendorProductTerm[]> {
		if (!Array.isArray(inputs) || inputs.length === 0) {
			throw new BadRequestException('A bulk term write needs at least one term.');
		}

		const written: VendorProductTerm[] = [];

		for (const input of inputs) {
			const currency = (input.currency ?? (await this.defaultCurrency(input.vendorId))) as CurrencyCode;
			const minQuantity = normalizeQuantity(input.minQuantity ?? 0);
			const existing = await this.typeOrmVendorProductTermRepository.findOne({
				where: {
					tenantId: RequestContext.currentTenantId(),
					organizationId: this.currentOrganization(),
					vendorId: input.vendorId,
					variantId: input.variantId,
					currency,
					minQuantity
				} as any
			});

			if (existing) {
				// The row already carries the agreement for this break, so the write amends it rather than
				// adding a second row that would claim the same band.
				written.push(await this.update(existing.id, input as any));
				continue;
			}

			written.push(await this.create(input as any));
		}

		return written;
	}

	/*
	|--------------------------------------------------------------------------
	| Resolution
	|--------------------------------------------------------------------------
	*/

	/**
	 * Resolves what a quantity of one variant costs, when ordered from one supplier on one date.
	 *
	 * The order of the candidates, the single-currency conversion step and the fallback are the
	 * contract this table exists for and are described on the class. Nothing here refuses because no
	 * term matched: the answer says which source priced the quantity and carries the warning with it.
	 *
	 * @param context What is being priced.
	 * @returns The price to apply, the lead time, the container and any warning.
	 * @throws BadRequestException when the caller is not acting inside an organization.
	 * @throws ConflictException when the winning term is stated in another currency and no rate can be
	 * applied, which is a refusal rather than an assumed 1:1.
	 */
	public async resolve(context: IVendorTermContext): Promise<IVendorTermResolution> {
		const organizationId = this.currentOrganization();
		const tenantId = RequestContext.currentTenantId();
		const date = context.date ?? new Date();
		const quantity = normalizeQuantity(context.quantity);
		const currency = context.currency;

		if (!context.vendorId || !context.variantId) {
			throw new BadRequestException(
				'VENDOR_TERM_CONTEXT_INCOMPLETE: a resolution needs both the supplier and the unit being priced.'
			);
		}

		const vendor = await this.vendorDefaults(context.vendorId);
		const rows = await this.typeOrmVendorProductTermRepository.find({
			where: {
				tenantId,
				organizationId,
				vendorId: context.vendorId,
				variantId: context.variantId,
				status: VendorTermStatus.ACTIVE
			} as any
		});

		// The window and the quantity break are applied here rather than in the predicate: a null bound
		// is open-ended, and expressing that in SQL differs between the three dialects, while a
		// predicate that means three different things is not a rule.
		const candidates = rows
			.filter((row) => this.windowContains(row, date) && isAtLeastQuantity(quantity, row.minQuantity ?? 0))
			.sort((left, right) => this.compareCandidates(left, right));

		const winner = candidates[0];

		if (winner) {
			if (String(winner.currency) !== String(currency)) {
				throw new ConflictException(
					`${PurchasingCodes.PRICE_EXCHANGE_RATE_MISSING}: term '${winner.id}' is stated in ${winner.currency} and the order is in ${currency}, and this domain holds no rate to convert it with.`
				);
			}

			return {
				term: winner as IVendorProductTerm,
				unitCost: normalizeQuantity(winner.unitCost),
				discountPercent:
					winner.discountPercent === undefined || winner.discountPercent === null
						? undefined
						: normalizeQuantity(winner.discountPercent),
				currency,
				leadTimeDays: winner.leadTimeDays ?? vendor.leadTimeDays ?? 0,
				packSize: winner.packSize === undefined || winner.packSize === null ? undefined : normalizeQuantity(winner.packSize),
				packLabel: winner.packLabel,
				vendorProductCode: winner.vendorProductCode,
				vendorProductName: winner.vendorProductName,
				overReceiptTolerancePercent:
					winner.overReceiptTolerancePercent === undefined || winner.overReceiptTolerancePercent === null
						? undefined
						: normalizeQuantity(winner.overReceiptTolerancePercent),
				minimumOrderAmount:
					vendor.minimumOrderAmount === undefined ? undefined : normalizeQuantity(vendor.minimumOrderAmount),
				source: 'TERM',
				warnings: []
			};
		}

		const variantCost = await this.variantCostPrice(context.variantId);
		const usable =
			variantCost &&
			(!variantCost.unitCostCurrency || String(variantCost.unitCostCurrency) === String(currency)) &&
			toQuantityUnits(variantCost.unitCost) > 0n;

		return {
			unitCost: usable ? normalizeQuantity(variantCost.unitCost) : '0',
			currency,
			leadTimeDays: vendor.leadTimeDays ?? 0,
			minimumOrderAmount:
				vendor.minimumOrderAmount === undefined ? undefined : normalizeQuantity(vendor.minimumOrderAmount),
			source: usable ? 'VARIANT_COST_PRICE' : 'NONE',
			warnings: [PurchasingCodes.VENDOR_TERM_NOT_FOUND]
		};
	}

	/**
	 * Prices one purchase-order line from the standing agreement.
	 *
	 * The three outcomes are the three the domain admits. A caller that states a cost has priced the
	 * line by hand, so the term is not its provenance — but the supplier's own lead time still dates it,
	 * because the delivery expectation is a fact about the supplier rather than about the price. A
	 * caller that states no cost is priced by the winning term, or from the variant's own cost price
	 * with a warning. Neither existing is the one case that cannot be completed silently: a line with
	 * no price at all would post a zero-cost commitment, so it is refused and the caller states one.
	 *
	 * @param input What is being priced: the supplier, the unit, the quantity in the reference unit and
	 * anything the caller stated itself.
	 * @param currency The single currency the order is in.
	 * @returns The pricing to snapshot onto the line, including its provenance and its warnings.
	 * @throws BadRequestException when nothing priced the line and the caller stated no cost.
	 */
	public async priceLine(
		input: {
			vendorId: ID;
			variantId: ID;
			quantity: DecimalString | number;
			unitCost?: DecimalString | number;
			discountTotal?: DecimalString | number;
			date?: Date;
		},
		currency: CurrencyCode
	): Promise<IVendorTermLinePricing> {
		const quantity = normalizeQuantity(input.quantity ?? 0);
		const statedUnitCost = statedValue(input.unitCost);
		const statedDiscount = statedValue(input.discountTotal);

		if (statedUnitCost !== undefined) {
			const vendor = await this.vendorDefaults(input.vendorId);

			return {
				unitCost: normalizeQuantity(statedUnitCost),
				discountTotal: statedDiscount === undefined ? '0' : normalizeQuantity(statedDiscount),
				leadTimeDays: vendor.leadTimeDays ?? 0,
				source: 'MANUAL',
				warnings: []
			};
		}

		const resolution = await this.resolve({
			vendorId: input.vendorId,
			variantId: input.variantId,
			quantity,
			currency,
			date: input.date
		});

		if (resolution.source === 'NONE') {
			throw new BadRequestException(
				`${PurchasingCodes.VENDOR_TERM_NOT_FOUND}: no term prices this unit and the variant states no cost price, so the line has to state its own unit cost.`
			);
		}

		const net = Money.of(resolution.unitCost, currency).multiply(quantity);
		const negotiated =
			resolution.discountPercent === undefined
				? undefined
				: net.multiply(resolution.discountPercent).round().toStorageString();

		return {
			vendorTermId: resolution.term?.id,
			unitCost: resolution.unitCost,
			discountTotal: statedDiscount === undefined ? negotiated ?? '0' : normalizeQuantity(statedDiscount),
			orderedPackSize: resolution.packSize,
			leadTimeDays: resolution.leadTimeDays,
			source: resolution.source,
			warnings: resolution.warnings
		};
	}

	/**
	 * Reads the over-shipment allowance the term that priced a line negotiated.
	 *
	 * This is the first step of the receipt tolerance chain — the term, then the organization's
	 * `purchasing.overReceiptTolerancePercent` setting, then none — and it is deliberately a read of
	 * one column rather than a resolution: the line knows which term priced it, so the allowance that
	 * applies to it is the one that was negotiated for it, not the one that happens to be reachable
	 * today.
	 *
	 * @param termId The term the line records as its provenance, when it records one.
	 * @returns The fraction, as an exact decimal, or undefined when the term states none.
	 */
	public async overReceiptTolerancePercentOf(termId?: ID): Promise<DecimalString | undefined> {
		const term = await this.findProvenance(termId);

		if (!term || term.overReceiptTolerancePercent === undefined || term.overReceiptTolerancePercent === null) {
			return undefined;
		}

		return normalizeQuantity(term.overReceiptTolerancePercent);
	}

	/*
	|--------------------------------------------------------------------------
	| Reading
	|--------------------------------------------------------------------------
	*/

	/**
	 * Reads a term scoped to the caller's tenant and organization.
	 *
	 * @param id The term to read.
	 * @returns The term.
	 * @throws NotFoundException when it is not the caller's.
	 */
	public async findScoped(id: ID): Promise<VendorProductTerm> {
		const term = await this.typeOrmVendorProductTermRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: this.currentOrganization()
			} as any
		});

		if (!term) {
			throw new NotFoundException(`VENDOR_TERM_NOT_FOUND: vendor term '${id}' could not be found.`);
		}

		return term;
	}

	/*
	|--------------------------------------------------------------------------
	| Invariants
	|--------------------------------------------------------------------------
	*/

	/**
	 * Refuses a row that would claim a quantity band a live row of the same group already claims.
	 *
	 * A row's band starts at its `minQuantity` and ends where the next higher break of the same group
	 * starts, open-ended at the top; so two rows of one group overlap exactly when they claim the same
	 * break and their windows both cover the same instant. `DRAFT` and `INACTIVE` rows are not
	 * candidates for pricing and are therefore not part of the check.
	 *
	 * @param candidate The row about to be written.
	 * @param excludeId The row being amended, which is excluded from the comparison against itself.
	 * @throws ConflictException when a live row already claims the band.
	 */
	public async assertBandsDoNotOverlap(
		candidate: {
			vendorId: ID;
			variantId: ID;
			currency: CurrencyCode;
			minQuantity: DecimalString;
			startsAt?: Date;
			endsAt?: Date;
		},
		excludeId?: ID
	): Promise<void> {
		const rivals = await this.typeOrmVendorProductTermRepository.find({
			where: {
				tenantId: RequestContext.currentTenantId(),
				organizationId: this.currentOrganization(),
				vendorId: candidate.vendorId,
				variantId: candidate.variantId,
				currency: candidate.currency,
				status: VendorTermStatus.ACTIVE
			} as any
		});

		for (const rival of rivals) {
			if (excludeId && rival.id === excludeId) {
				continue;
			}

			if (!this.windowsOverlap(rival, candidate)) {
				continue;
			}

			if (isSameQuantity(rival.minQuantity ?? 0, candidate.minQuantity)) {
				throw new ConflictException(
					`${PurchasingCodes.VENDOR_TERM_OVERLAP}: term '${rival.id}' already prices this unit from quantity ${normalizeQuantity(rival.minQuantity ?? 0)} in ${candidate.currency}, and its validity window overlaps the one being written.`
				);
			}
		}
	}

	/**
	 * Reads the term a line records as its provenance, without refusing when there is none.
	 *
	 * A receipt resolving its tolerance must not fail because the term behind a line has since been
	 * retired and deleted: the chain falls through to the organization's setting instead, which is a
	 * better answer than a receipt that cannot be recorded.
	 *
	 * @param termId The term the line names, when it names one.
	 * @returns The term, or undefined when none is named or the row is gone.
	 */
	public async findProvenance(termId?: ID): Promise<VendorProductTerm | undefined> {
		if (!termId) {
			return undefined;
		}

		const term = await this.typeOrmVendorProductTermRepository.findOne({
			where: {
				id: termId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: this.currentOrganization()
			} as any
		});

		return term ?? undefined;
	}

	/*
	|--------------------------------------------------------------------------
	| The supplier master to the extent this domain reads it
	|--------------------------------------------------------------------------
	*/

	/**
	 * Reads the vendor-level defaults the precedence falls through to.
	 *
	 * A missing supplier answers with empty defaults rather than an error: a resolution is a question
	 * about a price, and a supplier that has since been removed is a question the caller answers with
	 * the fallback rather than with a failure.
	 *
	 * @param vendorId The supplier to read.
	 * @returns The three vendor-level defaults this domain falls through to.
	 */
	private async vendorDefaults(vendorId: ID): Promise<IVendorDefaults> {
		const vendor = await this.typeOrmVendorProductTermRepository.manager.findOne(OrganizationVendor, {
			where: {
				id: vendorId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: this.currentOrganization()
			} as any
		});

		if (!vendor) {
			return {};
		}

		return {
			currency: vendor.currency,
			leadTimeDays: vendor.leadTimeDays,
			minimumOrderAmount:
				vendor.minimumOrderAmount === undefined || vendor.minimumOrderAmount === null
					? undefined
					: normalizeQuantity(vendor.minimumOrderAmount)
		};
	}

	/**
	 * Reads the variant's own cost price, which is the last place a buy-side price comes from before a
	 * person types one.
	 *
	 * @param variantId The unit to read.
	 * @returns The cost price row, or undefined when the variant states none.
	 */
	private async variantCostPrice(variantId: ID): Promise<ProductVariantPrice | undefined> {
		const price = await this.typeOrmVendorProductTermRepository.manager.findOne(ProductVariantPrice, {
			where: {
				productVariant: { id: variantId },
				tenantId: RequestContext.currentTenantId(),
				organizationId: this.currentOrganization()
			} as any
		});

		return price ?? undefined;
	}

	/**
	 * Reads the currency a term inherits when its caller states none.
	 *
	 * @param vendorId The supplier the term is with.
	 * @returns The supplier's purchase currency, else the organization's base currency.
	 * @throws BadRequestException when neither the supplier nor the organization states one, which is a
	 * configuration fault worth naming.
	 */
	private async defaultCurrency(vendorId: ID): Promise<CurrencyCode> {
		const vendor = await this.vendorDefaults(vendorId);

		if (vendor.currency) {
			return vendor.currency as CurrencyCode;
		}

		const organization = await this.typeOrmVendorProductTermRepository.manager.findOne(Organization, {
			where: { id: this.currentOrganization(), tenantId: RequestContext.currentTenantId() } as any
		});

		if (!organization?.currency) {
			throw new BadRequestException(
				'VENDOR_TERM_CURRENCY_REQUIRED: neither the supplier nor the organization states a currency, so the term has none to inherit.'
			);
		}

		return organization.currency as CurrencyCode;
	}

	/**
	 * Reads the supplier and refuses an archived or inactive one.
	 *
	 * @param vendorId The supplier to check.
	 * @throws NotFoundException when the supplier does not exist in this organization.
	 * @throws ConflictException when it is archived or inactive.
	 */
	private async assertVendorUsable(vendorId: ID): Promise<void> {
		const vendor = await this.typeOrmVendorProductTermRepository.manager.findOne(OrganizationVendor, {
			where: {
				id: vendorId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: this.currentOrganization()
			} as any
		});

		if (!vendor) {
			throw new NotFoundException(
				`VENDOR_TERM_VENDOR_NOT_FOUND: supplier '${vendorId}' could not be found in this organization.`
			);
		}

		if (vendor.isArchived === true || vendor.isActive === false) {
			throw new ConflictException(`VENDOR_TERM_VENDOR_INACTIVE: vendor '${vendorId}' is not active.`);
		}
	}

	/**
	 * Reads the variant and refuses one this organization does not carry.
	 *
	 * The foreign key states the same thing, but a constraint violation answers a caller with a driver
	 * error, and a term about a unit that does not exist is a client mistake worth naming.
	 *
	 * @param variantId The unit to check.
	 * @throws NotFoundException when the variant does not exist in this organization.
	 */
	private async assertVariantExists(variantId: ID): Promise<void> {
		const variant = await this.typeOrmVendorProductTermRepository.manager.findOne(ProductVariant, {
			where: {
				id: variantId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: this.currentOrganization()
			} as any
		});

		if (!variant) {
			throw new NotFoundException(
				`VENDOR_TERM_VARIANT_NOT_FOUND: variant '${variantId}' could not be found in this organization.`
			);
		}
	}

	/**
	 * Derives the price of one base unit from the way the supplier stated it.
	 *
	 * A supplier quotes either a unit price or the price of their container. Both are recordable, and a
	 * container price is divided by the container size and rounded half-up to the storage scale, so the
	 * platform's own total stays authoritative and recomputable from the row.
	 *
	 * @param entity The term being written.
	 * @param currency The currency the term is stated in, which the price layer works in.
	 * @returns The price of one base unit, as an exact decimal.
	 * @throws BadRequestException when neither form of the price was stated, or a container price was
	 * stated with no container size to divide it by.
	 */
	private deriveUnitCost(
		entity: Partial<VendorProductTerm> & IVendorProductTermInput,
		currency: CurrencyCode
	): DecimalString {
		const unitCost = statedValue(entity.unitCost);
		const packPrice = statedValue(entity.packPrice);

		if (unitCost !== undefined) {
			return normalizeQuantity(unitCost);
		}

		if (packPrice === undefined) {
			throw new BadRequestException(
				'VENDOR_TERM_PRICE_REQUIRED: a term states what one base unit costs, or what the supplier charges for one of their containers.'
			);
		}

		const packSize = entity.packSize === undefined ? undefined : normalizeQuantity(entity.packSize);

		if (packSize === undefined || toQuantityUnits(packSize) <= 0n) {
			throw new BadRequestException(
				'VENDOR_TERM_PACK_SIZE_REQUIRED: a container price needs the container size it is charged for, so the price of one base unit can be derived from it.'
			);
		}

		// The container price is divided at the storage scale of a price column and rounded half-up, so
		// the per-unit figure is exactly what the row it is stored on means.
		return Money.of(packPrice, currency).divide(packSize, { scale: QUANTITY_SCALE }).toStorageString();
	}

	/**
	 * Refuses a window that is not one.
	 *
	 * @param startsAt The lower bound, when one is stated.
	 * @param endsAt The upper bound, when one is stated.
	 * @returns The two bounds, for the caller to write.
	 * @throws ConflictException when the window closes before it opens.
	 */
	private assertWindow(startsAt?: Date, endsAt?: Date): { startsAt?: Date; endsAt?: Date } {
		if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
			throw new ConflictException(
				'VENDOR_TERM_WINDOW_INVALID: a term that ends before it starts prices nothing.'
			);
		}

		return { startsAt, endsAt };
	}

	/**
	 * @param row A term row.
	 * @param date The instant being priced.
	 * @returns True when the row's validity window contains the instant. A null bound is open-ended.
	 */
	private windowContains(row: Pick<VendorProductTerm, 'startsAt' | 'endsAt'>, date: Date): boolean {
		const instant = date.getTime();
		const starts = row.startsAt ? new Date(row.startsAt).getTime() : undefined;
		const ends = row.endsAt ? new Date(row.endsAt).getTime() : undefined;

		return (starts === undefined || starts <= instant) && (ends === undefined || ends >= instant);
	}

	/**
	 * @param left One window.
	 * @param right Another window.
	 * @returns True when the two windows cover at least one common instant. A null bound is open-ended.
	 */
	private windowsOverlap(
		left: Pick<VendorProductTerm, 'startsAt' | 'endsAt'>,
		right: { startsAt?: Date; endsAt?: Date }
	): boolean {
		const leftStart = left.startsAt ? new Date(left.startsAt).getTime() : Number.NEGATIVE_INFINITY;
		const leftEnd = left.endsAt ? new Date(left.endsAt).getTime() : Number.POSITIVE_INFINITY;
		const rightStart = right.startsAt ? new Date(right.startsAt).getTime() : Number.NEGATIVE_INFINITY;
		const rightEnd = right.endsAt ? new Date(right.endsAt).getTime() : Number.POSITIVE_INFINITY;

		return leftStart <= rightEnd && rightStart <= leftEnd;
	}

	/**
	 * Orders two candidates of the same group.
	 *
	 * `priority` first, because it is the explicit tie-break; then `minQuantity` **descending**, because
	 * the best break the quantity actually reaches is the one the buyer earned; then the price; then the
	 * id, so two rows that agree on everything else still resolve the same way on every read.
	 *
	 * The price comparison is the one step the spec states as "converted into the order currency". This
	 * package holds no exchange-rate reader, so the candidates of a resolution are all in the requested
	 * currency by the time they are ordered — a cross-currency winner is refused before it is applied —
	 * and the comparison is therefore between prices already in one currency.
	 *
	 * @param left One candidate.
	 * @param right Another candidate.
	 * @returns A negative number when the left wins, positive when the right does, zero when they tie.
	 */
	private compareCandidates(left: VendorProductTerm, right: VendorProductTerm): number {
		const byPriority = (left.priority ?? DEFAULT_PRIORITY) - (right.priority ?? DEFAULT_PRIORITY);

		if (byPriority !== 0) {
			return byPriority;
		}

		const byBreak = compareQuantity(right.minQuantity ?? 0, left.minQuantity ?? 0);

		if (byBreak !== 0) {
			return byBreak;
		}

		const byCost = compareQuantity(left.unitCost, right.unitCost);

		if (byCost !== 0) {
			return byCost;
		}

		return String(left.id) < String(right.id) ? -1 : 1;
	}

	/**
	 * @returns The organization the caller is acting in.
	 * @throws BadRequestException when the request carries none, because every row of this table is
	 * organization-scoped and a term written without one would be reachable by nobody.
	 */
	private currentOrganization(): ID {
		const organizationId = RequestContext.currentOrganizationId();

		if (!organizationId) {
			throw new BadRequestException(
				'VENDOR_TERM_ORGANIZATION_REQUIRED: a vendor term belongs to one organization, and the request names none.'
			);
		}

		return organizationId;
	}
}

/**
 * Reads a value a caller may or may not have stated.
 *
 * A price or a discount that arrives as an empty string is the same as one that did not arrive: an
 * order form that posts every field it knows about sends `""` for the ones nobody filled in, and
 * treating that as a stated zero would price a line at nothing.
 *
 * @param value The value.
 * @returns The value, or undefined when it was absent.
 */
function statedValue(value?: DecimalString | number | null): DecimalString | number | undefined {
	return value === undefined || value === null || String(value).trim() === '' ? undefined : value;
}
