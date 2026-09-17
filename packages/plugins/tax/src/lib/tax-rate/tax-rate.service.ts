import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial, DeleteResult, FindManyOptions, FindOptionsWhere, In } from 'typeorm';
import { CurrencyCode, DecimalString, ID, IPagination } from '@gauzy/contracts';
import {
	Money,
	RequestContext,
	TenantAwareCrudService,
	WORKING_SCALE,
	compareDecimalStrings,
	divideDecimalUnits,
	formatDecimalUnits,
	normalizeDecimalString,
	parseDecimalString
} from '@gauzy/core';
import { TaxCategory } from '../tax-category/tax-category.entity';
import { TaxCategoryService } from '../tax-category/tax-category.service';
import { TaxRatePart } from '../tax-rate-part/tax-rate-part.entity';
import { TaxRatePartService } from '../tax-rate-part/tax-rate-part.service';
import { TaxRegimeService } from '../tax-regime/tax-regime.service';
import {
	IResolvedTaxPart,
	IResolvedTaxRate,
	IResolvedTaxRegime,
	ITaxLineDraft,
	TaxAmountType,
	TaxCalculationLineRequest,
	TaxCalculationLineResult,
	TaxCalculationRequest,
	TaxCalculationResult,
	TaxDestination,
	TaxDirection,
	TaxPartType,
	TaxRateMatchLevel,
	TaxResolutionRequest,
	TaxRuleMatcher,
	TaxWriteInput
} from '../tax.types';
import { TaxRate } from './tax-rate.entity';
import { MikroOrmTaxRateRepository } from './repository/mikro-orm-tax-rate.repository';
import { TypeOrmTaxRateRepository } from './repository/type-orm-tax-rate.repository';

/**
 * The ladder of zone specificity, most specific first. The first level that yields a candidate wins and
 * nothing below it is consulted, which is what makes a country-and-province rate beat the organization
 * default rather than compete with it on priority.
 */
const TAX_RATE_MATCH_LEVELS: readonly TaxRateMatchLevel[] = [
	TaxRateMatchLevel.COUNTRY_PROVINCE_POSTAL,
	TaxRateMatchLevel.COUNTRY_PROVINCE,
	TaxRateMatchLevel.COUNTRY,
	TaxRateMatchLevel.REGION,
	TaxRateMatchLevel.DEFAULT
];

/**
 * How many times the inclusive extraction walks a compound chain before it settles. A chain is monotone
 * and every rate of it is non-negative, so the walk converges in a couple of passes; the bound is what
 * keeps a pathological rate set from looping.
 */
const TAX_EXTRACTION_PASSES = 4;

/**
 * Renders a `numeric(9,6)` rate as the fixed six-decimal form the wire and the tax ledger carry.
 *
 * A rate is read back from the database through the platform's numeric transformer, which hands over a
 * number; the fixed form is what makes a rate read over REST and a rate read over GraphQL
 * string-identical. This is formatting of a fraction, never arithmetic on an amount.
 *
 * @param rate The rate as it was read.
 * @returns The rate as `0.200000`.
 */
export function formatTaxRate(rate: number | string): DecimalString {
	const text = typeof rate === 'number' ? rate.toFixed(6) : String(rate ?? '0');
	const [integer, fraction = ''] = text.split('.');

	return `${integer}.${(fraction + '000000').slice(0, 6)}`;
}

/**
 * The rate table a sale document is taxed from.
 *
 * The service resolves which rates apply to a destination — the direction of the document and the
 * selected regime first, then the most specific zone, ties broken by priority and then by the later
 * window — and computes what they come to for a set of amounts. Both results are handed back to the
 * caller: the ledger is the platform's (`tax_line`), and a plugin that wrote ledger rows of its own would
 * be a second source of truth for what a document was charged.
 *
 * A rate is live when its window contains the moment and the row is not soft-deleted; there is no
 * status column, because a second state machine beside the window could only disagree with it.
 */
@Injectable()
export class TaxRateService extends TenantAwareCrudService<TaxRate> {
	constructor(
		readonly typeOrmTaxRateRepository: TypeOrmTaxRateRepository,
		readonly mikroOrmTaxRateRepository: MikroOrmTaxRateRepository,
		private readonly taxCategoryService: TaxCategoryService,
		private readonly taxRatePartService: TaxRatePartService,
		private readonly taxRegimeService: TaxRegimeService
	) {
		super(typeOrmTaxRateRepository, mikroOrmTaxRateRepository);
	}

	/**
	 * Retrieves a paginated list of tax rates.
	 *
	 * @param filter Optional filtering criteria.
	 * @returns A paginated list of rates.
	 */
	public async findAll(filter?: FindManyOptions<TaxRate>): Promise<IPagination<TaxRate>> {
		return await this.paginate(filter);
	}

	/**
	 * Creates a rate inside one of the organization's categories.
	 *
	 * @param entity The rate to create.
	 * @returns The persisted rate.
	 * @throws BadRequestException when the organization cannot be resolved, when the rate is negative,
	 * when the window is inverted, when the postal pattern does not compile, or when a compound rate
	 * declares no priority.
	 * @throws NotFoundException when the category does not exist in the caller's tenant.
	 */
	public async create(entity: TaxWriteInput<TaxRate>): Promise<TaxRate> {
		const organizationId = this.requireOrganizationId();
		const taxCategoryId = entity.taxCategoryId;

		if (!taxCategoryId) {
			throw new BadRequestException('A tax rate belongs to a tax category, and none was given.');
		}

		await this.assertCategoryExists(taxCategoryId);
		this.assertRate(entity.rate);
		this.assertWindow(entity.startsAt, entity.endsAt);
		this.assertPostalCodePattern(entity.postalCodePattern);
		this.assertCompoundPriority(entity.isCompound, entity.priority);
		this.assertDirection(entity.direction);
		await this.assertCodeIsUnambiguous({
			organizationId,
			code: entity.code,
			direction: entity.direction ?? TaxDirection.SALE,
			startsAt: this.toDate(entity.startsAt),
			endsAt: this.toDate(entity.endsAt)
		});

		return await super.create({ ...entity, taxCategoryId, organizationId } as DeepPartial<TaxRate>);
	}

