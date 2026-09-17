import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial, DeleteResult, FindManyOptions, FindOptionsWhere, In } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { TaxRate } from '../tax-rate/tax-rate.entity';
import { TypeOrmTaxRateRepository } from '../tax-rate/repository/type-orm-tax-rate.repository';
import {
	IResolvedTaxRegime,
	TaxRegimeMatchLevel,
	TaxRegimeSelectionRequest,
	TaxWriteInput
} from '../tax.types';
import { TaxRegimeRate } from '../tax-regime-rate/tax-regime-rate.entity';
import { TaxRegimeRateService } from '../tax-regime-rate/tax-regime-rate.service';
import { TaxRegime } from './tax-regime.entity';
import { MikroOrmTaxRegimeRepository } from './repository/mikro-orm-tax-regime.repository';
import { TypeOrmTaxRegimeRepository } from './repository/type-orm-tax-regime.repository';

/**
 * The ladder of regime specificity, most specific first. The first level that yields a match wins and
 * nothing below it is consulted, exactly as a rate's zone is matched — a regime is matched on the same
 * destination, so it walks the same rungs.
 */
const TAX_REGIME_MATCH_LEVELS: readonly TaxRegimeMatchLevel[] = [
	TaxRegimeMatchLevel.COUNTRY_PROVINCE_POSTAL,
	TaxRegimeMatchLevel.COUNTRY_PROVINCE,
	TaxRegimeMatchLevel.COUNTRY,
	TaxRegimeMatchLevel.REGION
];

/**
 * The tax set a party or a destination switches to.
 *
 * Selecting a regime is the one operation in the tax capability that does not narrow a candidate set: the
 * rates a regime names are the rates that apply, and every regime-specific rate it does not name is
 * removed. That is what makes the same catalogue line legally sellable in many jurisdictions, and it is
 * why the selection is a documented order rather than a filter — a manual assignment on the party first,
 * always, and then the most specific matching row of the destination, with `priority` breaking a tie.
 *
 * The service owns two things beside the regime row: the membership set (through the pivot service) and
 * the destination match. The membership read is the one the rate resolution asks for, because a rate
 * with at least one membership row is a candidate only when one of its regimes is the selected one.
 */
@Injectable()
export class TaxRegimeService extends TenantAwareCrudService<TaxRegime> {
	constructor(
		readonly typeOrmTaxRegimeRepository: TypeOrmTaxRegimeRepository,
		readonly mikroOrmTaxRegimeRepository: MikroOrmTaxRegimeRepository,
		private readonly taxRegimeRateService: TaxRegimeRateService,
		private readonly typeOrmTaxRateRepository: TypeOrmTaxRateRepository
	) {
		super(typeOrmTaxRegimeRepository, mikroOrmTaxRegimeRepository);
	}

	/**
	 * Retrieves a paginated list of regimes.
	 *
	 * @param filter Optional filtering criteria.
	 * @returns A paginated list of regimes.
	 */
	public async findAll(filter?: FindManyOptions<TaxRegime>): Promise<IPagination<TaxRegime>> {
		return await this.paginate(filter);
	}

	/**
	 * Creates a regime.
	 *
	 * A regime is created without membership and refuses to be selected until it has some: a regime that
	 * selects nothing is a silently untaxed jurisdiction, not an unfinished configuration, so
	 * `setRates` is the operation that makes it usable.
	 *
	 * @param entity The regime to create.
	 * @returns The persisted regime.
	 * @throws BadRequestException when the window is inverted or the postal pattern does not compile.
	 */
	public async create(entity: TaxWriteInput<TaxRegime>): Promise<TaxRegime> {
		this.assertWindow(entity.startsAt, entity.endsAt);
		this.assertPostalCodePattern(entity.postalCodePattern);

		return await super.create({
			...entity,
			organizationId: this.requireOrganizationId()
		} as DeepPartial<TaxRegime>);
	}

	/**
	 * Amends a regime.
	 *
	 * @param id The regime to amend.
	 * @param entity The members to change.
	 * @returns The updated regime.
	 * @throws NotFoundException when the regime does not exist in the caller's tenant.
	 * @throws BadRequestException when a changed member is not usable.
	 */
	public async update(id: ID, entity: TaxWriteInput<TaxRegime>): Promise<TaxRegime> {
		const regime = await this.findOneByIdString(id);
		if (!regime) {
			throw new NotFoundException(`The tax regime ${id} was not found.`);
		}

		if (entity.startsAt !== undefined || entity.endsAt !== undefined) {
			this.assertWindow(entity.startsAt ?? regime.startsAt, entity.endsAt ?? regime.endsAt);
		}
		if (entity.postalCodePattern !== undefined) {
			this.assertPostalCodePattern(entity.postalCodePattern);
		}

		await super.update(id, entity as DeepPartial<TaxRegime>);

		return await this.findOneByIdString(id);
	}

