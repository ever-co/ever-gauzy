import { BadRequestException, Injectable } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere, In, IsNull, Not, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import { Money, MultiORMEnum, ProductVariantPrice, RequestContext, TenantAwareCrudService } from '@gauzy/core';
import {
	IPriceComputation,
	IPriceContext,
	IProductPriceBulkItem,
	IResolvedPrice,
	PriceBaseSource,
	PriceBulkMode,
	PriceComputeMode,
	PriceListStatus,
	PriceListType,
	PriceSource,
	PriceStatus
} from '../pricing.types';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { PricePreferenceService } from '../price-preference/price-preference.service';
import { ProductPrice } from './product-price.entity';
import { TypeOrmProductPriceRepository } from './repository/type-orm-product-price.repository';
import { MikroOrmProductPriceRepository } from './repository/mikro-orm-product-price.repository';

/** What a bulk price upsert did, row by row. */
export interface IProductPriceBulkResult {
	/** Rows that were written, in the order they were supplied. */
	succeeded: ProductPrice[];
	/** Rows that were refused, each with the reason the caller has to fix. */
	failed: Array<{ index: number; variantId?: ID; message: string }>;
}

/** The instant, quantity and scope a resolution runs against. */
interface IResolutionScope {
	context: IPriceContext;
	currency: CurrencyCode;
	quantity: DecimalString;
	at: Date;
	/** When set, only this list's prices are candidates — the dry run of one list. */
	priceListId?: ID;
}

/**
 * What one candidate resolves to: the amount that competes, the base it derived from, and the
 * arithmetic that got there.
 */
interface IResolvedAmount {
	/** The amount the tie-break compares and the caller is charged. */
	amount: DecimalString;
	/** The base a derived amount was computed from; absent for an `AMOUNT` row. */
	baseAmount?: DecimalString;
	/** How the row computed its amount. */
	computation: IPriceComputation;
}

/** How deep a chain of derived price lists may be before a candidate is eliminated. */
const MAX_BASE_LIST_DEPTH = 5;

/**
 * Product prices: the write-time rules and the resolution algorithm.
 *
 * There is exactly one table in the platform that says what a variant costs and this service is its
 * only writer, which is what lets the resolution below be read as the single answer to "what does
 * this cost". Three properties are load-bearing:
 *
 * 1. **Nothing here does decimal arithmetic.** Every comparison, sum and guard-rail computation goes
 *    through the platform money helper, so a price that resolves to a cent is a price the ledger
 *    would also compute. `compareAmounts` and `minimumPriceForMargin` are the only two places that
 *    could have tempted otherwise and both are one call into that helper.
 * 2. **The order is total.** Two candidates of equal priority and equal amount resolve by identifier,
 *    so the same context always produces the same winner and a resolution is reproducible across
 *    dialects and across runs.
 * 3. **Quantity tiers of one tuple never overlap.** A tier is validated on write against the rows
 *    that already exist for the same `(variant, currency, price list)`, because overlapping bands
 *    would make the answer depend on row order — a defect the database cannot see.
 * 4. **A row may say how it computes rather than what it is.** `computeMode = 'PERCENT_OFF'` derives
 *    the amount from a base — the legacy retail price, a cost, or another price list — so a price book
 *    is one row instead of a matrix re-derived by hand on every base change, and a base correction
 *    propagates instead of leaving every derived list stale. The comparison of step 6 is then made on
 *    the **resolved** amount, and a candidate whose base cannot be resolved is eliminated with
 *    `PRICE_BASE_UNRESOLVED` rather than compared.
 *
 * Rule rows (`rule` with `ownerType = PRICE` or `PRICE_LIST`) are conditions decided by the
 * platform's rule engine. The seam for them is `matchedRules` on every resolution: the trace names
 * the conditions the resolution itself applied, and the engine's verdicts join the same trace, so a
 * caller never has to know which of the two narrowed the candidate set.
 */
@Injectable()
export class ProductPriceService extends TenantAwareCrudService<ProductPrice> {
	constructor(
		readonly typeOrmProductPriceRepository: TypeOrmProductPriceRepository,
		readonly mikroOrmProductPriceRepository: MikroOrmProductPriceRepository,
		private readonly pricePreferenceService: PricePreferenceService,
		private readonly exchangeRateService: ExchangeRateService
	) {
		super(typeOrmProductPriceRepository, mikroOrmProductPriceRepository);
	}