	/**
	 * Updates a rate of the caller's organization.
	 *
	 * A rate is corrected in place rather than superseded: the amounts already charged are snapshotted on
	 * the tax line, so editing the rate does not rewrite them.
	 *
	 * @param id The rate to update.
	 * @param entity The members to change.
	 * @returns The updated rate.
	 * @throws NotFoundException when the rate does not exist in the caller's tenant.
	 * @throws BadRequestException when a changed member is invalid.
	 */
	public async update(id: ID, entity: TaxWriteInput<TaxRate>): Promise<TaxRate> {
		const rate = await this.findOneByIdString(id);
		if (!rate) {
			throw new NotFoundException(`The tax rate ${id} was not found.`);
		}

		if (entity.taxCategoryId) {
			await this.assertCategoryExists(entity.taxCategoryId);
		}
		if (entity.rate !== undefined) {
			this.assertRate(entity.rate);
		}
		if (entity.startsAt !== undefined || entity.endsAt !== undefined) {
			this.assertWindow(entity.startsAt ?? rate.startsAt, entity.endsAt ?? rate.endsAt);
		}
		if (entity.postalCodePattern !== undefined) {
			this.assertPostalCodePattern(entity.postalCodePattern);
		}
		if (entity.isCompound === true) {
			this.assertCompoundPriority(entity.isCompound, entity.priority ?? rate.priority);
		}
		this.assertDirection(entity.direction);
		if (entity.amountType === TaxAmountType.FIXED) {
			// A rate that declares a fixed arithmetic carries its amount in its parts; a rate that declares
			// one without any is a rate that states no tax at all.
			this.assertAmountTypeMatchesParts(TaxAmountType.FIXED, await this.taxRatePartService.listForRate(id));
		}
		if (
			entity.code !== undefined ||
			entity.direction !== undefined ||
			entity.startsAt !== undefined ||
			entity.endsAt !== undefined
		) {
			await this.assertCodeIsUnambiguous({
				organizationId: rate.organizationId,
				code: entity.code ?? rate.code,
				direction: entity.direction ?? rate.direction ?? TaxDirection.SALE,
				startsAt: this.toDate(entity.startsAt !== undefined ? entity.startsAt : rate.startsAt),
				endsAt: this.toDate(entity.endsAt !== undefined ? entity.endsAt : rate.endsAt),
				exceptId: id
			});
		}

		await super.update(id, entity as DeepPartial<TaxRate>);

		// The row is read back rather than returned from the update, because the two ORMs answer an
		// update differently and the caller of an update wants the record, not the driver's result.
		return await this.findOneByIdString(id);
	}

	/*
	|--------------------------------------------------------------------------
	| Parts
	|--------------------------------------------------------------------------
	*/

	/**
	 * Reads the ordered parts a rate is made of.
	 *
	 * An empty list is not an error and not an absence of tax: it is the rate's one implied part —
	 * `TAX`, 100 %, base 1 — which is the breakdown every rate produced before parts existed.
	 *
	 * @param taxRateId The rate to read.
	 * @returns The parts, ordered by their sequence.
	 * @throws NotFoundException when the rate does not exist in the caller's tenant.
	 */
	public async listParts(taxRateId: ID): Promise<TaxRatePart[]> {
		const rate = await this.findOneByIdString(taxRateId);
		if (!rate) {
			throw new NotFoundException(`The tax rate ${taxRateId} was not found.`);
		}

		return await this.taxRatePartService.listForRate(taxRateId);
	}

	/**
	 * Replaces the ordered parts a rate is made of.
	 *
	 * A part is edited with the rate it belongs to rather than as a resource of its own: it exists only as
	 * an element of the rate's breakdown, and reshaping the arithmetic of a rate is the same decision as
	 * authoring it. An empty list is a legitimate write and returns the rate to its implied part.
	 *
	 * @param taxRateId The rate whose parts are being written.
	 * @param parts The complete ordered list the rate should carry.
	 * @returns The parts after the write.
	 * @throws NotFoundException when the rate does not exist in the caller's tenant.
	 * @throws BadRequestException when the list does not describe a usable breakdown, or when it
	 * contradicts the arithmetic the rate declares.
	 */
	public async setParts(taxRateId: ID, parts: TaxWriteInput<TaxRatePart>[]): Promise<TaxRatePart[]> {
		const rate = await this.findOneByIdString(taxRateId);
		if (!rate) {
			throw new NotFoundException(`The tax rate ${taxRateId} was not found.`);
		}

		this.assertAmountTypeMatchesParts(rate.amountType ?? TaxAmountType.PERCENT, parts ?? []);

		return await this.taxRatePartService.replaceForRate(taxRateId, parts ?? []);
	}

	/**
	 * Retires a rate instead of removing its row.
	 *
	 * A tax line written before the deletion names this rate, and the breakdown of a placed document has
	 * to stay explainable, so the row is soft-deleted and kept. A rate that must stop applying at a known
	 * moment is ended with `endsAt` instead, which leaves the history intact and is the operation an
	 * operator usually wants.
	 *
	 * @param criteria The rate to retire, by id or by conditions.
	 * @returns The delete result, so the route keeps the platform's response shape.
	 */
	public async delete(criteria: string | FindOptionsWhere<TaxRate>): Promise<DeleteResult> {
		await super.softDelete(criteria);
		return { affected: 1, raw: [] } as DeleteResult;
	}

	/**
	 * Resolves the rates that apply to a destination.
	 *
	 * The resolution order is authoritative: the direction of the document and the selected regime narrow
	 * the candidates first, then the most specific zone wins — country with province and postal pattern, then
	 * country with province, then country, then region, then the category's default — the rates of that
	 * level are ordered by `priority`, then by the later `startsAt`, a level whose candidates are all
	 * excluded by their own narrowing rules does not stop the ladder, and an explicit zero rate terminates
	 * it.
	 *
	 * @param request The destination and the category to resolve within.
	 * @returns The rates of the winning level, in the order they are applied.
	 * @throws NotFoundException when the category cannot be resolved.
	 * @throws BadRequestException when no rate matches at any level.
	 */
	public async resolve(request: TaxResolutionRequest = {}): Promise<IResolvedTaxRate[]> {
		const category = await this.resolveCategory(request.taxCategoryId);
		const chain = await this.resolveChain(category, request);

		if (!chain.length) {
			throw new BadRequestException(
				`No tax rate matches ${this.describeDestination(request)} for the tax category "${category.code}".`
			);
		}

		return chain;
	}

	/**
	 * Resolves the regime a document is taxed under and the rates that apply to it.
	 *
	 * The regime is selected before the rates are, and it is part of the answer rather than an input: a
	 * caller that receives only the chain cannot say which tax set the document was taxed under, and that
	 * is the first question a tax authority asks. The rate rows themselves are the same ones
	 * {@link resolve} returns.
	 *
	 * @param request The destination, the party's assignment and the direction being taxed.
	 * @returns The selected regime, when one was selected, and the chain of rates.
	 * @throws NotFoundException when the category cannot be resolved.
	 * @throws BadRequestException when no rate matches at any level.
	 */
	public async resolveDocument(
		request: TaxResolutionRequest = {}
	): Promise<{ regime?: IResolvedTaxRegime; rates: IResolvedTaxRate[] }> {
		const category = await this.resolveCategory(request.taxCategoryId);
		const regime = await this.selectRegime(request);
		const chain = await this.resolveChain(category, request, regime);

		if (!chain.length) {
			throw new BadRequestException(
				`No tax rate matches ${this.describeDestination(request)} for the tax category "${category.code}".`
			);
		}

		return { regime, rates: chain };
	}