	/**
	 * Retires a regime instead of removing its row.
	 *
	 * A tax line written under the regime names it — `tax_line.taxRegimeId` is a snapshot with no foreign
	 * key precisely so that a retired regime cannot block or rewrite a document's tax evidence — and the
	 * first question a tax authority asks is which set a document was taxed under, so the row is kept.
	 *
	 * @param criteria The regime to retire, by id or by conditions.
	 * @returns The delete result, so the route keeps the platform's response shape.
	 */
	public async delete(criteria: string | FindOptionsWhere<TaxRegime>): Promise<DeleteResult> {
		await super.softDelete(criteria);

		return { affected: 1, raw: [] } as DeleteResult;
	}

	/*
	|--------------------------------------------------------------------------
	| Membership
	|--------------------------------------------------------------------------
	*/

	/**
	 * Reads the rates one regime selects.
	 *
	 * @param taxRegimeId The regime to read.
	 * @returns The membership rows of the regime.
	 */
	public async listRates(taxRegimeId: ID): Promise<TaxRegimeRate[]> {
		await this.assertRegimeExists(taxRegimeId);

		return await this.taxRegimeRateService.listByRegime(taxRegimeId);
	}

	/**
	 * Sets which rates a regime selects.
	 *
	 * The set replaces the previous one, and an empty set is refused: a regime that selects nothing leaves
	 * every owner it applies to untaxed, which is the one failure mode of this table that is both silent
	 * and expensive.
	 *
	 * @param taxRegimeId The regime whose membership is being written.
	 * @param taxRateIds The complete set of rates the regime should select.
	 * @returns The membership rows after the write.
	 * @throws NotFoundException when the regime does not exist in the caller's tenant.
	 * @throws BadRequestException when the set is empty, names a rate twice, or names a rate that is not
	 * the organization's.
	 */
	public async setRates(taxRegimeId: ID, taxRateIds: ID[]): Promise<TaxRegimeRate[]> {
		await this.assertRegimeExists(taxRegimeId);
		await this.assertRatesExist(taxRateIds ?? []);

		return await this.taxRegimeRateService.replaceForRegime(taxRegimeId, taxRateIds ?? []);
	}

	/**
	 * Detaches one rate from one regime.
	 *
	 * @param taxRegimeId The regime.
	 * @param taxRateId The rate to detach.
	 * @returns The membership rows after the write.
	 * @throws BadRequestException when detaching the rate would leave the regime selecting nothing.
	 */
	public async removeRate(taxRegimeId: ID, taxRateId: ID): Promise<TaxRegimeRate[]> {
		const remaining = (await this.listRates(taxRegimeId)).map((row) => row.taxRateId).filter((id) => id !== taxRateId);

		return await this.setRates(taxRegimeId, remaining);
	}

	/*
	|--------------------------------------------------------------------------
	| Resolution
	|--------------------------------------------------------------------------
	*/

	/**
	 * Selects the regime a document is taxed under.
	 *
	 * The order is authoritative: the manual assignment on the party always wins, and when there is none
	 * the most specific matching row of the destination is selected — country with province and postal
	 * pattern, then country with province, then country, then region — with ties broken by `priority`,
	 * then by the later window, then by the id, so two runs over the same data select the same regime.
	 * When nothing matches, no regime is selected and the general set of rates applies, which is exactly
	 * the behaviour every rate had before regimes existed.
	 *
	 * @param request The destination, the party's assignment and the party's registration status.
	 * @returns The selected regime, or undefined when the general set applies.
	 * @throws BadRequestException when the request carries no organization, or when the party's own
	 * assignment names a regime that is not live — silently taxing that party under another set would
	 * move its tax treatment without telling anyone.
	 */
	public async resolveRegime(request: TaxRegimeSelectionRequest = {}): Promise<IResolvedTaxRegime | undefined> {
		const now = request.now ?? new Date();
		const organizationId = this.requireOrganizationId();
		const live = (await this.typeOrmTaxRegimeRepository.find({ where: { organizationId, isActive: true } })).filter(
			(regime) => this.isLiveAt(regime, now)
		);

		if (request.taxRegimeId) {
			const override = live.find((regime) => regime.id === request.taxRegimeId);
			if (!override) {
				throw new BadRequestException(
					`The tax regime ${request.taxRegimeId} assigned to the party is not a live regime of this organization.`
				);
			}

			await this.assertSelectsRates(override);

			return this.toResolvedRegime(override, TaxRegimeMatchLevel.PARTY_OVERRIDE);
		}

		const matching = live.filter(
			(regime) =>
				(!regime.requiresPartyTaxRegistration || request.partyTaxRegistrationPresent === true) &&
				this.isInZone(regime, request)
		);

		for (const level of TAX_REGIME_MATCH_LEVELS) {
			const atLevel = matching.filter((regime) => this.isAtLevel(regime, level));
			if (!atLevel.length) {
				continue;
			}

			const winner = this.winnerOf(atLevel);
			await this.assertSelectsRates(winner);

			return this.toResolvedRegime(winner, level);
		}

		return undefined;
	}

