import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial, DeleteResult, FindManyOptions, FindOptionsWhere } from 'typeorm';
import { CurrencyCode, DecimalString, ID, IPagination } from '@gauzy/contracts';
import { Money, RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { TaxCategory } from '../tax-category/tax-category.entity';
import { TaxCategoryService } from '../tax-category/tax-category.service';
import {
	IResolvedTaxRate,
	ITaxLineDraft,
	TaxCalculationLineRequest,
	TaxCalculationLineResult,
	TaxCalculationRequest,
	TaxCalculationResult,
	TaxDestination,
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
 * The service resolves which rates apply to a destination — most specific zone first, ties broken by
 * priority and then by the later window — and computes what they come to for a set of amounts. Both
 * results are handed back to the caller: the ledger is the platform's (`tax_line`), and a plugin that
 * wrote ledger rows of its own would be a second source of truth for what a document was charged.
 *
 * A rate is live when its window contains the moment and the row is not soft-deleted; there is no
 * status column, because a second state machine beside the window could only disagree with it.
 */
@Injectable()
export class TaxRateService extends TenantAwareCrudService<TaxRate> {
	constructor(
		readonly typeOrmTaxRateRepository: TypeOrmTaxRateRepository,
		readonly mikroOrmTaxRateRepository: MikroOrmTaxRateRepository,
		private readonly taxCategoryService: TaxCategoryService
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

		await super.update(id, entity as DeepPartial<TaxRate>);

		// The row is read back rather than returned from the update, because the two ORMs answer an
		// update differently and the caller of an update wants the record, not the driver's result.
		return await this.findOneByIdString(id);
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
	 * The resolution order is authoritative: the most specific zone wins — country with province and
	 * postal pattern, then country with province, then country, then region, then the category's default
	 * — ties inside a level are broken by `priority` and then by the later `startsAt`, a level whose
	 * candidates are all excluded by their own narrowing rules does not stop the ladder, and an explicit
	 * zero rate is a winner that terminates it.
	 *
	 * @param request The destination and the category to resolve within.
	 * @returns The winning rate followed by the compound rates of its chain.
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
		const lines: TaxCalculationLineResult[] = [];

		for (const line of request.lines ?? []) {
			lines.push(await this.calculateLine(line, request, currency, now));
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
	 * @param category The category being resolved.
	 * @param request The destination and the rule matcher.
	 * @returns The chain, or an empty array when no level yielded one.
	 */
	private async resolveChain(category: TaxCategory, request: TaxResolutionRequest): Promise<IResolvedTaxRate[]> {
		const candidates = (await this.findLiveRates(category.id, request.now ?? new Date())).filter((rate) =>
			this.isInZone(rate, request)
		);

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

			return this.buildChain(eligible, level, request.regionTaxInclusive === true);
		}

		return [];
	}

	/**
	 * Turns the eligible rates of one level into the chain that is applied.
	 *
	 * The winner is the highest priority, then the highest rate, then the most recently updated; the
	 * compound rates of the same level follow it, ordered so that their position on the running total is
	 * deterministic. A winner whose rate is zero is returned like any other: zero-rated supplies are
	 * deliberate, and descending past them would over-collect.
	 *
	 * @param eligible The rates that matched the zone and their rules.
	 * @param level The level they matched at.
	 * @param regionTaxInclusive Whether the destination's region includes tax, used when a rate does not say.
	 * @returns The chain, winner first.
	 */
	private buildChain(eligible: TaxRate[], level: TaxRateMatchLevel, regionTaxInclusive: boolean): IResolvedTaxRate[] {
		const ordered = [...eligible].sort((left, right) => this.compareByPriorityDescending(left, right));
		const winner = ordered[0];
		const compounds = ordered
			.filter((rate) => rate !== winner && rate.isCompound === true)
			.sort((left, right) => this.compareByPriorityAscending(left, right));

		return [winner, ...compounds].map((rate, index) => ({
			taxRateId: rate.id,
			taxCategoryId: rate.taxCategoryId,
			code: rate.code,
			name: rate.name,
			rate: formatTaxRate(rate.rate),
			isCompound: rate.isCompound === true,
			isInclusive: rate.isInclusive ?? regionTaxInclusive,
			priority: rate.priority ?? 0,
			providerKey: rate.providerKey,
			matchLevel: level,
			isWinner: index === 0
		}));
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
	 * Tie-break inside a level: the higher priority wins, then the higher rate, then the most recently
	 * updated row, then the id, so that two runs over the same data always pick the same winner.
	 */
	private compareByPriorityDescending(left: TaxRate, right: TaxRate): number {
		return (
			(right.priority ?? 0) - (left.priority ?? 0) ||
			(right.rate ?? 0) - (left.rate ?? 0) ||
			this.toTime(right.updatedAt) - this.toTime(left.updatedAt) ||
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
	 * @returns The line's tax and its tax-line drafts.
	 */
	private async calculateLine(
		line: TaxCalculationLineRequest,
		request: TaxCalculationRequest,
		currency: CurrencyCode,
		now: Date
	): Promise<TaxCalculationLineResult> {
		const destination: TaxDestination = {
			regionId: line.regionId ?? request.regionId,
			countryCode: line.countryCode ?? request.countryCode,
			provinceCode: line.provinceCode ?? request.provinceCode,
			postalCode: line.postalCode ?? request.postalCode,
			regionTaxInclusive: request.regionTaxInclusive === true
		};
		const category = await this.resolveCategory(line.taxCategoryId ?? request.taxCategoryId);
		const chain = await this.resolveChain(category, { ...destination, now, matchesRules: request.matchesRules });

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
				currency,
				netAmount: amount.toStorageString(),
				taxAmount: Money.zero(currency).toStorageString(),
				grossAmount: amount.toStorageString(),
				taxLines: []
			};
		}

		const amount = this.toMoney(line.amount, currency);
		const inclusive = chain[0].isInclusive;

		if (inclusive) {
			// The price already contains the tax, so the gross is what was given and the net is extracted
			// from it; the tax is the residual, which is the only rule that keeps `net + tax = gross`.
			const gross = amount.round();
			const net = this.extractNet(gross, chain);
			const taxLines = this.chainTaxLines(net, chain, currency);
			this.applyResidual(taxLines, gross.subtract(net), currency);

			return {
				referenceId: line.referenceId,
				taxCategoryId: category.id,
				currency,
				netAmount: net.toStorageString(),
				taxAmount: this.sumDrafts(taxLines, currency).toStorageString(),
				grossAmount: gross.toStorageString(),
				taxLines
			};
		}

		const net = amount.round();
		const taxLines = this.chainTaxLines(net, chain, currency);
		const taxTotal = this.sumDrafts(taxLines, currency);

		return {
			referenceId: line.referenceId,
			taxCategoryId: category.id,
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
	 * of the rates already applied to the same line, which is why the running total is carried here and
	 * why each amount is rounded before the next rate sees it.
	 *
	 * @param net The line's amount without tax.
	 * @param chain The rates to apply, in the order they are applied.
	 * @param currency The currency of the amounts.
	 * @returns One draft per rate.
	 */
	private chainTaxLines(net: Money, chain: IResolvedTaxRate[], currency: CurrencyCode): ITaxLineDraft[] {
		const drafts: ITaxLineDraft[] = [];
		let running = net;

		for (const rate of chain) {
			const base = rate.isCompound ? running : net;
			const amount = base.multiply(rate.rate).round();

			drafts.push({
				taxRateId: rate.taxRateId,
				code: rate.code,
				name: rate.name,
				rate: rate.rate,
				isCompound: rate.isCompound,
				isInclusive: rate.isInclusive,
				baseAmount: base.round().toStorageString(),
				amount: amount.toStorageString(),
				currency,
				providerKey: rate.providerKey,
				metadata: { rateChainIndex: drafts.length, matchLevel: rate.matchLevel }
			});

			running = running.add(amount);
		}

		return drafts;
	}

	/**
	 * Extracts the net from a gross.
	 *
	 * A single rate that does not compound is extracted by one exact division — the net is the only
	 * unknown in `net + net × rate = gross`. A compound chain has no closed form, because each rate's base
	 * includes the amount of the rate before it, so the net is found by walking the chain a bounded number
	 * of times from the gross downward; the walk converges because the chain is monotone and every rate of
	 * it is non-negative.
	 *
	 * @param gross The amount including tax.
	 * @param chain The rates that are inside the gross.
	 * @returns The net, at the currency's scale.
	 */
	private extractNet(gross: Money, chain: IResolvedTaxRate[]): Money {
		if (chain.length === 1 && !chain[0].isCompound) {
			const one = Money.of('1', gross.currency);
			const denominator = one.add(Money.of(chain[0].rate, gross.currency));

			return gross.divide(denominator.amount, { scale: gross.decimals });
		}

		let net = gross;
		for (let pass = 0; pass < TAX_EXTRACTION_PASSES; pass++) {
			const tax = this.sumDrafts(this.chainTaxLines(net, chain, gross.currency), gross.currency);
			const candidate = gross.subtract(tax).round();

			if (candidate.compare(net) === 0) {
				return candidate;
			}

			net = candidate;
		}

		return net.round();
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