	/**
	 * Computes the tax of a set of amounts.
	 *
	 * Nothing is persisted: the caller receives tax-line-shaped drafts and writes them through the
	 * platform's tax ledger, which is what keeps one breakdown mechanism for every taxed document on the
	 * platform. Each line is computed on its own base and rounded once per rate, which is what makes a
	 * total reproducible from its parts; an inclusive line has its net and its tax extracted from the
	 * gross with the residual rule, so `net + tax` equals the gross exactly.
	 *
	 * @param request The lines, the currency and the destination they are taxed at.
	 * @returns The lines' tax and the totals over them.
	 * @throws BadRequestException when the organization cannot be resolved, when a line's amount is not
	 * an exact decimal string, or when a line matches no rate and the caller does not allow an untaxed
	 * catalogue.
	 * @throws NotFoundException when a line's category cannot be resolved.
	 */
	public async calculate(request: TaxCalculationRequest): Promise<TaxCalculationResult> {
		this.requireOrganizationId();

		const currency = request.currency;
		const now = request.now ?? new Date();
		// The regime is selected once for the document and not once per line: a document is taxed under one
		// set, and a per-line selection would let two lines of the same document be taxed differently.
		const regime = await this.selectRegime({
			regionId: request.regionId,
			countryCode: request.countryCode,
			provinceCode: request.provinceCode,
			postalCode: request.postalCode,
			taxRegimeId: request.taxRegimeId,
			partyTaxRegistrationPresent: request.partyTaxRegistrationPresent,
			now
		});
		const lines: TaxCalculationLineResult[] = [];

		for (const line of request.lines ?? []) {
			lines.push(await this.calculateLine(line, request, currency, now, regime));
		}

		const netTotal = Money.sum(
			lines.map((line) => Money.of(line.netAmount, currency)),
			currency
		);
		const taxTotal = Money.sum(
			lines.map((line) => Money.of(line.taxAmount, currency)),
			currency
		);
		const grossTotal = netTotal.add(taxTotal);

		return {
			currency,
			netTotal: netTotal.toStorageString(),
			taxTotal: taxTotal.toStorageString(),
			grossTotal: grossTotal.toStorageString(),
			lines
		};
	}

	/*
	|--------------------------------------------------------------------------
	| Resolution
	|--------------------------------------------------------------------------
	*/

	/**
	 * Walks the specificity ladder and returns the chain of the first level that yields an eligible rate.
	 *
	 * Two conditions precede the ladder, and they are conditions on the candidate set rather than rungs of
	 * it: the direction of the document, so a purchase bill cannot silently inherit a sales rate, and the
	 * membership rule of the selected regime, so a rate attached to a regime applies only to that regime's
	 * documents.
	 *
	 * A winner whose percentage is zero stops the ladder **only** when it is a percentage rate with no
	 * non-zero fixed part. A fixed-amount tax, or a rate whose amounts live entirely in its parts, is not a
	 * zero-rated supply, and stopping on it would under-collect — so the ladder descends past it.
	 *
	 * @param category The category being resolved.
	 * @param request The destination and the rule matcher.
	 * @param regime The regime selected for the document, when one was.
	 * @returns The chain, or an empty array when no level yielded one.
	 */
	private async resolveChain(
		category: TaxCategory,
		request: TaxResolutionRequest,
		regime?: IResolvedTaxRegime
	): Promise<IResolvedTaxRate[]> {
		const candidates = await this.candidateRates(category, request, regime);

		for (const level of TAX_RATE_MATCH_LEVELS) {
			const atLevel = candidates.filter((rate) => this.isAtLevel(rate, level));
			if (!atLevel.length) {
				continue;
			}

			const eligible: TaxRate[] = [];
			for (const rate of atLevel) {
				// Rules narrow, they never widen: a rate whose zone matched but whose rules do not is discarded.
				if (await this.matchesRules(rate, request.matchesRules)) {
					eligible.push(rate);
				}
			}

			// A level whose candidates all fail their own rules does not stop the ladder.
			if (!eligible.length) {
				continue;
			}

			const chain = this.buildChain(eligible, level, request.regionTaxInclusive === true, await this.partsOf(eligible));
			// The first level that yields an eligible winner is the answer, and a winner whose rate is
			// zero is a winner like any other: a zero-rated supply is deliberate, and descending past it
			// would replace it with a lower level's rate and over-collect (doc 07 §4.2 T5, §4.3 row 7,
			// fixture `tax.zero-rated-category`). This is also what the docblock of `resolve` above states.
			// (Corrected while writing the resolution suite: the descent this replaces either fired for
			// every winner — leaving `resolve` reporting that no rate matched a destination that had one —
			// or, once guarded on the winner's rate, fired for every explicit zero rate and taxed a
			// zero-rated supply at the fallback rate. `isDeliberateZero` cannot tell the two apart, because
			// a rate with no part rows implies a part whose `factorPercent` is the whole rate.)
			return chain;
		}

		return [];
	}

	/**
	 * The rates of one category the document may be taxed at.
	 *
	 * The category's live rate set is read once and narrowed in the service rather than in SQL, because
	 * the comparison is a mixture of equality, case folding, membership and a pattern match and the
	 * ladder has to be walked in one place. A category holds tens of rows, not thousands.
	 *
	 * @param category The category being resolved.
	 * @param request The destination, the direction and the regime inputs.
	 * @param regime The regime selected for the document, when one was.
	 * @returns The live rates of the right direction and regime, inside the destination's zone.
	 */
	private async candidateRates(
		category: TaxCategory,
		request: TaxResolutionRequest,
		regime?: IResolvedTaxRegime
	): Promise<TaxRate[]> {
		const live = await this.findLiveRates(category.id, request.now ?? new Date());
		const directed = live.filter((rate) => this.isInDirection(rate, request.documentDirection));
		const members = await this.taxRegimeService.filterRegimeMembers(directed, regime?.taxRegimeId);

		return members.filter((rate) => this.isInZone(rate, request));
	}

	/**
	 * @param rate The rate to test.
	 * @param direction The direction of the document being taxed; a sale when the caller stated none.
	 * @returns Whether the rate applies to a document of that direction. A rate written before the column
	 * existed carries no value and is therefore a sale rate, exactly as it behaved before the column.
	 */
	private isInDirection(rate: TaxRate, direction?: TaxDirection): boolean {
		const applies = rate.direction ?? TaxDirection.SALE;
		const wanted = direction ?? TaxDirection.SALE;

		return applies === TaxDirection.BOTH || wanted === TaxDirection.BOTH || applies === wanted;
	}