	/**
	 * Removes the rates a regime does not select.
	 *
	 * This is the membership rule and it is one sentence: a rate with **no** membership row is general and
	 * always a candidate; a rate with **at least one** row is a candidate only when one of its regimes is
	 * the selected one. The absence of a row is therefore a deliberate statement, and it is why a rate
	 * that is attached to a regime stops applying to every other regime's documents.
	 *
	 * @param rates The candidate rates of one category.
	 * @param taxRegimeId The selected regime, when one was selected.
	 * @returns The rates that are general or belong to the selected regime.
	 */
	public async filterRegimeMembers<T extends { id?: ID }>(rates: T[], taxRegimeId?: ID): Promise<T[]> {
		const ids = rates.map((rate) => rate.id).filter((id): id is ID => !!id);
		if (!ids.length) {
			return [];
		}

		const memberships = await this.taxRegimeRateService.listByRates(ids);
		if (!memberships.length) {
			// Every rate of the set is general, which is the ordinary case and the one this read must not
			// make slower than it was before regimes existed.
			return rates;
		}

		const byRate = new Map<ID, ID[]>();
		for (const membership of memberships) {
			byRate.set(membership.taxRateId, [...(byRate.get(membership.taxRateId) ?? []), membership.taxRegimeId]);
		}

		return rates.filter((rate) => {
			const regimes = rate.id ? byRate.get(rate.id) : undefined;

			return !regimes || (!!taxRegimeId && regimes.includes(taxRegimeId));
		});
	}

	/*
	|--------------------------------------------------------------------------
	| Matching and validation
	|--------------------------------------------------------------------------
	*/

	/**
	 * @param regime The regime a document is about to be taxed under.
	 * @throws BadRequestException when the regime selects no rate. A regime that selects nothing would make
	 * every regime-specific rate drop out of the candidate set and leave the document untaxed without
	 * anybody noticing, so it is refused where it is used rather than quietly applied.
	 */
	private async assertSelectsRates(regime: TaxRegime): Promise<void> {
		const members = await this.taxRegimeRateService.listByRegime(regime.id);

		if (!members.length) {
			throw new BadRequestException(
				`TAX_REGIME_EMPTY: the tax regime "${regime.code}" selects no rate, and a regime that selects nothing leaves a jurisdiction untaxed.`
			);
		}
	}

	/**
	 * @param regime The regime to test.
	 * @param now The moment to test it at.
	 * @returns Whether the regime's window contains the moment. An open bound is unbounded.
	 */
	private isLiveAt(regime: TaxRegime, now: Date): boolean {
		const startsAt = regime.startsAt ? new Date(regime.startsAt).getTime() : null;
		const endsAt = regime.endsAt ? new Date(regime.endsAt).getTime() : null;

		return (startsAt === null || startsAt <= now.getTime()) && (endsAt === null || endsAt > now.getTime());
	}

	/**
	 * @param regime The regime to test.
	 * @param destination The destination.
	 * @returns Whether the regime's zone admits the destination. A zone column the regime left null admits
	 * anything; a column it set admits only a destination that states the same value.
	 */
	private isInZone(regime: TaxRegime, destination: TaxRegimeSelectionRequest): boolean {
		if (regime.regionId && regime.regionId !== destination.regionId) {
			return false;
		}
		if (regime.countryCode && this.normalizeCode(regime.countryCode) !== this.normalizeCode(destination.countryCode)) {
			return false;
		}
		if (
			regime.provinceCode &&
			this.normalizeCode(regime.provinceCode) !== this.normalizeCode(destination.provinceCode)
		) {
			return false;
		}
		if (regime.postalCodePattern && !this.matchesPostalCode(regime.postalCodePattern, destination.postalCode)) {
			return false;
		}

		return true;
	}