	/**
	 * The tenant and organization every read and write of this service is scoped to.
	 */
	protected get scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}

	/*
	|--------------------------------------------------------------------------
	| Writes
	|--------------------------------------------------------------------------
	*/

	/**
	 * Creates a price after checking it can be resolved at all.
	 *
	 * @param entity The price to create.
	 * @returns The stored price.
	 * @throws BadRequestException when the row is not a valid price, when its quantity band overlaps
	 * a band that already exists for the same tuple, or when it sits below its own margin floor.
	 */
	public async createOne(entity: DeepPartial<ProductPrice>): Promise<ProductPrice> {
		const prepared = this.prepare(entity);
		await this.assertTierIsFree(prepared);
		this.assertMarginFloor(prepared);
		await this.assertBaseChainIsUsable(prepared, []);

		return await super.create(prepared);
	}

	/**
	 * Updates a price after re-checking the same rules.
	 *
	 * `variantId` is read from the stored row when the caller does not restate it: a price's variant
	 * is part of its identity, and the overlap check is meaningless without it.
	 *
	 * The payload is the row the caller states rather than the query payload the driver is handed:
	 * every value below is validated and normalised, and a member that names a column default instead
	 * of a value is not something this service can check.
	 *
	 * @param id The price to update.
	 * @param entity The fields to change.
	 * @returns The update result.
	 * @throws BadRequestException when the row is not a valid price, when the change would overlap a
	 * neighbouring band, or when it would fall below the margin floor.
	 */
	public async updateOne(id: ID, entity: DeepPartial<ProductPrice>): Promise<UpdateResult | ProductPrice> {
		const existing = await this.findOneByIdString(id);
		// The row as it would stand after the change: the fields the caller did not state keep the value
		// they already hold, which is what makes the overlap and margin checks meaningful on a partial
		// update rather than against a half-built row.
		const computeMode = (entity.computeMode as PriceComputeMode) ?? existing.computeMode;
		const merged: DeepPartial<ProductPrice> = {
			...entity,
			id,
			variantId: (entity.variantId as ID) ?? existing.variantId,
			currency: (entity.currency as CurrencyCode) ?? existing.currency,
			priceListId: entity.priceListId !== undefined ? (entity.priceListId as ID) : existing.priceListId,
			// The amount a row carries follows from its mode: a derived row stores none, so a change of
			// mode that the caller did not accompany with an amount leaves the column to the row's own
			// rule rather than keeping a number the mode no longer means anything by.
			amount:
				entity.amount !== undefined
					? (entity.amount as DecimalString)
					: computeMode === PriceComputeMode.PERCENT_OFF
					? undefined
					: (existing.amount as DecimalString),
			computeMode,
			percent: entity.percent !== undefined ? (entity.percent as DecimalString) : existing.percent,
			baseSource: entity.baseSource !== undefined ? (entity.baseSource as PriceBaseSource) : existing.baseSource,
			basePriceListId:
				entity.basePriceListId !== undefined ? (entity.basePriceListId as ID) : existing.basePriceListId,
			roundTo: entity.roundTo !== undefined ? (entity.roundTo as DecimalString) : existing.roundTo,
			unitId: entity.unitId !== undefined ? (entity.unitId as ID) : existing.unitId,
			minQuantity: (entity.minQuantity as DecimalString) ?? existing.minQuantity,
			maxQuantity: (entity.maxQuantity as DecimalString) ?? existing.maxQuantity,
			costAmount: (entity.costAmount as DecimalString) ?? existing.costAmount,
			minMarginPercent: (entity.minMarginPercent as DecimalString) ?? existing.minMarginPercent,
			status: (entity.status as PriceStatus) ?? existing.status
		};
		const prepared = this.prepare(merged);

		await this.assertTierIsFree(prepared);
		this.assertMarginFloor(prepared);
		await this.assertBaseChainIsUsable(prepared, []);

		// Only what the caller stated is written, with the normalisation the full row received: omitting a
		// field leaves it alone rather than clearing it, so a partial update cannot silently drop a
		// guard rail or a quantity band. The mode and the amount travel together, because they are one
		// fact: writing one without the other would leave a row whose shape contradicts its own rule.
		const changes: DeepPartial<ProductPrice> = { ...this.suppliedOnly(entity, prepared) };

		if (entity.computeMode !== undefined || entity.amount !== undefined) {
			changes.computeMode = prepared.computeMode;
			changes.amount = prepared.amount;
		}

		return await super.update(id, changes);
	}

	/**
	 * The fields a partial update writes.
	 *
	 * The caller states which fields change and the prepared row says what they become, so the write
	 * carries the stated fields with the normalised values and leaves every other column as it stands.
	 *
	 * @param entity The fields the caller stated.
	 * @param prepared The row as it would stand, normalised.
	 * @returns The fields to write.
	 */
	private suppliedOnly(
		entity: DeepPartial<ProductPrice>,
		prepared: DeepPartial<ProductPrice>
	): DeepPartial<ProductPrice> {
		return Object.fromEntries(Object.keys(entity).map((field: keyof ProductPrice) => [field, prepared[field]]));
	}

	/**
	 * Writes a price matrix.
	 *
	 * The batch is validated in full before the first row is written when `atomic` is set, so a
	 * refused row writes nothing at all; without it the caller receives the per-row report and
	 * decides what to do about the rows that were refused. A database failure part-way through is
	 * reported per row rather than rolled back, because the platform's repositories do not accept a
	 * shared transaction and pretending otherwise would be worse than saying so.
	 *
	 * `REPLACE` mode retires — never deletes — the rows of the `(variant, price list)` pairs the
	 * batch mentions that the batch did not supply, so a full matrix export turned back into an
	 * import converges on the matrix it was exported from while nothing a merchant authored by hand
	 * is lost.
	 *
	 * @param input The rows, the mode and the atomicity flag.
	 * @returns The rows written and the rows refused.
	 */
	public async bulkUpsert(input: {
		items: IProductPriceBulkItem[];
		mode?: PriceBulkMode;
		atomic?: boolean;
	}): Promise<IProductPriceBulkResult> {
		const items = input.items ?? [];
		const mode = input.mode ?? PriceBulkMode.UPSERT;
		const atomic = input.atomic === true;
		const succeeded: ProductPrice[] = [];
		const failed: IProductPriceBulkResult['failed'] = [];
		const writtenIds = new Set<string>();

		if (atomic) {
			// A pre-flight pass over exactly the checks the writes below perform, so an atomic batch
			// either writes every row or writes none.
			for (const [index, item] of items.entries()) {
				try {
					const prepared = this.prepare(this.toPricePayload(item, await this.findExisting(item)));
					await this.assertTierIsFree(prepared);
					this.assertMarginFloor(prepared);
				} catch (error) {
					throw new BadRequestException(
						`PRICE_BULK_INVALID: row ${index} of the batch cannot be written — ${this.messageOf(error)}`
					);
				}
			}
		}

		for (const [index, item] of items.entries()) {
			try {
				const existing = await this.findExisting(item);
				const written = existing
					? await this.updateOne(existing.id, this.toPricePayload(item, existing))
					: await this.createOne(this.toPricePayload(item, undefined));

				succeeded.push(written as ProductPrice);
				writtenIds.add(String((written as ProductPrice).id));
			} catch (error) {
				failed.push({ index, variantId: item.variantId, message: this.messageOf(error) });
			}
		}

		if (mode === PriceBulkMode.REPLACE) {
			await this.retireRowsMissingFromBatch(items, writtenIds);
		}

		return { succeeded, failed };
	}

	/*
	|--------------------------------------------------------------------------
	| Resolution
	|--------------------------------------------------------------------------
	*/

	/**
	 * Resolves the effective price of each requested variant for one context.
	 *
	 * The algorithm is the one the schema is built to serve: candidates are the active prices of the
	 * variant in the requested currency whose window contains the instant and whose tier contains the
	 * quantity, narrowed to those whose price list is eligible for the context; a price from an
	 * eligible `OVERRIDE` list wins outright, otherwise the cheaper of the best `SALE` price and the
	 * best default price wins; `originalAmount` is the best list price that was not a `SALE`, so a
	 * "was" label is only ever shown when there is a real higher price to strike through.
	 *
	 * A variant with no price row at all falls back to the legacy variant retail price, which is what
	 * keeps an installation that never created a price list priced exactly as it was before. A variant
	 * with neither is omitted from the result rather than resolved to zero: a caller diffs what it
	 * asked for against what came back, and a missing price is a configuration gap to report, never a
	 * free product.
	 *
	 * **A candidate is compared on its resolved amount, not on its stored one.** A row whose
	 * `computeMode` is `PERCENT_OFF` stores no amount at all, so its amount is derived here — before the
	 * currency rounding boundary and before the tie-break — and a candidate whose base cannot be
	 * resolved is **eliminated** with `PRICE_BASE_UNRESOLVED` rather than compared against a number it
	 * does not have. That ordering is the reason the candidate window is materialised and then
	 * resolved, rather than ordered in SQL: a derived amount is not a column.
	 *
	 * @param context The context to price against.
	 * @param options.priceListId Restricts candidates to one list — the dry run of a draft list, which
	 * is also the one case where that list's own status is not required to be `ACTIVE`.
	 * @returns One resolution per variant that has a price.
	 */
	public async resolvePrices(context: IPriceContext, options: { priceListId?: ID } = {}): Promise<IResolvedPrice[]> {
		const variantIds = this.readVariantIds(context.variantIds);

		if (!variantIds.length) {
			return [];
		}

		const scope: IResolutionScope = {
			context,
			currency: this.normalizeCurrency(context.currency),
			quantity: this.toStorage(this.toMoney(context.quantity ?? '1', 'quantity', this.normalizeCurrency(context.currency)), 'quantity'),
			at: this.readInstant(context.date),
			priceListId: options.priceListId
		};

		const { tenantId, organizationId } = this.scope;

		if (!organizationId) {
			throw new BadRequestException(
				'PRICE_ORGANIZATION_REQUIRED: a price is resolved inside an organization, because that is what a price row belongs to.'
			);
		}

		const rows = await this.typeOrmProductPriceRepository.find({
			where: {
				tenantId,
				organizationId,
				variantId: In(variantIds),
				currency: scope.currency
			} as FindOptionsWhere<ProductPrice>,
			relations: { priceList: true }
		});

		const byVariant = new Map<ID, ProductPrice[]>();

		for (const row of rows) {
			const bucket = byVariant.get(row.variantId) ?? [];
			bucket.push(row);
			byVariant.set(row.variantId, bucket);
		}

		const eligible = new Map<ID, ProductPrice[]>();
		const unpriced: ID[] = [];
		const legacyNeeded = new Set<ID>();

		for (const variantId of variantIds) {
			const candidates = (byVariant.get(variantId) ?? []).filter((row) => this.isCandidate(row, scope));

			if (!candidates.length) {
				unpriced.push(variantId);
				legacyNeeded.add(variantId);
				continue;
			}

			eligible.set(variantId, candidates);

			// A `LIST` or `COST` derivation starts from the legacy variant price, and a row that states a
			// margin floor with no cost of its own measures it against the same row. Both are read once
			// for the variants that need them rather than once per candidate.
			if (
				candidates.some(
					(row) =>
						this.baseNeedsLegacyPrice(row) ||
						(row.minMarginPercent != null && row.costAmount == null)
				)
			) {
				legacyNeeded.add(variantId);
			}
		}

		const legacy = legacyNeeded.size
			? await this.findLegacyPrices([...legacyNeeded])
			: new Map<ID, ProductVariantPrice>();

		const winners: Array<{
			variantId: ID;
			price: ProductPrice;
			originalAmount?: DecimalString;
			resolvedAmount: IResolvedAmount;
			notices: string[];
		}> = [];
		const resolved: IResolvedPrice[] = [];

		for (const [variantId, candidates] of eligible) {
			const notices: string[] = [];
			const amounts = await this.resolveCandidateAmounts(candidates, scope, legacy.get(variantId), notices, 0, []);
			const surviving = candidates.filter((row) => amounts.has(String(row.id)));

			if (!surviving.length) {
				unpriced.push(variantId);
				continue;
			}

			const price = this.pickWinner(surviving, amounts);

			winners.push({
				variantId,
				price,
				originalAmount: this.originalAmountFor(surviving, price, scope, amounts),
				resolvedAmount: amounts.get(String(price.id)) as IResolvedAmount,
				notices
			});
		}

		for (const winner of winners) {
			resolved.push(
				await this.describeResolution(
					winner.variantId,
					winner.price,
					scope,
					winner.originalAmount,
					winner.resolvedAmount,
					winner.notices,
					legacy.get(winner.variantId)
				)
			);
		}

		for (const variantId of unpriced) {
			const legacyPrice = legacy.get(variantId);

			if (!legacyPrice) {
				continue;
			}

			resolved.push(await this.describeLegacyResolution(variantId, legacyPrice, scope));
		}

		return resolved;
	}

	/**
	 * Turns the winning row into a resolution: the amount, what it derived from, the "was" amount, the
	 * tax basis and the human-readable account of the decision.
	 *
	 * The amount is the **resolved** one, which for a derived row is the number this resolver computed
	 * rather than a number the row stored — there is none to store. The base it derived from and the
	 * arithmetic that was applied are echoed with it, because the resolution is the sanctioned read path
	 * for a price: a caller that reads a derived row directly reads a null amount, and this is what
	 * makes that null interpretable instead of merely absent.
	 *
	 * @param variantId The variant being priced.
	 * @param price The winning row.
	 * @param scope The resolution scope.
	 * @param originalAmount The "was" amount, when there is a real higher price.
	 * @param resolvedAmount The amount the row resolved to, with its base and its computation.
	 * @param candidateNotices What the candidate pass recorded: a base that could not be resolved.
	 * @param legacyPrice The legacy variant price row, when one is needed for the margin floor.
	 * @returns The resolution.
	 */
	private async describeResolution(
		variantId: ID,
		price: ProductPrice,
		scope: IResolutionScope,
		originalAmount: DecimalString | undefined,
		resolvedAmount: IResolvedAmount,
		candidateNotices: string[] = [],
		legacyPrice?: ProductVariantPrice
	): Promise<IResolvedPrice> {
		const list = price.priceList;
		const amount = Money.of(resolvedAmount.amount, price.currency);
		const taxInclusive =
			price.taxInclusive ??
			list?.isTaxInclusive ??
			(await this.pricePreferenceService.resolveTaxInclusivity({
				currency: price.currency,
				regionId: scope.context.regionId
			})) ??
			false;

		const notices: string[] = [...candidateNotices];
		const marginNotice = this.marginNotice(price, resolvedAmount.amount, legacyPrice);

		if (marginNotice) {
			notices.push(marginNotice);
		}

		return {
			variantId,
			priceId: price.id,
			priceListId: list?.id,
			currency: price.currency,
			amount: this.toStorage(amount, 'resolved amount'),
			baseAmount: resolvedAmount.baseAmount,
			computation: resolvedAmount.computation,
			originalAmount,
			compareAtAmount: price.compareAtAmount != null ? String(price.compareAtAmount) : undefined,
			taxInclusive,
			source: list ? PriceSource.PRICE_LIST : PriceSource.DEFAULT_PRICE,
			matchedRules: this.traceOf(price, scope, taxInclusive),
			notices,
			explain: this.explain(price, scope, originalAmount, taxInclusive, notices, resolvedAmount)
		};
	}

	/**
	 * Turns a legacy variant price into a resolution: the last resort, reported as such so an
	 * operator can see that the variant is priced by the fallback rather than by a price list.
	 *
	 * @param variantId The variant being priced.
	 * @param legacyPrice The legacy row.
	 * @param scope The resolution scope.
	 * @returns The resolution.
	 */
	private async describeLegacyResolution(
		variantId: ID,
		legacyPrice: ProductVariantPrice,
		scope: IResolutionScope
	): Promise<IResolvedPrice> {
		const currency = (legacyPrice.retailPriceCurrency ?? scope.currency) as CurrencyCode;
		const amount = Money.fromStorage(legacyPrice.retailPrice, currency);
		const taxInclusive =
			(await this.pricePreferenceService.resolveTaxInclusivity({
				currency,
				regionId: scope.context.regionId
			})) ?? false;

		return {
			variantId,
			currency,
			amount: this.toStorage(amount, 'resolved amount'),
			taxInclusive,
			source: PriceSource.VARIANT_RETAIL_PRICE,
			matchedRules: [],
			explain:
				`No ${scope.currency} price row is configured for this variant, so the legacy variant retail price ` +
				`(${amount.amount} ${currency}) applies. Create a product price to price it from the pricing tables.`
		};
	}

	/**
	 * @param row A price row.
	 * @param scope The resolution scope.
	 * @returns Whether the row is a candidate for the context.
	 */
	private isCandidate(row: ProductPrice, scope: IResolutionScope): boolean {
		if (row.status !== PriceStatus.ACTIVE) {
			return false;
		}

		// Windows are half-open: a price that starts at an instant is in force from it, and a price that
		// ends at one is not in force at it.
		if (!this.windowContains(row.startsAt, row.endsAt, scope.at)) {
			return false;
		}

		if (!this.tierContains(row, scope)) {
			return false;
		}

		const list = row.priceList;

		if (!list) {
			return scope.priceListId === undefined;
		}

		// A dry run names the list it is asking about, and asking about a draft list is the whole point
		// of a dry run; every other eligibility rule still applies.
		const isDryRunOfThisList = scope.priceListId !== undefined && String(list.id) === String(scope.priceListId);

		if (!isDryRunOfThisList && list.status !== PriceListStatus.ACTIVE) {
			return false;
		}

		if (scope.priceListId !== undefined && !isDryRunOfThisList) {
			return false;
		}

		if (!this.windowContains(list.startsAt, list.endsAt, scope.at)) {
			return false;
		}

		if (list.currency && list.currency !== row.currency) {
			return false;
		}

		if (list.channelId && String(list.channelId) !== String(scope.context.channelId ?? '')) {
			return false;
		}

		if (list.regionId && String(list.regionId) !== String(scope.context.regionId ?? '')) {
			return false;
		}

		if (
			list.customerGroupId &&
			!(scope.context.customerGroupIds ?? []).some((groupId) => String(groupId) === String(list.customerGroupId))
		) {
			return false;
		}

		return true;
	}

	/**
	 * Orders candidates by the documented tie-break chain and returns the winner.
	 *
	 * @param candidates The candidates of one variant, all eligible and all with a resolved amount.
	 * @param amounts What each candidate resolved to.
	 * @returns The winning row.
	 */
	private pickWinner(candidates: ProductPrice[], amounts: Map<string, IResolvedAmount>): ProductPrice {
		const ordered = [...candidates].sort((left, right) => this.compareCandidates(left, right, amounts));
		const override = ordered.find((row) => row.priceList?.type === PriceListType.OVERRIDE);

		if (override) {
			// An eligible OVERRIDE list wins outright: that is what makes it a contract price rather than
			// a promotional one. Two of them at the same priority for one context is a configuration
			// error, not a matter of ordering — choosing one silently would make a negotiated price
			// depend on row order, so the resolution refuses instead.
			const rival = ordered.find(
				(row) =>
					row !== override &&
					row.priceList?.type === PriceListType.OVERRIDE &&
					(row.priceList?.priority ?? 0) === (override.priceList?.priority ?? 0) &&
					String(row.priceList?.id) !== String(override.priceList?.id)
			);

			if (rival) {
				throw new BadRequestException(
					`PRICE_OVERRIDE_AMBIGUOUS: the override lists "${override.priceList?.code}" and ` +
						`"${rival.priceList?.code}" both apply at priority ${override.priceList?.priority ?? 0}. ` +
						'Lower the priority of one of them, or narrow its scope so that only one can match.'
				);
			}

			return override;
		}

		const sale = ordered.find((row) => row.priceList?.type === PriceListType.SALE);
		const base = ordered.find((row) => !row.priceList);

		if (sale && base) {
			// A tie goes to the sale: a deliberate discount is the intent the operator expressed.
			return this.compareAmounts(
				this.amountOf(sale, amounts),
				this.amountOf(base, amounts),
				sale.currency
			) <= 0
				? sale
				: base;
		}

		return sale ?? base;
	}

	/**
	 * The documented tie-break chain: a list-bearing price before a default one, an `OVERRIDE` list
	 * first, higher priority first, lower **resolved** amount first, and finally the identifier — which
	 * makes the order total so that the same context always produces the same winner.
	 *
	 * @param left One candidate.
	 * @param right Another candidate.
	 * @param amounts What each candidate resolved to.
	 * @returns The comparison result.
	 */
	private compareCandidates(
		left: ProductPrice,
		right: ProductPrice,
		amounts: Map<string, IResolvedAmount>
	): number {
		const leftList = left.priceList;
		const rightList = right.priceList;

		if (!!leftList !== !!rightList) {
			return leftList ? -1 : 1;
		}

		if (leftList && rightList) {
			const leftOverride = leftList.type === PriceListType.OVERRIDE;
			const rightOverride = rightList.type === PriceListType.OVERRIDE;

			if (leftOverride !== rightOverride) {
				return leftOverride ? -1 : 1;
			}

			if ((leftList.priority ?? 0) !== (rightList.priority ?? 0)) {
				return (rightList.priority ?? 0) - (leftList.priority ?? 0);
			}
		}

		const byAmount = this.compareAmounts(
			this.amountOf(left, amounts),
			this.amountOf(right, amounts),
			left.currency
		);

		return byAmount !== 0 ? byAmount : String(left.id).localeCompare(String(right.id));
	}

	/**
	 * @param row A candidate.
	 * @param amounts What the candidates resolved to.
	 * @returns The amount the row competes on — its derived amount for a derived row, its stored one
	 * otherwise. The stored amount is the fallback only for a row this pass did not resolve, which
	 * cannot reach the tie-break because an unresolved candidate is eliminated before it.
	 */
	private amountOf(row: ProductPrice, amounts: Map<string, IResolvedAmount>): DecimalString {
		return amounts.get(String(row.id))?.amount ?? (row.amount as DecimalString) ?? '0';
	}

	/**
	 * The "was" price: the lowest list price that was not a `SALE`, else the default price, and
	 * nothing at all when the result would not be higher than what is charged — a strike-through that
	 * is not a real reduction is worse than no strike-through.
	 *
	 * @param candidates Every eligible candidate of one variant.
	 * @param winner The winning row.
	 * @param scope The resolution scope.
	 * @param amounts What each candidate resolved to.
	 * @returns The original amount, or undefined.
	 */
	private originalAmountFor(
		candidates: ProductPrice[],
		winner: ProductPrice,
		scope: IResolutionScope,
		amounts: Map<string, IResolvedAmount>
	): DecimalString | undefined {
		const references = candidates.filter((row) => row.priceList && row.priceList.type !== PriceListType.SALE);
		const reference = references.length
			? references
					.map((row) => this.amountOf(row, amounts))
					.reduce((lowest, amount) =>
						this.compareAmounts(amount, lowest, scope.currency) < 0 ? amount : lowest
					)
			: candidates.find((row) => !row.priceList)
			? this.amountOf(candidates.find((row) => !row.priceList) as ProductPrice, amounts)
			: undefined;

		if (reference == null) {
			return undefined;
		}

		return this.compareAmounts(reference, this.amountOf(winner, amounts), scope.currency) > 0
			? reference
			: undefined;
	}

	/*
	|--------------------------------------------------------------------------
	| Derivation
	|--------------------------------------------------------------------------
	*/

	/**
	 * Resolves what each candidate actually costs.
	 *
	 * A candidate whose `computeMode` is `AMOUNT` resolves to the number it stores. A `PERCENT_OFF`
	 * candidate resolves to `base × (1 − percent / 100)`, then quantised to `roundTo` when it states
	 * one — **before** the currency rounding boundary, which the caller applies, because a price ending
	 * is a merchandising decision about a price and not a property of a currency.
	 *
	 * A candidate whose base cannot be resolved is left out of the map rather than given a substitute
	 * amount, and the elimination is recorded as `PRICE_BASE_UNRESOLVED`. Comparing such a candidate on
	 * a guessed number would make it win a price the base does not support; the honest answer is that
	 * the candidate has no price, and the caller is told which row and why.
	 *
	 * @param candidates The eligible candidates of one variant.
	 * @param scope The resolution scope.
	 * @param legacyPrice The legacy variant price row, which two of the three bases read.
	 * @param notices Collects the eliminations, so a caller sees why a row did not compete.
	 * @param depth How deep the chain of derived lists already is.
	 * @param visited The lists already walked, which is what makes a cycle detectable.
	 * @returns The resolved amount of every candidate whose base resolved, by row identifier.
	 */
	private async resolveCandidateAmounts(
		candidates: ProductPrice[],
		scope: IResolutionScope,
		legacyPrice: ProductVariantPrice | undefined,
		notices: string[],
		depth: number,
		visited: ID[]
	): Promise<Map<string, IResolvedAmount>> {
		const amounts = new Map<string, IResolvedAmount>();

		for (const row of candidates) {
			if (row.computeMode !== PriceComputeMode.PERCENT_OFF) {
				if (row.amount == null) {
					notices.push(
						`PRICE_BASE_UNRESOLVED: the price ${row.id} states neither an amount nor a derivation, so it did not compete.`
					);

					continue;
				}

				amounts.set(String(row.id), {
					amount: this.toStorage(Money.fromStorage(row.amount, row.currency), 'amount'),
					computation: { computeMode: PriceComputeMode.AMOUNT }
				});

				continue;
			}

			const baseAmount = await this.resolveBase(row, scope, legacyPrice, depth, visited);

			if (baseAmount == null) {
				notices.push(
					`PRICE_BASE_UNRESOLVED: the price ${row.id} derives its amount from ${row.baseSource}` +
						`${row.basePriceListId ? ` (${row.basePriceListId})` : ''}, which has no amount for this variant and context, so the row did not compete.`
				);

				continue;
			}

			amounts.set(String(row.id), {
				amount: this.deriveAmount(row, baseAmount),
				baseAmount: this.toStorage(Money.of(baseAmount, row.currency), 'base amount'),
				computation: this.computationOf(row)
			});
		}

		return amounts;
	}

	/**
	 * @param row A price row.
	 * @returns Whether the row derives its price and starts from the legacy variant price.
	 */
	private baseNeedsLegacyPrice(row: ProductPrice): boolean {
		if (row.computeMode !== PriceComputeMode.PERCENT_OFF) {
			return false;
		}

		return row.baseSource === PriceBaseSource.LIST || row.baseSource === PriceBaseSource.COST;
	}

	/**
	 * @param row A derived price row.
	 * @returns The arithmetic the row states, as the resolution echoes it back.
	 */
	private computationOf(row: ProductPrice): IPriceComputation {
		return {
			computeMode: PriceComputeMode.PERCENT_OFF,
			percent: row.percent != null ? String(row.percent) : undefined,
			baseSource: row.baseSource,
			basePriceListId: row.basePriceListId,
			roundTo: row.roundTo != null ? String(row.roundTo) : undefined
		};
	}

	/**
	 * Applies a row's share and its price ending to a base.
	 *
	 * Both steps go through the platform money helper, so a derived price is a price the ledger would
	 * also compute: the share is a subtraction of `base × share`, not a multiplication by
	 * `1 − share / 100` evaluated in floating point, and the ending is the money layer's own
	 * quantisation to an increment.
	 *
	 * @param row The derived row.
	 * @param baseAmount The base it derives from, in the row's currency.
	 * @returns The derived amount, at the storage scale, before the currency rounding boundary.
	 */
	private deriveAmount(row: ProductPrice, baseAmount: DecimalString): DecimalString {
		const currency = row.currency;
		const base = Money.of(baseAmount, currency);
		const share = Money.of(row.percent ?? '0', currency);
		const reduction = base.multiply(share.amount).divide('100');
		const derived = base.subtract(reduction);

		if (row.roundTo == null) {
			return this.toStorage(derived, 'derived amount');
		}

		// The ending is applied to the derived amount and before the currency rounding boundary: a price
		// ending is a merchandising decision about a price, not a property of a currency.
		return this.toStorage(derived.roundToIncrement(row.roundTo).rounded, 'derived amount');
	}

	/**
	 * Resolves the base a derived row starts from.
	 *
	 * The three bases are deliberately different kinds of answer: `LIST` is the legacy variant retail
	 * price, converted through the exchange-rate table when it is stated in another currency and failing
	 * **closed** with `PRICE_BASE_CURRENCY_MISMATCH` when no rate covers the pair, because a silent
	 * conversion can price a product below cost; `COST` is the row's own cost snapshot, else the legacy
	 * variant unit cost; and `PRICE_LIST` is the resolved amount of another list for the same variant
	 * and context, followed at most five lists deep and refused when the chain loops.
	 *
	 * @param row The derived row.
	 * @param scope The resolution scope.
	 * @param legacyPrice The legacy variant price row.
	 * @param depth How deep the chain of derived lists already is.
	 * @param visited The lists already walked.
	 * @returns The base amount in the row's currency, or undefined when there is none.
	 * @throws BadRequestException when a `LIST` base is stated in an unconvertible currency, or when the
	 * chain of derived lists returns to a list it has already read.
	 */
	private async resolveBase(
		row: ProductPrice,
		scope: IResolutionScope,
		legacyPrice: ProductVariantPrice | undefined,
		depth: number,
		visited: ID[]
	): Promise<DecimalString | undefined> {
		switch (row.baseSource) {
			case PriceBaseSource.LIST: {
				if (legacyPrice?.retailPrice == null) {
					return undefined;
				}

				const retailCurrency = (legacyPrice.retailPriceCurrency ?? row.currency) as CurrencyCode;

				if (retailCurrency === row.currency) {
					return String(legacyPrice.retailPrice);
				}

				try {
					const converted = await this.exchangeRateService.convert(
						legacyPrice.retailPrice,
						retailCurrency,
						row.currency,
						scope.at
					);

					return converted.amount;
				} catch (error) {
					throw new BadRequestException(
						`PRICE_BASE_CURRENCY_MISMATCH: the row ${row.id} derives from a retail price in ${retailCurrency} ` +
							`and no ${retailCurrency}/${row.currency} rate covers ${scope.at.toISOString()}, so its amount cannot be computed. ` +
							`Record the rate, or state the base in ${row.currency}.`
					);
				}
			}

			case PriceBaseSource.COST: {
				const cost = row.costAmount ?? legacyPrice?.unitCost;

				return cost == null ? undefined : String(cost);
			}

			case PriceBaseSource.PRICE_LIST: {
				if (!row.basePriceListId || depth >= MAX_BASE_LIST_DEPTH) {
					return undefined;
				}

				if (visited.some((listId) => String(listId) === String(row.basePriceListId))) {
					throw new BadRequestException(
						`PRICE_BASE_CYCLE: the chain of derived price lists returns to ${row.basePriceListId}, so no amount in it is ever computed.`
					);
				}

				return await this.resolveListAmount(
					row,
					scope,
					legacyPrice,
					depth + 1,
					[...visited, row.basePriceListId]
				);
			}

			default:
				return undefined;
		}
	}

	/**
	 * Resolves the amount one base list states for a variant and context.
	 *
	 * The base list is resolved by the ordinary algorithm, restricted to that list: its own rows are
	 * candidates, its own derivation is followed, and the winner's **resolved** amount is what the
	 * derived row reads. That is what makes a price book follow its base instead of going stale — and it
	 * is also why the depth is capped: a chain of lists each deriving from the next is a configuration
	 * an operator can build by accident, and an unbounded walk would answer it with a stack overflow
	 * rather than an explanation.
	 *
	 * @param row The derived row, whose currency and variant the base list is read for.
	 * @param scope The resolution scope.
	 * @param legacyPrice The legacy variant price row.
	 * @param depth How deep the chain already is.
	 * @param visited The lists already walked.
	 * @returns The base list's resolved amount, or undefined when it states none.
	 */
	private async resolveListAmount(
		row: ProductPrice,
		scope: IResolutionScope,
		legacyPrice: ProductVariantPrice | undefined,
		depth: number,
		visited: ID[]
	): Promise<DecimalString | undefined> {
		const { tenantId, organizationId } = this.scope;
		const rows = await this.typeOrmProductPriceRepository.find({
			where: {
				tenantId,
				organizationId,
				variantId: row.variantId,
				currency: row.currency,
				priceListId: row.basePriceListId
			} as FindOptionsWhere<ProductPrice>,
			relations: { priceList: true }
		});

		const candidates = rows.filter((candidate) => this.isCandidate(candidate, scope));

		if (!candidates.length) {
			return undefined;
		}

		const notices: string[] = [];
		const amounts = await this.resolveCandidateAmounts(candidates, scope, legacyPrice, notices, depth, visited);
		const surviving = candidates.filter((candidate) => amounts.has(String(candidate.id)));

		if (!surviving.length) {
			return undefined;
		}

		const winner = this.pickWinner(surviving, amounts);

		return amounts.get(String(winner.id))?.amount;
	}

	/*
	|--------------------------------------------------------------------------
	| Validation helpers
	|--------------------------------------------------------------------------
	*/

	/**
	 * Normalises an incoming price and refuses the shapes the money layer cannot carry.
	 *
	 * The row is read as a whole — an amount and a derivation are mutually exclusive, so validating
	 * either one alone would accept a row that states a price and a way of computing a different one.
	 *
	 * @param entity The price as it arrived.
	 * @returns The price with canonical currency, exact decimals and the caller's organization.
	 * @throws BadRequestException when the row is not a usable price: no organization, no currency, a
	 * shape that states neither an amount nor a derivation, or one that states both.
	 */
	private prepare(entity: DeepPartial<ProductPrice>): DeepPartial<ProductPrice> {
		const { organizationId } = this.scope;

		if (!organizationId) {
			throw new BadRequestException('PRICE_ORGANIZATION_REQUIRED: prices are written inside an organization.');
		}

		if (entity.organizationId && String(entity.organizationId) !== String(organizationId)) {
			throw new BadRequestException('PRICE_ORGANIZATION_MISMATCH: a price belongs to the caller\'s organization.');
		}

		const currency = this.normalizeCurrency(entity.currency);
		const computeMode = (entity.computeMode as PriceComputeMode) ?? PriceComputeMode.AMOUNT;

		// `variantId` is deliberately **not** required. A row without one is open-scoped: its
		// applicability is exactly its `rule` rows with `ownerType = PRICE`, and it prices every variant
		// they select. Those rules are written through the platform rule resource rather than here, so
		// this service cannot insist on one at write time — what it can do, and does, is refuse a
		// configuration whose base or share is unusable, and leave "an open row without a rule prices the
		// whole catalogue" to the price-list validation the operator runs before activating a list.
		const prepared: DeepPartial<ProductPrice> = {
			...entity,
			organizationId,
			currency,
			computeMode,
			status: (entity.status as PriceStatus) ?? PriceStatus.ACTIVE,
			compareAtAmount: this.readOptionalDecimal(entity.compareAtAmount, 'compareAtAmount', currency),
			costAmount: this.readOptionalDecimal(entity.costAmount, 'costAmount', currency),
			minMarginPercent: this.readOptionalDecimal(entity.minMarginPercent, 'minMarginPercent', currency),
			maxDiscountPercent: this.readOptionalDecimal(entity.maxDiscountPercent, 'maxDiscountPercent', currency),
			roundTo: this.readOptionalDecimal(entity.roundTo, 'roundTo', currency),
			percent: this.readOptionalDecimal(entity.percent, 'percent', currency)
		};

		this.prepareComputation(prepared, entity, currency);

		if (prepared.minQuantity != null && prepared.maxQuantity != null) {
			const min = Money.of(prepared.minQuantity, currency);
			const max = Money.of(prepared.maxQuantity, currency);

			if (min.greaterThan(max)) {
				throw new BadRequestException(
					`PRICE_TIER_INVALID: minQuantity (${prepared.minQuantity}) must not exceed maxQuantity (${prepared.maxQuantity}).`
				);
			}
		}

		return prepared;
	}

	/**
	 * Reads and validates the pair — an amount, or a derivation — that states what the row costs.
	 *
	 * The two are mutually exclusive by construction, which is the whole point of the mode: a row that
	 * stated both would leave every consumer to choose one, and the choice would be made differently in
	 * the resolver, in the invoice bridge and in an export. The check constraints state the same rule on
	 * the dialects that have them; this is where it is stated for every dialect, including the one that
	 * cannot.
	 *
	 * @param prepared The row being assembled, which this fills in.
	 * @param entity The row as it arrived.
	 * @param currency Currency the row is priced in.
	 * @throws BadRequestException when the row states an amount and a derivation, or neither, or a
	 * derivation whose base, share or ending is missing or out of range.
	 */
	private prepareComputation(
		prepared: DeepPartial<ProductPrice>,
		entity: DeepPartial<ProductPrice>,
		currency: CurrencyCode
	): void {
		const computeMode = prepared.computeMode as PriceComputeMode;
		const hasAmount = entity.amount !== undefined && entity.amount !== null && entity.amount !== '';
		const percent = prepared.percent;
		const baseSource = prepared.baseSource as PriceBaseSource | undefined;
		const basePriceListId = prepared.basePriceListId as ID | undefined;

		if (prepared.roundTo != null && !Money.of(prepared.roundTo, currency).isPositive()) {
			throw new BadRequestException(
				'PRICE_ROUND_TO_INVALID: a price ending is a positive multiple; a price rounded to zero has no amount.'
			);
		}

		if (computeMode === PriceComputeMode.AMOUNT) {
			if (!hasAmount) {
				throw new BadRequestException(
					'PRICE_AMOUNT_REQUIRED: a price row either states its amount or derives one from a base.'
				);
			}

			if (percent != null || baseSource != null || basePriceListId != null) {
				throw new BadRequestException(
					'PRICE_COMPUTE_MODE_FIELDS: an amount row states neither a share nor a base; declare computeMode PERCENT_OFF to derive its price.'
				);
			}

			const amount = this.toMoney(entity.amount, 'amount', currency);

			if (amount.isNegative()) {
				throw new BadRequestException('PRICE_AMOUNT_NEGATIVE: a price is never negative.');
			}

			prepared.amount = this.toStorage(amount, 'amount');

			return;
		}

		if (hasAmount) {
			throw new BadRequestException(
				'PRICE_COMPUTE_MODE_FIELDS: a derived row stores no amount — the price is what its base and its share compute to, so storing one would be a second answer that goes stale.'
			);
		}

		if (percent == null) {
			throw new BadRequestException(
				`PRICE_PERCENT_REQUIRED: computeMode ${PriceComputeMode.PERCENT_OFF} derives the price from a share of a base, and none was given.`
			);
		}

		// A signed fraction, not a percentage: `0.250000` is 25 % off and `-0.150000` is a 15 % markup.
		// The floor is deliberately far below any real cost-plus: it is a guard against a value that is
		// arithmetically meaningless rather than a commercial limit.
		if (Money.of(percent, currency).lessThanOrEqual(Money.of('-1000', currency))) {
			throw new BadRequestException('PRICE_PERCENT_RANGE: a share is greater than -1000.');
		}

		if (Money.of(percent, currency).greaterThan(Money.of('100', currency))) {
			throw new BadRequestException(
				'PRICE_PERCENT_RANGE: a share of more than 100 would make the derived price negative.'
			);
		}

		if (!baseSource) {
			throw new BadRequestException(
				'PRICE_BASE_SOURCE_REQUIRED: a derived price states the base it derives from — LIST, COST or PRICE_LIST.'
			);
		}

		if (baseSource === PriceBaseSource.PRICE_LIST) {
			if (!basePriceListId) {
				throw new BadRequestException(
					'PRICE_BASE_UNRESOLVED: a PRICE_LIST derivation names the list it reads.'
				);
			}

			if (prepared.priceListId != null && String(basePriceListId) === String(prepared.priceListId)) {
				throw new BadRequestException(
					'PRICE_BASE_CYCLE: a list cannot derive from itself, because its price would then be defined in terms of itself.'
				);
			}
		} else if (basePriceListId != null) {
			throw new BadRequestException(
				'PRICE_COMPUTE_MODE_FIELDS: only a PRICE_LIST derivation names a base list; this row names one beside another base.'
			);
		}

		prepared.amount = null as unknown as DecimalString;
	}

	/**
	 * Refuses a derivation whose chain of base lists loops or is deeper than the resolver will follow.
	 *
	 * The write-time half of the acyclicity rule: the resolver also refuses a cycle it meets, because a
	 * chain can be made cyclic by an update on the other side of it, but a cycle caught here is caught
	 * by the caller who created it and can be explained to them.
	 *
	 * @param entity The prepared row.
	 * @param visited The lists already walked up the chain.
	 * @throws BadRequestException with `PRICE_BASE_CYCLE` when the chain returns to a list it has
	 * already read, or with `PRICE_BASE_CHAIN_TOO_DEEP` when it exceeds the resolution depth cap.
	 */
	private async assertBaseChainIsUsable(entity: DeepPartial<ProductPrice>, visited: ID[]): Promise<void> {
		if (entity.computeMode !== PriceComputeMode.PERCENT_OFF) {
			return;
		}

		const basePriceListId = entity.basePriceListId as ID | undefined;

		if ((entity.baseSource as PriceBaseSource) !== PriceBaseSource.PRICE_LIST || !basePriceListId) {
			return;
		}

		if (visited.some((listId) => String(listId) === String(basePriceListId))) {
			throw new BadRequestException(
				`PRICE_BASE_CYCLE: the chain of derived price lists returns to ${basePriceListId}, so no amount in it is ever computed.`
			);
		}

		if (visited.length + 1 > MAX_BASE_LIST_DEPTH) {
			throw new BadRequestException(
				`PRICE_BASE_CHAIN_TOO_DEEP: a chain of derived price lists is followed at most ${MAX_BASE_LIST_DEPTH} lists deep.`
			);
		}

		const { tenantId, organizationId } = this.scope;
		const base = await this.typeOrmProductPriceRepository.findOne({
			where: {
				tenantId,
				organizationId,
				priceListId: basePriceListId,
				computeMode: PriceComputeMode.PERCENT_OFF
			} as FindOptionsWhere<ProductPrice>
		});

		if (!base) {
			return;
		}

		await this.assertBaseChainIsUsable(base, [...visited, basePriceListId]);
	}

	/**
	 * @param entity The prepared price.
	 * @throws BadRequestException when a band of the same `(variant, currency, price list)` tuple
	 * overlaps it, because two overlapping bands make the answer depend on row order.
	 */
	private async assertTierIsFree(entity: DeepPartial<ProductPrice>): Promise<void> {
		const { tenantId, organizationId } = this.scope;
		const rows = await this.typeOrmProductPriceRepository.find({
			where: {
				tenantId,
				organizationId,
				// An open-scoped row's variant is null rather than absent, so the bands it is compared
				// against are the other open rows of the same tuple and not every variant's.
				variantId: entity.variantId ?? IsNull(),
				currency: entity.currency,
				priceListId: entity.priceListId ?? IsNull(),
				...(entity.id ? { id: Not(entity.id as ID) } : {})
			} as FindOptionsWhere<ProductPrice>
		});

		const currency = entity.currency as CurrencyCode;
		const overlapping = rows.find((row) =>
			this.tiersOverlap(entity.minQuantity, entity.maxQuantity, row.minQuantity, row.maxQuantity, currency)
		);

		if (overlapping) {
			throw new BadRequestException(
				`PRICE_TIER_OVERLAP: the band ${entity.minQuantity ?? '−∞'}–${entity.maxQuantity ?? '+∞'} overlaps the ` +
					`existing band ${overlapping.minQuantity ?? '−∞'}–${overlapping.maxQuantity ?? '+∞'} of the same ` +
					'variant, currency and price list.'
			);
		}
	}

	/**
	 * @param leftMin Lower bound of the incoming band.
	 * @param leftMax Upper bound of the incoming band.
	 * @param rightMin Lower bound of an existing band.
	 * @param rightMax Upper bound of an existing band.
	 * @param currency Currency the bounds are quantities in.
	 * @returns Whether the two bands share a quantity. A null bound is open, so an unbounded band
	 * overlaps everything.
	 */
	private tiersOverlap(
		leftMin: DecimalString | undefined,
		leftMax: DecimalString | undefined,
		rightMin: DecimalString | undefined,
		rightMax: DecimalString | undefined,
		currency: CurrencyCode
	): boolean {
		const leftStartsBelowRightEnd =
			leftMin == null || rightMax == null || Money.of(leftMin, currency).lessThanOrEqual(Money.of(rightMax, currency));
		const rightStartsBelowLeftEnd =
			rightMin == null || leftMax == null || Money.of(rightMin, currency).lessThanOrEqual(Money.of(leftMax, currency));

		return leftStartsBelowRightEnd && rightStartsBelowLeftEnd;
	}

	/**
	 * @param entity The prepared price.
	 * @throws BadRequestException when the price is stated with a cost and sits below
	 * `costAmount ÷ (1 − minMarginPercent)`, which is the floor the same guard rail is checked
	 * against at resolution time.
	 */
	private assertMarginFloor(entity: DeepPartial<ProductPrice>): void {
		if (entity.minMarginPercent == null || entity.costAmount == null || entity.amount == null) {
			return;
		}

		const currency = entity.currency as CurrencyCode;
		const floor = this.minimumPriceForMargin(entity.costAmount, entity.minMarginPercent, currency);
		const amount = Money.of(entity.amount, currency);

		if (amount.lessThan(floor)) {
			throw new BadRequestException(
				`PRICE_BELOW_MIN_MARGIN: ${amount.amount} is below the minimum price ${floor.amount} for a ` +
					`${entity.minMarginPercent} margin on a cost of ${entity.costAmount}.`
			);
		}
	}

	/**
	 * The floor a price may not fall below for a stated margin.
	 *
	 * @param cost The cost to cover.
	 * @param minMarginPercent The floor as a fraction, e.g. `0.250000` for 25 %.
	 * @param currency Currency the two are expressed in.
	 * @returns The minimum price.
	 */
	private minimumPriceForMargin(
		cost: DecimalString | number,
		minMarginPercent: DecimalString | number,
		currency: CurrencyCode
	): Money {
		const fraction = this.toMoney(minMarginPercent, 'minMarginPercent', currency);
		const divisor = Money.of('1', currency).subtract(fraction);

		if (!divisor.isPositive()) {
			throw new BadRequestException(
				'PRICE_BELOW_MIN_MARGIN: minMarginPercent must be below 1 (100 %), otherwise no price can satisfy it.'
			);
		}

		return this.toMoney(cost, 'costAmount', currency).divide(divisor.amount);
	}

	/**
	 * @param price A price row that is being resolved.
	 * @param resolvedAmount The amount the row resolved to — its derived amount for a derived row.
	 * @param legacyPrice The legacy variant price row, when one was read.
	 * @returns The margin notice, or undefined when the row states no floor, no cost is known, or the
	 * price is at or above the floor.
	 */
	private marginNotice(
		price: ProductPrice,
		resolvedAmount: DecimalString,
		legacyPrice?: ProductVariantPrice
	): string | undefined {
		if (price.minMarginPercent == null) {
			return undefined;
		}

		const cost = price.costAmount ?? legacyPrice?.unitCost;

		if (cost == null) {
			return undefined;
		}

		const floor = this.minimumPriceForMargin(cost, price.minMarginPercent, price.currency);
		const amount = Money.of(resolvedAmount, price.currency);

		return amount.lessThan(floor)
			? `MARGIN_BELOW_MINIMUM: ${amount.amount} ${price.currency} is below the ${price.minMarginPercent} margin floor of ${floor.amount}.`
			: undefined;
	}

	/*
	|--------------------------------------------------------------------------
	| Reading and formatting helpers
	|--------------------------------------------------------------------------
	*/

	/**
	 * Reads the legacy `product_variant_price` rows of the requested variants.
	 *
	 * The table is owned by the catalogue and reused here unchanged: it is the fallback a variant with
	 * no price row resolves to, and it also carries the last-resort cost the margin guard measures
	 * against. It is read through whichever ORM is active — the two spell set membership differently —
	 * and never written.
	 *
	 * @param variantIds The variants to read.
	 * @returns The legacy rows by variant.
	 */
	private async findLegacyPrices(variantIds: ID[]): Promise<Map<ID, ProductVariantPrice>> {
		const { tenantId, organizationId } = this.scope;
		const prices = new Map<ID, ProductVariantPrice>();

		if (this.ormType === MultiORMEnum.MikroORM) {
			const rows = await this.mikroOrmProductPriceRepository.getEntityManager().find(
				ProductVariantPrice,
				{ tenantId, organizationId, productVariant: { id: { $in: variantIds } } } as any,
				{ populate: ['productVariant'] } as any
			);

			for (const row of rows) {
				const variantId = (row as any).productVariant?.id;

				if (variantId) {
					prices.set(variantId, row);
				}
			}

			return prices;
		}

		const rows = await this.typeOrmProductPriceRepository.manager.find(ProductVariantPrice, {
			where: { tenantId, organizationId, productVariant: { id: In(variantIds) } } as any,
			relations: { productVariant: true }
		});

		for (const row of rows) {
			const variantId = (row as any).productVariant?.id;

			if (variantId) {
				prices.set(variantId, row);
			}
		}

		return prices;
	}

	/**
	 * @param row A price row.
	 * @param scope The resolution scope.
	 * @returns Whether the row's quantity band contains the quantity being priced.
	 */
	private tierContains(row: ProductPrice, scope: IResolutionScope): boolean {
		if (row.minQuantity != null && this.compareAmounts(scope.quantity, row.minQuantity, scope.currency) < 0) {
			return false;
		}

		if (row.maxQuantity != null && this.compareAmounts(scope.quantity, row.maxQuantity, scope.currency) > 0) {
			return false;
		}

		return true;
	}

	/**
	 * @param startsAt Start of a window, when one is stated.
	 * @param endsAt End of a window, when one is stated.
	 * @param at The instant being priced.
	 * @returns Whether the half-open window contains the instant.
	 */
	private windowContains(startsAt: Date | undefined, endsAt: Date | undefined, at: Date): boolean {
		if (startsAt && new Date(startsAt).getTime() > at.getTime()) {
			return false;
		}

		if (endsAt && new Date(endsAt).getTime() <= at.getTime()) {
			return false;
		}

		return true;
	}

	/**
	 * @param left One exact amount.
	 * @param right Another exact amount.
	 * @param currency Currency both are expressed in.
	 * @returns -1, 0 or 1, compared as exact decimals and never by subtracting two numbers.
	 */
	private compareAmounts(left: DecimalString | number, right: DecimalString | number, currency: CurrencyCode): number {
		return Money.of(left, currency).compare(Money.of(right, currency));
	}

	/**
	 * The conditions the resolution applied to the winning row, as a trace an operator can read.
	 *
	 * @param price The winning row.
	 * @param scope The resolution scope.
	 * @param taxInclusive The tax basis that was resolved.
	 * @returns The trace.
	 */
	private traceOf(price: ProductPrice, scope: IResolutionScope, taxInclusive: boolean): string[] {
		const list = price.priceList;
		const trace: string[] = [];

		if (list) {
			trace.push(`price-list:${list.code}`);
		}

		if (list?.channelId) {
			trace.push(`channel:${list.channelId}`);
		}

		if (list?.regionId) {
			trace.push(`region:${list.regionId}`);
		}

		if (list?.customerGroupId) {
			trace.push(`customer-group:${list.customerGroupId}`);
		}

		if (price.minQuantity != null || price.maxQuantity != null) {
			trace.push(`tier:${price.minQuantity ?? '-inf'}..${price.maxQuantity ?? 'inf'}`);
		}

		if (price.startsAt || price.endsAt) {
			trace.push('price-window');
		}

		if (list?.startsAt || list?.endsAt) {
			trace.push('list-window');
		}

		trace.push(taxInclusive ? 'tax-inclusive' : 'tax-exclusive');
		trace.push(`context:${scope.currency}@${scope.at.toISOString()}`);

		return trace;
	}

	/**
	 * @param price The winning row.
	 * @param scope The resolution scope.
	 * @param originalAmount The "was" amount, when there is one.
	 * @param taxInclusive The tax basis that was resolved.
	 * @param notices Any notices the resolution produced.
	 * @param resolvedAmount What the row resolved to, with its arithmetic.
	 * @returns One sentence an operator can act on.
	 */
	private explain(
		price: ProductPrice,
		scope: IResolutionScope,
		originalAmount: DecimalString | undefined,
		taxInclusive: boolean,
		notices: string[],
		resolvedAmount: IResolvedAmount
	): string {
		const list = price.priceList;
		const amount = Money.of(resolvedAmount.amount, price.currency);
		const origin = list
			? `the ${list.type.toLowerCase()} price list "${list.name}"`
			: 'the variant default price';
		const tier =
			price.minQuantity != null || price.maxQuantity != null
				? ` for the quantity band ${price.minQuantity ?? '−∞'}–${price.maxQuantity ?? '+∞'}`
				: '';
		const derivation = resolvedAmount.baseAmount
			? ` The price was derived from a base of ${resolvedAmount.baseAmount} ${price.currency} at a share of ` +
			  `${resolvedAmount.computation.percent} (${resolvedAmount.computation.baseSource})` +
			  `${resolvedAmount.computation.roundTo ? `, rounded to ${resolvedAmount.computation.roundTo}` : ''}.`
			: '';
		const original = originalAmount ? ` It replaces ${originalAmount} ${price.currency}.` : '';
		const tax = taxInclusive ? ' Tax is included in the amount.' : ' Tax is not included in the amount.';

		return (
			`Resolved ${amount.amount} ${price.currency} from ${origin}${tier} for quantity ` +
			`${scope.quantity} at ${scope.at.toISOString()}.${derivation}${original}${tax}` +
			(notices.length ? ` ${notices.join(' ')}` : '')
		);
	}

	/**
	 * @param value A value from a caller.
	 * @param field Field name, named in the error.
	 * @param currency Currency the decimal is carried in.
	 * @returns The exact decimal at the storage scale, or undefined when the field was not supplied.
	 */
	private readOptionalDecimal(
		value: DecimalString | number | undefined | null,
		field: string,
		currency: CurrencyCode
	): DecimalString | undefined {
		if (value === undefined || value === null || value === '') {
			return undefined;
		}

		return this.toStorage(this.toMoney(value, field, currency), field);
	}

	/**
	 * @param variantIds The variants a caller asked about.
	 * @returns The distinct identifiers, with the empty ones dropped.
	 */
	private readVariantIds(variantIds: ID[] | undefined): ID[] {
		return [...new Set((variantIds ?? []).filter((variantId) => !!variantId))];
	}

	/**
	 * @param date An instant from a caller.
	 * @returns The instant, defaulting to now.
	 * @throws BadRequestException when the value is not a date.
	 */
	private readInstant(date?: Date): Date {
		if (date === undefined || date === null) {
			return new Date();
		}

		const instant = new Date(date);

		if (Number.isNaN(instant.getTime())) {
			throw new BadRequestException(`PRICE_INVALID_DATE: "${date}" is not an instant.`);
		}

		return instant;
	}

	/**
	 * @param currency A currency code from a caller.
	 * @returns The code, trimmed and upper-cased.
	 */
	private normalizeCurrency(currency: CurrencyCode): CurrencyCode {
		const code = typeof currency === 'string' ? currency.trim().toUpperCase() : '';

		if (code.length !== 3) {
			throw new BadRequestException(`PRICE_INVALID_CURRENCY: "${currency}" is not a three-letter currency code.`);
		}

		return code;
	}

	/**
	 * @param value An exact decimal from a caller.
	 * @param field Field name, named in the error.
	 * @param currency Currency the decimal is carried in.
	 * @returns The value.
	 * @throws BadRequestException when the value is not a decimal the money layer can hold.
	 */
	private toMoney(value: DecimalString | number, field: string, currency: CurrencyCode): Money {
		try {
			return Money.of(value, currency);
		} catch {
			throw new BadRequestException(`PRICE_INVALID_DECIMAL: ${field} must be an exact decimal.`);
		}
	}

	/**
	 * @param value A monetary value.
	 * @param field Field name, named in the error.
	 * @returns The value as a `numeric(20,6)` column holds it.
	 * @throws BadRequestException when the value carries more decimal places than a money column has,
	 * because storing it would mean the database rounding a price the caller stated.
	 */
	private toStorage(value: Money, field: string): DecimalString {
		try {
			return value.toStorageString();
		} catch {
			throw new BadRequestException(
				`PRICE_INVALID_DECIMAL: ${field} carries more decimal places than a money column holds (6).`
			);
		}
	}

	/**
	 * @param error Anything thrown while writing a row.
	 * @returns A message safe to hand back to the caller.
	 */
	private messageOf(error: unknown): string {
		return error instanceof Error ? error.message : 'The row could not be written.';
	}

	/*
	|--------------------------------------------------------------------------
	| Bulk helpers
	|--------------------------------------------------------------------------
	*/

	/**
	 * Finds the row a bulk item addresses: by identifier when one is given, otherwise by the tuple
	 * that identifies a price — variant, currency, price list and quantity band.
	 *
	 * @param item One bulk row.
	 * @returns The existing row, or null when the item is an insert.
	 */
	private async findExisting(item: IProductPriceBulkItem): Promise<ProductPrice | null> {
		const { tenantId, organizationId } = this.scope;

		if (item.id) {
			return await this.typeOrmProductPriceRepository.findOne({
				where: { id: item.id, tenantId, organizationId } as FindOptionsWhere<ProductPrice>
			});
		}

		const currency = this.normalizeCurrency(item.currency);

		return await this.typeOrmProductPriceRepository.findOne({
			where: {
				tenantId,
				organizationId,
				variantId: item.variantId ?? IsNull(),
				currency,
				priceListId: item.priceListId ?? IsNull(),
				minQuantity: item.minQuantity ?? IsNull(),
				maxQuantity: item.maxQuantity ?? IsNull()
			} as FindOptionsWhere<ProductPrice>
		});
	}

	/**
	 * @param item One bulk row.
	 * @param existing The row it updates, when it updates one.
	 * @returns The payload the ordinary write path receives, so a bulk write obeys exactly the rules a
	 * single write does — including the pair a row states: an amount, or a derivation of one.
	 */
	private toPricePayload(item: IProductPriceBulkItem, existing?: ProductPrice | null): DeepPartial<ProductPrice> {
		const computeMode = (item.computeMode as PriceComputeMode) ?? existing?.computeMode ?? PriceComputeMode.AMOUNT;

		return {
			id: existing?.id,
			variantId: item.variantId ?? existing?.variantId,
			priceListId: item.priceListId ?? existing?.priceListId,
			currency: item.currency as CurrencyCode,
			amount:
				item.amount !== undefined
					? (item.amount as unknown as DecimalString)
					: computeMode === PriceComputeMode.PERCENT_OFF
					? undefined
					: (existing?.amount as DecimalString),
			computeMode,
			percent: (item.percent as unknown as DecimalString) ?? existing?.percent,
			baseSource: (item.baseSource as PriceBaseSource) ?? existing?.baseSource,
			basePriceListId: item.basePriceListId ?? existing?.basePriceListId,
			roundTo: (item.roundTo as unknown as DecimalString) ?? existing?.roundTo,
			unitId: item.unitId ?? existing?.unitId,
			compareAtAmount: (item.compareAtAmount as unknown as DecimalString) ?? existing?.compareAtAmount,
			costAmount: (item.costAmount as unknown as DecimalString) ?? existing?.costAmount,
			minQuantity: (item.minQuantity as DecimalString) ?? existing?.minQuantity,
			maxQuantity: (item.maxQuantity as DecimalString) ?? existing?.maxQuantity,
			status: (item.status as PriceStatus) ?? existing?.status ?? PriceStatus.ACTIVE
		};
	}

	/**
	 * Retires the rows of the pairs a `REPLACE` batch mentioned that the batch did not supply.
	 *
	 * Retirement is `INACTIVE`, never a delete: a price that was charged stays queryable, which is what
	 * makes an import reversible by importing the previous matrix.
	 *
	 * @param items The batch.
	 * @param writtenIds The rows the batch wrote.
	 */
	private async retireRowsMissingFromBatch(items: IProductPriceBulkItem[], writtenIds: Set<string>): Promise<void> {
		const pairs = new Map<string, { variantId: ID; priceListId?: ID }>();

		for (const item of items) {
			pairs.set(`${item.variantId}:${item.priceListId ?? ''}`, { variantId: item.variantId, priceListId: item.priceListId });
		}

		for (const pair of pairs.values()) {
			const { tenantId, organizationId } = this.scope;
			const rows = await this.typeOrmProductPriceRepository.find({
				where: {
					tenantId,
					organizationId,
					variantId: pair.variantId,
					priceListId: pair.priceListId ?? IsNull()
				} as FindOptionsWhere<ProductPrice>
			});

			const obsolete = rows.filter((row) => !writtenIds.has(String(row.id)));

			if (obsolete.length) {
				await this.typeOrmProductPriceRepository.update(
					obsolete.map((row) => row.id),
					{ status: PriceStatus.INACTIVE } as QueryDeepPartialEntity<ProductPrice>
				);
			}
		}
	}
}