	/**
	 * Reads the parts of a set of rates, grouped by rate.
	 *
	 * The parts are read once for the rates that are actually being considered, rather than per rate: a
	 * breakdown is a handful of rows and the resolution must not turn into one query per candidate.
	 *
	 * @param rates The rates whose parts are needed.
	 * @returns The parts of each rate, in sequence order.
	 */
	private async partsOf(rates: TaxRate[]): Promise<Map<ID, TaxRatePart[]>> {
		const ids = rates.map((rate) => rate.id).filter((id): id is ID => !!id);
		const parts = await this.taxRatePartService.listForRates(ids);
		const byRate = new Map<ID, TaxRatePart[]>();
		for (const part of parts) {
			byRate.set(part.taxRateId, [...(byRate.get(part.taxRateId) ?? []), part]);
		}

		return byRate;
	}

	/**
	 * @param rate A rate row.
	 * @param parts The part rows the rate declares, in sequence order.
	 * @param level The level of the ladder the rate won at.
	 * @param regionTaxInclusive Whether the destination's region includes tax, used when a rate does not say.
	 * @param isWinner Whether the rate is the one the ladder stopped at.
	 * @returns The rate in the shape the caller applies.
	 */
	private toResolvedRate(
		rate: TaxRate,
		parts: TaxRatePart[],
		level: TaxRateMatchLevel,
		regionTaxInclusive: boolean,
		isWinner: boolean
	): IResolvedTaxRate {
		return {
			taxRateId: rate.id,
			taxCategoryId: rate.taxCategoryId,
			code: rate.code,
			name: rate.name,
			rate: formatTaxRate(rate.rate),
			isCompound: rate.isCompound === true,
			isInclusive: rate.isInclusive ?? regionTaxInclusive,
			priority: rate.priority ?? 0,
			amountType: rate.amountType ?? TaxAmountType.PERCENT,
			direction: rate.direction ?? TaxDirection.SALE,
			parts: parts.length ? parts.map((part) => this.toResolvedPart(part)) : [this.impliedPart(rate)],
			providerKey: rate.providerKey,
			matchLevel: level,
			isWinner
		};
	}

	/**
	 * @param part A part row.
	 * @returns The part in the shape the arithmetic applies.
	 */
	private toResolvedPart(part: TaxRatePart): IResolvedTaxPart {
		return {
			taxRatePartId: part.id,
			sequence: part.sequence ?? 1,
			partType: part.partType ?? TaxPartType.TAX,
			factorPercent: formatTaxRate(part.factorPercent ?? 100),
			baseFactor: formatTaxRate(part.baseFactor ?? 1),
			amountType: part.amountType ?? TaxAmountType.PERCENT,
			fixedAmount:
				part.fixedAmount === undefined || part.fixedAmount === null
					? undefined
					: formatTaxRate(part.fixedAmount),
			fixedCurrency: part.fixedCurrency,
			postingKey: part.postingKey,
			label: part.label
		};
	}

	/**
	 * @param rate A rate that declares no part.
	 * @returns The one part such a rate is: the whole rate, on the whole base, producing an amount. This is
	 * the rule that makes parts additive rather than a rewrite of every existing rate.
	 */
	private impliedPart(rate: TaxRate): IResolvedTaxPart {
		return {
			sequence: 1,
			partType: TaxPartType.TAX,
			factorPercent: '100.000000',
			baseFactor: '1.000000',
			amountType: rate.amountType ?? TaxAmountType.PERCENT,
			label: rate.name
		};
	}

	/**
	 * @param parts The parts of the winning rate.
	 * @returns Whether the rate is a deliberate zero rate: every producing part is a percentage part whose
	 * share is zero or which carries no fixed amount. A fixed-amount tax and a rate whose amounts live in
	 * its parts are not zero-rated supplies, and the ladder descends past them.
	 */
	private isDeliberateZero(parts: IResolvedTaxPart[]): boolean {
		return parts.every((part) => {
			if (part.partType !== TaxPartType.TAX) {
				// A part that produces no amount says nothing about whether the supply is zero-rated.
				return true;
			}
			if (part.amountType === TaxAmountType.FIXED) {
				return (
					compareDecimalStrings(part.fixedAmount ?? 0, 0) === 0 ||
					compareDecimalStrings(part.factorPercent, 0) === 0
				);
			}

			return compareDecimalStrings(part.factorPercent, 0) === 0;
		});
	}

	/**
	 * Turns the eligible rates of one level into the chain that is applied.
	 *
	 * The chain is the whole eligible set of the level, not one winner: a jurisdiction that compounds
	 * assesses the second rate on the first one's base, and dropping the rate that lost on priority would
	 * silently stop collecting it — which is exactly what a 5 % federal rate beside a 9.975 % compound
	 * provincial one looks like. The order is the one the money specification states: the rates that are
	 * **not** compound first, then the compound ones in `priority ASC, rate ASC` order, so the position of
	 * each on the running total is deterministic. The first rate of the chain is the one the ladder stopped
	 * at; whether its zero percentage is a deliberate zero is decided by the caller, from its parts.
	 *
	 * @param eligible The rates that matched the zone and their rules.
	 * @param level The level they matched at.
	 * @param regionTaxInclusive Whether the destination's region includes tax, used when a rate does not say.
	 * @param partsByRate The parts of those rates, grouped by rate.
	 * @returns The chain, in the order the rates are applied.
	 */
	private buildChain(
		eligible: TaxRate[],
		level: TaxRateMatchLevel,
		regionTaxInclusive: boolean,
		partsByRate: Map<ID, TaxRatePart[]>
	): IResolvedTaxRate[] {
		const plain = eligible
			.filter((rate) => rate.isCompound !== true)
			.sort((left, right) => this.compareByPriorityDescending(left, right));
		const compound = eligible
			.filter((rate) => rate.isCompound === true)
			.sort((left, right) => this.compareByPriorityAscending(left, right));

		return [...plain, ...compound].map((rate, index) =>
			this.toResolvedRate(rate, partsByRate.get(rate.id) ?? [], level, regionTaxInclusive, index === 0)
		);
	}

	/**
	 * The live rates of one category in the caller's organization.
	 *
	 * The category's whole rate set is read and filtered in the service rather than narrowed in SQL,
	 * because the zone comparison is a mixture of equality, case folding and a pattern match and the
	 * ladder has to be walked in one place. A category holds tens of rows, not thousands.
	 *
	 * @param taxCategoryId The category.
	 * @param now The moment the windows are evaluated at.
	 * @returns The rates that are active and whose window contains the moment.
	 */
	private async findLiveRates(taxCategoryId: ID, now: Date): Promise<TaxRate[]> {
		const organizationId = this.requireOrganizationId();
		const rates = await this.find({
			where: { taxCategoryId, organizationId, isActive: true } as FindOptionsWhere<TaxRate>
		});

		return rates.filter((rate) => this.isLiveAt(rate, now));
	}