	/**
	 * @param regime The regime to test.
	 * @param level The level of the ladder.
	 * @returns Whether the regime states exactly the zone the level describes.
	 */
	private isAtLevel(regime: TaxRegime, level: TaxRegimeMatchLevel): boolean {
		const hasCountry = !!regime.countryCode;
		const hasProvince = !!regime.provinceCode;
		const hasPostal = !!regime.postalCodePattern;

		switch (level) {
			case TaxRegimeMatchLevel.COUNTRY_PROVINCE_POSTAL:
				return hasCountry && hasProvince && hasPostal;
			case TaxRegimeMatchLevel.COUNTRY_PROVINCE:
				return hasCountry && hasProvince && !hasPostal;
			case TaxRegimeMatchLevel.COUNTRY:
				return hasCountry && !hasProvince && !hasPostal;
			case TaxRegimeMatchLevel.REGION:
				return !hasCountry && !!regime.regionId;
			default:
				return false;
		}
	}

	/**
	 * @param regimes The regimes that matched one level.
	 * @returns The one that wins it: the highest priority, then the later window, then the id, so the
	 * selection is deterministic.
	 */
	private winnerOf(regimes: TaxRegime[]): TaxRegime {
		return [...regimes].sort(
			(left, right) =>
				(right.priority ?? 0) - (left.priority ?? 0) ||
				this.toTime(right.startsAt) - this.toTime(left.startsAt) ||
				String(left.id).localeCompare(String(right.id))
		)[0];
	}

	/**
	 * @param regime The regime row.
	 * @param level How it was chosen.
	 * @returns The resolved regime, in the shape the resolution reports.
	 */
	private toResolvedRegime(regime: TaxRegime, level: TaxRegimeMatchLevel): IResolvedTaxRegime {
		return {
			taxRegimeId: regime.id,
			code: regime.code,
			name: regime.name,
			priority: regime.priority ?? 0,
			matchLevel: level
		};
	}

	/**
	 * @param pattern The regime's postal pattern.
	 * @param postalCode The destination's postal code.
	 * @returns Whether the pattern matches, case-insensitively and with the spacing of the code ignored,
	 * because the same code is written with and without its space.
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

	/**
	 * @param taxRegimeId The regime a write names.
	 * @throws NotFoundException when it is not one of the caller's tenant.
	 */
	private async assertRegimeExists(taxRegimeId: ID): Promise<void> {
		const regime = await this.findOneByIdString(taxRegimeId);
		if (!regime) {
			throw new NotFoundException(`The tax regime ${taxRegimeId} was not found.`);
		}
	}

	/**
	 * @param taxRateIds The rates a membership write names.
	 * @throws BadRequestException when one of them is not a rate of the caller's organization. A regime
	 * that selected a rate of another organization would keep that rate out of its own resolution and
	 * silently attach it to a set it was never negotiated for.
	 */
	private async assertRatesExist(taxRateIds: ID[]): Promise<void> {
		if (!taxRateIds.length) {
			return;
		}

		const found = await this.typeOrmTaxRateRepository.find({
			where: { id: In(taxRateIds), organizationId: RequestContext.currentOrganizationId() },
			select: { id: true }
		});
		const known = new Set(found.map((rate) => rate.id));
		const missing = taxRateIds.filter((id) => !known.has(id));

		if (missing.length) {
			throw new BadRequestException(
				`The following rates are not rates of this organization, so a regime cannot select them: ${missing.join(', ')}.`
			);
		}
	}

	/**
	 * @param startsAt The start of the window, when it has one.
	 * @param endsAt The end of the window, when it has one.
	 * @throws BadRequestException when the window ends before it starts.
	 */
	private assertWindow(startsAt?: DeepPartial<Date>, endsAt?: DeepPartial<Date>): void {
		const from = startsAt ? new Date(String(startsAt)) : undefined;
		const to = endsAt ? new Date(String(endsAt)) : undefined;

		if (from && to && to.getTime() <= from.getTime()) {
			throw new BadRequestException('The window of a tax regime must end after it starts.');
		}
	}

	/**
	 * @param pattern The postal pattern, when the caller supplied one.
	 * @throws BadRequestException when it does not compile as a pattern. A pattern, never a list: a list of
	 * postal codes would need a table of its own.
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
	 * @returns The organization the selection happens in.
	 * @throws BadRequestException when the request carries none.
	 */
	private requireOrganizationId(): ID {
		const organizationId = RequestContext.currentOrganizationId();
		if (!organizationId) {
			throw new BadRequestException(
				'Tax regimes are selected inside an organization, and none was resolved for this request.'
			);
		}

		return organizationId;
	}
}