	/**
	 * @param rate The rate to test.
	 * @param now The moment to test it at.
	 * @returns Whether the rate's window contains the moment. An open bound is unbounded.
	 */
	private isLiveAt(rate: TaxRate, now: Date): boolean {
		const startsAt = rate.startsAt ? new Date(rate.startsAt).getTime() : null;
		const endsAt = rate.endsAt ? new Date(rate.endsAt).getTime() : null;

		return (startsAt === null || startsAt <= now.getTime()) && (endsAt === null || endsAt > now.getTime());
	}

	/**
	 * @param rate The rate to test.
	 * @param destination The destination.
	 * @returns Whether the rate's zone admits the destination. A zone column the rate left null admits
	 * anything; a column it set admits only a destination that states the same value.
	 */
	private isInZone(rate: TaxRate, destination: TaxDestination): boolean {
		if (rate.regionId && rate.regionId !== destination.regionId) {
			return false;
		}
		if (rate.countryCode && this.normalizeCode(rate.countryCode) !== this.normalizeCode(destination.countryCode)) {
			return false;
		}
		if (rate.provinceCode && this.normalizeCode(rate.provinceCode) !== this.normalizeCode(destination.provinceCode)) {
			return false;
		}
		if (rate.postalCodePattern && !this.matchesPostalCode(rate.postalCodePattern, destination.postalCode)) {
			return false;
		}

		return true;
	}

	/**
	 * @param rate The rate to test.
	 * @param level The level of the ladder.
	 * @returns Whether the rate states exactly the zone the level describes.
	 */
	private isAtLevel(rate: TaxRate, level: TaxRateMatchLevel): boolean {
		const hasCountry = !!rate.countryCode;
		const hasProvince = !!rate.provinceCode;
		const hasPostal = !!rate.postalCodePattern;

		switch (level) {
			case TaxRateMatchLevel.COUNTRY_PROVINCE_POSTAL:
				return hasCountry && hasProvince && hasPostal;
			case TaxRateMatchLevel.COUNTRY_PROVINCE:
				return hasCountry && hasProvince && !hasPostal;
			case TaxRateMatchLevel.COUNTRY:
				return hasCountry && !hasProvince && !hasPostal;
			case TaxRateMatchLevel.REGION:
				return !hasCountry && !!rate.regionId;
			case TaxRateMatchLevel.DEFAULT:
				return rate.isDefault === true;
			default:
				return false;
		}
	}

	/**
	 * @param pattern The rate's postal pattern.
	 * @param postalCode The destination's postal code.
	 * @returns Whether the pattern matches, case-insensitively and with the spacing of the code ignored,
	 * because the same Canadian or British code is written with and without its space.
	 */
	private matchesPostalCode(pattern: string, postalCode?: string): boolean {
		if (!postalCode) {
			return false;
		}

		const expression = new RegExp(pattern, 'i');
		const compact = postalCode.replace(/\s+/g, '');

		return expression.test(postalCode) || expression.test(compact);
	}

	/**
	 * @param rate The candidate.
	 * @param matcher The caller's rule matcher, when it supplied one.
	 * @returns Whether the rate survives its own narrowing rules. A rate with no matcher is unconstrained.
	 */
	private async matchesRules(rate: TaxRate, matcher?: TaxRuleMatcher): Promise<boolean> {
		if (!matcher) {
			return true;
		}

		return (await matcher(rate)) !== false;
	}

	/**
	 * Order of the rates of one level that are **not** compound, and the tie-break that decides which of them
	 * the ladder stopped at: the higher priority first, then the higher rate, then the later window, then the
	 * id. The later window is the resolution order's own tie-break — a rate that took effect more recently is
	 * the one a jurisdiction changed to — and an open bound counts as the oldest window there is. The id comes
	 * last so that two runs over the same data always produce the same chain.
	 */
	private compareByPriorityDescending(left: TaxRate, right: TaxRate): number {
		return (
			(right.priority ?? 0) - (left.priority ?? 0) ||
			(right.rate ?? 0) - (left.rate ?? 0) ||
			this.toTime(right.startsAt) - this.toTime(left.startsAt) ||
			String(left.id).localeCompare(String(right.id))
		);
	}

	/**
	 * Order of the compound rates of a chain: the lower priority first, then the lower rate, so that the
	 * position of each on the running total is deterministic.
	 */
	private compareByPriorityAscending(left: TaxRate, right: TaxRate): number {
		return (
			(left.priority ?? 0) - (right.priority ?? 0) ||
			(left.rate ?? 0) - (right.rate ?? 0) ||
			String(left.id).localeCompare(String(right.id))
		);
	}

	/**
	 * @param value A timestamp as the entity carries it.
	 * @returns The instant, or zero when the column is empty.
	 */
	private toTime(value?: Date | string): number {
		return value ? new Date(value).getTime() : 0;
	}

	/**
	 * @param code A country or province code.
	 * @returns The code folded for comparison, or an empty string when it is absent.
	 */
	private normalizeCode(code?: string): string {
		return typeof code === 'string' ? code.trim().toUpperCase() : '';
	}

	/*
	|--------------------------------------------------------------------------
	| Calculation
	|--------------------------------------------------------------------------
	*/

	/**
	 * Computes one line.
	 *
	 * @param line The line to compute.
	 * @param request The request the line belongs to, whose destination and matcher it falls back to.
	 * @param currency The currency of the amounts.
	 * @param now The moment the rates are resolved at.
	 * @param regime The regime selected for the document, when one was selected.
	 * @returns The line's tax and its tax-line drafts.
	 */
	private async calculateLine(
		line: TaxCalculationLineRequest,
		request: TaxCalculationRequest,
		currency: CurrencyCode,
		now: Date,
		regime?: IResolvedTaxRegime
	): Promise<TaxCalculationLineResult> {
		const destination: TaxDestination = {
			regionId: line.regionId ?? request.regionId,
			countryCode: line.countryCode ?? request.countryCode,
			provinceCode: line.provinceCode ?? request.provinceCode,
			postalCode: line.postalCode ?? request.postalCode,
			regionTaxInclusive: request.regionTaxInclusive === true
		};
		const category = await this.resolveCategory(line.taxCategoryId ?? request.taxCategoryId);
		const chain = await this.resolveChain(
			category,
			{
				...destination,
				now,
				matchesRules: request.matchesRules,
				documentDirection: request.documentDirection,
				partyTaxRegistrationPresent: request.partyTaxRegistrationPresent
			},
			regime
		);

		if (!chain.length) {
			if (!request.allowUntaxedCatalog) {
				throw new BadRequestException(
					`No tax rate matches ${this.describeDestination(destination)} for the tax category "${category.code}".`
				);
			}

			// An untaxed catalogue is a deliberate configuration: the line still produces its amounts, it
			// simply carries no tax line, and a caller that wants the notice reads it from the setting.
			const amount = this.toMoney(line.amount, currency).round();

			return {
				referenceId: line.referenceId,
				taxCategoryId: category.id,
				taxRegimeId: regime?.taxRegimeId,
				currency,
				netAmount: amount.toStorageString(),
				taxAmount: Money.zero(currency).toStorageString(),
				grossAmount: amount.toStorageString(),
				taxLines: []
			};
		}

		const amount = this.toMoney(line.amount, currency);
		const inclusive = chain[0].isInclusive;
		const quantity = line.quantity ?? '1';
		const taxLines: ITaxLineDraft[] = [];

		if (inclusive) {
			// The price already contains the tax, so the gross is what was given and the net is extracted
			// from it; the tax is the residual, which is the only rule that keeps `net + tax = gross`.
			const gross = amount.round();
			const net = this.extractNet(gross, chain, quantity, currency, regime);
			taxLines.push(...this.chainTaxLines(net, chain, currency, quantity, regime));
			this.applyResidual(taxLines, gross.subtract(net), currency);

			return {
				referenceId: line.referenceId,
				taxCategoryId: category.id,
				taxRegimeId: regime?.taxRegimeId,
				currency,
				netAmount: net.toStorageString(),
				taxAmount: this.sumDrafts(taxLines, currency).toStorageString(),
				grossAmount: gross.toStorageString(),
				taxLines
			};
		}

		const net = amount.round();
		taxLines.push(...this.chainTaxLines(net, chain, currency, quantity, regime));
		const taxTotal = this.sumDrafts(taxLines, currency);

		return {
			referenceId: line.referenceId,
			taxCategoryId: category.id,
			taxRegimeId: regime?.taxRegimeId,
			currency,
			netAmount: net.toStorageString(),
			taxAmount: taxTotal.toStorageString(),
			grossAmount: net.add(taxTotal).toStorageString(),
			taxLines
		};
	}

	/**
	 * Builds the tax lines of a chain on a given net.
	 *
	 * A rate that is not compound applies to the net; a compound rate applies to the net plus the amounts
	 * of the parts already applied to the same line, which is why the running total is carried here and
	 * why each amount is rounded before the next part sees it. Within a rate the parts apply in `sequence`
	 * order, each on its own base: the part's `baseFactor` share of the owner's net, plus the already
	 * rounded amounts of the preceding parts when the rate compounds.
	 *
	 * A `BASE` part declares a taxable base and produces no amount, and the rate's breakdown may therefore
	 * hold more than one base. A `FIXED` part contributes its amount per unit of the owner's quantity and
	 * carries the sign of its share, which is how a withholding and a reverse-charge leg are expressed as
	 * amounts rather than as a negative rate — a rate may not be negative.
	 *
	 * @param net The line's amount without tax.
	 * @param chain The rates to apply, in the order they are applied.
	 * @param currency The currency of the amounts.
	 * @param quantity The owner's quantity, which a fixed part is applied per unit of.
	 * @param regime The regime the document is taxed under, snapshotted on every row it produced.
	 * @returns One draft per producing part, in the order the parts are applied.
	 */
	private chainTaxLines(
		net: Money,
		chain: IResolvedTaxRate[],
		currency: CurrencyCode,
		quantity: DecimalString,
		regime?: IResolvedTaxRegime
	): ITaxLineDraft[] {
		const drafts: ITaxLineDraft[] = [];
		let running = net;

		for (const rate of chain) {
			const rateBase = rate.isCompound ? running : net;

			for (const part of [...rate.parts].sort((left, right) => left.sequence - right.sequence)) {
				if (part.partType !== TaxPartType.TAX) {
					// A base part is declared, not posted: it exists so a rate can state more than one taxable
					// base, and it produces no tax line of its own.
					continue;
				}

				const base = rateBase.multiply(part.baseFactor).round();
				const amount = this.partAmount(part, base, rate, currency, quantity);

				drafts.push({
					taxRateId: rate.taxRateId,
					taxRatePartId: part.taxRatePartId,
					taxRegimeId: regime?.taxRegimeId,
					postingKey: part.postingKey,
					code: rate.code,
					name: part.label ?? rate.name,
					rate: rate.rate,
					isCompound: rate.isCompound,
					isInclusive: rate.isInclusive,
					baseAmount: base.toStorageString(),
					amount: amount.toStorageString(),
					quantity,
					currency,
					providerKey: rate.providerKey,
					metadata: {
						rateChainIndex: drafts.length,
						matchLevel: rate.matchLevel,
						partSequence: part.sequence,
						baseFactor: part.baseFactor
					}
				});

				running = running.add(amount);
			}
		}

		return drafts;
	}

	/**
	 * @param part The part being applied.
	 * @param base The base the part is computed on, already rounded.
	 * @param rate The rate the part belongs to.
	 * @param currency The currency of the document.
	 * @param quantity The owner's quantity.
	 * @returns The part's amount, rounded once at the currency's scale.
	 * @throws BadRequestException when a fixed part states an amount in another currency: converting it
	 * would need an exchange rate this service does not own, and inventing one is how a tax total silently
	 * becomes wrong.
	 */
	private partAmount(
		part: IResolvedTaxPart,
		base: Money,
		rate: IResolvedTaxRate,
		currency: CurrencyCode,
		quantity: DecimalString
	): Money {
		if (part.amountType === TaxAmountType.FIXED) {
			if (part.fixedCurrency && part.fixedCurrency !== currency) {
				throw new BadRequestException(
					`The fixed part of the tax rate "${rate.name}" states its amount in ${part.fixedCurrency}, and the document is in ${currency}.`
				);
			}

			return Money.of(part.fixedAmount ?? '0', currency)
				.multiply(quantity)
				.multiply(this.fraction(part.factorPercent))
				.round();
		}

		return base.multiply(rate.rate).multiply(this.fraction(part.factorPercent)).round();
	}

	/**
	 * @param percent A signed share of a rate, as the six-decimal string the wire carries.
	 * @returns The share as an exact fraction, so that a share stated as a percentage is applied by one
	 * multiplication. The arithmetic is on the digits of the decimal, never on a binary floating point
	 * number: a share of `33.333333` has to multiply to the digit, and `33.333333 / 100` in a double does
	 * not.
	 */
	private fraction(percent: DecimalString): DecimalString {
		const quotient = divideDecimalUnits(parseDecimalString(percent), { units: 100n, scale: 0 }, WORKING_SCALE);

		return normalizeDecimalString(formatDecimalUnits(quotient, WORKING_SCALE));
	}

	/**
	 * Extracts the net from a gross.
	 *
	 * A single rate that does not compound and whose breakdown is the whole rate on the whole base is
	 * extracted by one exact division — the net is the only unknown in `net + net × rate = gross`. Every
	 * other chain has no closed form: a compound rate's base includes the amount of the rate before it and
	 * a part's base is its own share of the value, so the net is found by walking the chain a bounded
	 * number of times from the gross downward. The walk converges because the chain is monotone and every
	 * rate of it is non-negative.
	 *
	 * @param gross The amount including tax.
	 * @param chain The rates that are inside the gross.
	 * @param quantity The owner's quantity, which a fixed part is applied per unit of.
	 * @param currency The currency of the document.
	 * @param regime The regime the document is taxed under.
	 * @returns The net, at the currency's scale.
	 */
	private extractNet(
		gross: Money,
		chain: IResolvedTaxRate[],
		quantity: DecimalString,
		currency: CurrencyCode,
		regime?: IResolvedTaxRegime
	): Money {
		if (chain.length === 1 && !chain[0].isCompound && this.isWholeRateOnWholeBase(chain[0])) {
			const one = Money.of('1', gross.currency);
			const denominator = one.add(Money.of(chain[0].rate, gross.currency));

			return gross.divide(denominator.amount, { scale: gross.decimals });
		}

		let net = gross;
		for (let pass = 0; pass < TAX_EXTRACTION_PASSES; pass++) {
			const tax = this.sumDrafts(this.chainTaxLines(net, chain, currency, quantity, regime), currency);
			const candidate = gross.subtract(tax).round();

			if (candidate.compare(net) === 0) {
				return candidate;
			}

			net = candidate;
		}

		return net.round();
	}

	/**
	 * @param rate A resolved rate.
	 * @returns Whether the rate is one percentage part carrying the whole rate on the whole base, which is
	 * the only breakdown whose net has a closed form. Any other breakdown — a reduced base, a split share,
	 * a fixed amount — has to be walked, because the net is no longer the only unknown.
	 */
	private isWholeRateOnWholeBase(rate: IResolvedTaxRate): boolean {
		if (rate.parts.length !== 1) {
			return false;
		}

		const [part] = rate.parts;

		return (
			part.partType === TaxPartType.TAX &&
			part.amountType === TaxAmountType.PERCENT &&
			compareDecimalStrings(part.factorPercent, '100') === 0 &&
			compareDecimalStrings(part.baseFactor, '1') === 0
		);
	}

	/**
	 * Carries the difference between the extracted tax total and the sum of the computed tax lines on the
	 * last rate of the chain, so that the drafts add up to the tax that is actually inside the gross.
	 *
	 * @param drafts The drafts to correct, in the order the rates were applied.
	 * @param target The tax the gross and the net say was charged.
	 * @param currency The currency of the amounts.
	 */
	private applyResidual(drafts: ITaxLineDraft[], target: Money, currency: CurrencyCode): void {
		if (!drafts.length) {
			return;
		}

		const residual = target.subtract(this.sumDrafts(drafts, currency));
		if (residual.isZero()) {
			return;
		}

		const last = drafts[drafts.length - 1];
		last.amount = Money.of(last.amount, currency).add(residual).round().toStorageString();
	}

	/**
	 * @param drafts The drafts to total.
	 * @param currency The currency of the amounts.
	 * @returns The exact sum of the drafts' amounts.
	 */
	private sumDrafts(drafts: ITaxLineDraft[], currency: CurrencyCode): Money {
		return Money.sum(
			drafts.map((draft) => Money.of(draft.amount, currency)),
			currency
		);
	}

	/*
	|--------------------------------------------------------------------------
	| Lookups and validation
	|--------------------------------------------------------------------------
	*/

	/**
	 * @param taxCategoryId The category the caller named, when it named one.
	 * @returns The category to resolve within: the named one, or the organization's default.
	 * @throws NotFoundException when neither exists.
	 */
	private async resolveCategory(taxCategoryId?: ID): Promise<TaxCategory> {
		if (taxCategoryId) {
			const category = await this.taxCategoryService.findOneByIdString(taxCategoryId);
			if (!category) {
				throw new NotFoundException(`The tax category ${taxCategoryId} was not found.`);
			}

			return category;
		}

		const fallback = await this.taxCategoryService.findDefault(RequestContext.currentOrganizationId() ?? undefined);
		if (!fallback) {
			throw new NotFoundException(
				'The organization has not declared a default tax category, and no category was given.'
			);
		}

		return fallback;
	}

	/**
	 * @param taxCategoryId The category a rate is being attached to.
	 * @throws NotFoundException when it does not exist in the caller's tenant.
	 */
	private async assertCategoryExists(taxCategoryId: ID): Promise<void> {
		const category = await this.taxCategoryService.findOneByIdString(taxCategoryId);
		if (!category) {
			throw new NotFoundException(`The tax category ${taxCategoryId} was not found.`);
		}
	}

	/**
	 * @param rate The rate the caller supplied.
	 * @throws BadRequestException when it is absent, not a finite number or negative.
	 */
	private assertRate(rate?: number): void {
		const value = typeof rate === 'number' ? rate : Number(rate);
		if (rate === undefined || rate === null || !Number.isFinite(value)) {
			throw new BadRequestException('A tax rate needs a rate as a fraction, for example 0.2 for twenty percent.');
		}
		if (value < 0) {
			throw new BadRequestException('A tax rate may not be negative; a zero rate is how a supply is zero-rated.');
		}
	}

	/**
	 * @param startsAt The start of the window, when it has one, as a write carried it.
	 * @param endsAt The end of the window, when it has one, as a write carried it.
	 * @throws BadRequestException when the window ends before it starts.
	 */
	private assertWindow(startsAt?: DeepPartial<Date>, endsAt?: DeepPartial<Date>): void {
		// A partial write types its dates as partial dates, so a bound is read as the instant it names
		// before the two are compared.
		const from = startsAt ? new Date(String(startsAt)) : undefined;
		const to = endsAt ? new Date(String(endsAt)) : undefined;

		if (from && to && to.getTime() <= from.getTime()) {
			throw new BadRequestException('The window of a tax rate must end after it starts.');
		}
	}

	/**
	 * @param pattern The postal pattern, when the caller supplied one.
	 * @throws BadRequestException when it does not compile as a pattern. A pattern is what the column
	 * holds: a comma-separated list of postal codes is a list, and a list would need a table of its own.
	 */
	private assertPostalCodePattern(pattern?: string): void {
		if (!pattern) {
			return;
		}

		try {
			new RegExp(pattern);
		} catch {
			throw new BadRequestException(`The postal code pattern "${pattern}" is not a valid pattern.`);
		}
	}

	/**
	 * @param isCompound Whether the rate compounds.
	 * @param priority The priority the caller supplied.
	 * @throws BadRequestException when a compound rate declares no priority, because its position among
	 * the other rates of its chain has to be deterministic.
	 */
	private assertCompoundPriority(isCompound?: boolean, priority?: number): void {
		if (isCompound === true && (priority === undefined || priority === null)) {
			throw new BadRequestException(
				'A compound tax rate must declare a priority so that its position in the chain is deterministic.'
			);
		}
	}

	/**
	 * @param direction The direction the caller supplied.
	 * @throws BadRequestException when it is not one of the three directions a rate may apply to.
	 */
	private assertDirection(direction?: TaxDirection): void {
		if (direction !== undefined && !Object.values(TaxDirection).includes(direction)) {
			throw new BadRequestException(
				`A tax rate applies to a sale, a purchase or both, and "${direction}" is none of them.`
			);
		}
	}

	/**
	 * Refuses a rate whose live window overlaps another live rate of the same code and direction.
	 *
	 * The accountant's reconciliation key is the code together with the posting key, so the same code must
	 * not mean two different rates in one period: an overlap is refused rather than resolved, because the
	 * only other answers are "whichever row the database returned first" and "a new code per rate change",
	 * and the second breaks the very key the rule protects. What has to be unique is the code **at an
	 * instant**, not the code, so this is a service check and not a unique index — a rate change
	 * legitimately keeps its code.
	 *
	 * @param candidate The code, direction, window and identity being written.
	 * @throws ConflictException when another live rate of the same organization, code and direction
	 * overlaps the window.
	 */
	private async assertCodeIsUnambiguous(candidate: {
		organizationId?: ID;
		code?: string;
		direction: TaxDirection;
		startsAt?: Date;
		endsAt?: Date;
		exceptId?: ID;
	}): Promise<void> {
		if (!candidate.code) {
			// A rate without a code has no reconciliation key, so there is nothing for it to collide with.
			return;
		}

		const neighbours = await this.find({
			where: {
				organizationId: candidate.organizationId ?? this.requireOrganizationId(),
				code: candidate.code,
				direction: candidate.direction
			} as FindOptionsWhere<TaxRate>
		});

		const overlap = neighbours.find(
			(rate) =>
				rate.id !== candidate.exceptId &&
				(rate.direction ?? TaxDirection.SALE) === candidate.direction &&
				this.windowsOverlap(candidate.startsAt, candidate.endsAt, this.toDate(rate.startsAt), this.toDate(rate.endsAt))
		);

		if (overlap) {
			throw new ConflictException(
				`TAX_RATE_WINDOW_OVERLAP: the rate "${candidate.code}" already exists for this direction and its window overlaps the one being written.`
			);
		}
	}

	/**
	 * @param leftStart Start of one window, absent meaning unbounded.
	 * @param leftEnd End of one window, absent meaning unbounded.
	 * @param rightStart Start of the other window.
	 * @param rightEnd End of the other window.
	 * @returns Whether the two half-open windows share an instant. An open bound is unbounded, so a rate
	 * that never started overlaps every rate that ends after it.
	 */
	private windowsOverlap(leftStart?: Date, leftEnd?: Date, rightStart?: Date, rightEnd?: Date): boolean {
		const startsBeforeOtherEnds = !leftStart || !rightEnd || leftStart.getTime() < rightEnd.getTime();
		const otherStartsBeforeEnds = !rightStart || !leftEnd || rightStart.getTime() < leftEnd.getTime();

		return startsBeforeOtherEnds && otherStartsBeforeEnds;
	}

	/**
	 * @param amountType The arithmetic the rate declares.
	 * @param parts The parts the rate carries.
	 * @throws BadRequestException when the two contradict each other: a rate that declares a fixed amount
	 * carries it in a fixed part, because the rate table has no amount column of its own.
	 */
	private assertAmountTypeMatchesParts(amountType: TaxAmountType, parts: TaxWriteInput<TaxRatePart>[]): void {
		if (amountType !== TaxAmountType.FIXED || !parts.length) {
			return;
		}

		const fixed = parts.some(
			(part) =>
				part.amountType === TaxAmountType.FIXED &&
				(part.partType ?? TaxPartType.TAX) === TaxPartType.TAX &&
				compareDecimalStrings(part.fixedAmount ?? 0, 0) !== 0
		);

		if (!fixed) {
			throw new BadRequestException(
				'A rate that declares a fixed amount states it in a fixed part, and none of the parts given carries one.'
			);
		}
	}

	/**
	 * @param value A value as a write carries it.
	 * @returns The instant it names, or undefined when it carries none. A partial write types its dates as
	 * partial dates, so the value is read through its string form before it is used.
	 */
	private toDate(value?: DeepPartial<Date> | Date): Date | undefined {
		return value === undefined || value === null ? undefined : new Date(String(value));
	}

	/**
	 * Selects the regime the document is taxed under.
	 *
	 * The selection itself belongs to the regime resource — a party's assignment wins and the destination is
	 * matched when it does not — so this is the rate side of one decision, not a second implementation of
	 * it.
	 *
	 * @param request The destination, the party's assignment and the direction being taxed.
	 * @returns The selected regime, or undefined when the general set applies.
	 */
	private selectRegime(request: {
		regionId?: ID;
		countryCode?: string;
		provinceCode?: string;
		postalCode?: string;
		taxRegimeId?: ID;
		partyTaxRegistrationPresent?: boolean;
		now?: Date;
	}): Promise<IResolvedTaxRegime | undefined> {
		return this.taxRegimeService.resolveRegime({
			regionId: request.regionId,
			countryCode: request.countryCode,
			provinceCode: request.provinceCode,
			postalCode: request.postalCode,
			taxRegimeId: request.taxRegimeId,
			partyTaxRegistrationPresent: request.partyTaxRegistrationPresent,
			now: request.now
		});
	}

	/**
	 * @returns The organization the resolution happens in.
	 * @throws BadRequestException when the request carries none.
	 */
	private requireOrganizationId(): ID {
		const organizationId = RequestContext.currentOrganizationId();
		if (!organizationId) {
			throw new BadRequestException(
				'Tax rates are resolved inside an organization, and none was resolved for this request.'
			);
		}

		return organizationId;
	}

	/**
	 * @param destination The destination a resolution was attempted for.
	 * @returns A short description of it, for the message a caller sees when nothing matched.
	 */
	private describeDestination(destination: TaxDestination): string {
		const parts = [
			destination.countryCode,
			destination.provinceCode,
			destination.postalCode,
			destination.regionId
		].filter((part) => !!part);

		return parts.length ? parts.join(' / ') : 'the destination';
	}

	/**
	 * @param amount An amount the caller supplied.
	 * @param currency The currency it is expressed in.
	 * @returns The value.
	 * @throws BadRequestException when it is not an exact decimal string; a JSON number is refused rather
	 * than coerced, because coercion is where precision is lost.
	 */
	private toMoney(amount: DecimalString, currency: CurrencyCode): Money {
		try {
			return Money.of(amount, currency);
		} catch {
			throw new BadRequestException(`The amount "${amount}" is not an exact decimal string.`);
		}
	}
}
