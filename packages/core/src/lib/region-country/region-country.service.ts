import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
	ChannelRegionRefusalReason,
	ID,
	IRegionCountry,
	IRegionCountryInput
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { RegionService } from '../region/region.service';
import { RegionCountry } from './region-country.entity';
import { TypeOrmRegionCountryRepository } from './repository/type-orm-region-country.repository';
import { MikroOrmRegionCountryRepository } from './repository/mikro-orm-region-country.repository';

/**
 * Which countries a commercial geography serves, and where it does not tax them.
 *
 * **The membership is the answer to two questions at once.** "Is this address inside the region" and "is
 * a sale into this country exempt" are asked together, by the same checkout, in the same read — which is
 * why the pair carries the exemption flag and the optional province scope rather than the region holding
 * a list of identifiers.
 *
 * **One row per pair among live rows.** A soft-deleted membership must not keep the pair occupied for
 * ever, and two live rows for one pair are two answers to the same question; the partial unique index
 * states it, and this service refuses the duplicate before the database has to. On MySQL, where the
 * dialect has no filtered index, the migration expresses the same rule with a generated key column.
 *
 * **A province scope is absent or a non-empty list.** The absent form means the whole country is in the
 * region; the list form means only those provinces are. An **empty** list is refused, because every
 * consumer reads absence as "the whole country" and an empty list as "nothing" — one stored value with
 * two possible readings is exactly the value a service check exists to reject.
 *
 * **Membership is written through this service and never by a cascade.** Replacing a region's countries
 * is the operation the administration surface offers, and it is expressed here as a set: the rows the
 * caller states are written, the ones that are absent are withdrawn in the same transaction, and the
 * region's membership after the call is exactly what the caller stated.
 */
@Injectable()
export class RegionCountryService extends TenantAwareCrudService<RegionCountry> {
	constructor(
		readonly typeOrmRegionCountryRepository: TypeOrmRegionCountryRepository,
		readonly mikroOrmRegionCountryRepository: MikroOrmRegionCountryRepository,
		/**
		 * The region service, for the one check every membership write needs: the region has to be in the
		 * caller's scope before a country is placed in it. The dependency runs one way — the region service
		 * knows nothing about membership.
		 */
		private readonly regionService: RegionService
	) {
		super(typeOrmRegionCountryRepository, mikroOrmRegionCountryRepository);
	}

	/**
	 * The tenant and organization of the caller, which every query in this service is scoped to.
	 */
	protected get scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}

	/**
	 * Places a country in a region.
	 *
	 * The region is resolved first, so a membership cannot be written against a region of another
	 * organization or against one that does not exist. The pair is probed before the row is written, so
	 * the refusal names the pair rather than surfacing a driver's duplicate-key message.
	 *
	 * @param regionId The region the country joins.
	 * @param input The country and its two facts.
	 * @returns The stored membership.
	 * @throws BadRequestException when the country is absent, when the province scope is an empty list,
	 * or when the region already serves the country.
	 * @throws NotFoundException when the region is not in the caller's scope.
	 */
	async addCountry(regionId: ID, input: IRegionCountryInput): Promise<IRegionCountry> {
		await this.regionService.findRegionOrFail(regionId);

		if (!input?.countryId) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_REQUIRED_FIELD}: a region serves a country, and no country was presented.`
			);
		}

		this.assertProvinceScope(input.provinceCodes);

		const existing = await this.findMembership(regionId, input.countryId);

		if (existing) {
			throw new BadRequestException(
				`${ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION}: ${
					ChannelRegionRefusalReason.REGION_COUNTRY_EXISTS
				} — region '${String(regionId)}' already serves country '${String(input.countryId)}'.`
			);
		}

		return this.create({
			...input,
			regionId,
			isTaxExempt: input.isTaxExempt ?? false,
			...this.scope
		} as never);
	}

	/**
	 * The countries a region serves.
	 *
	 * @param regionId The region.
	 * @returns The membership rows.
	 */
	async listCountries(regionId: ID): Promise<IRegionCountry[]> {
		const rows: RegionCountry[] = await this.find({ where: { regionId, ...this.scope } } as never);

		return rows ?? [];
	}

	/**
	 * The identifiers of the countries a region serves.
	 *
	 * The country set of a region is the union of its membership rows and is never stored denormalised,
	 * so this is the only form in which "which countries are in this region" is answered; a caller that
	 * carries the answer away is carrying a snapshot, and the schema chapter says so.
	 *
	 * @param regionId The region.
	 * @returns The country identifiers.
	 */
	async countryIds(regionId: ID): Promise<ID[]> {
		return (await this.listCountries(regionId)).map((row) => row.countryId);
	}

	/**
	 * Replaces a region's country set in one transaction.
	 *
	 * This is the operation the administration surface offers, and it is deliberately a **set**: the
	 * memberships the caller states are written, the ones it leaves out are withdrawn, and what the
	 * region serves afterwards is exactly what was stated. Writing it member by member would make
	 * "remove a country" and "add a country" two calls that can each fail on their own, leaving a set
	 * nobody asked for.
	 *
	 * @param regionId The region whose set is replaced.
	 * @param countries The members the region serves afterwards.
	 * @returns The stored membership rows.
	 * @throws BadRequestException when two members name the same country or a province scope is empty.
	 * @throws NotFoundException when the region is not in the caller's scope.
	 */
	async replaceCountries(regionId: ID, countries: IRegionCountryInput[]): Promise<IRegionCountry[]> {
		await this.regionService.findRegionOrFail(regionId);

		const members = countries ?? [];
		const seen = new Set<ID>();

		for (const member of members) {
			if (!member?.countryId) {
				throw new BadRequestException(
					`${ApiErrorCode.VALIDATION_REQUIRED_FIELD}: every member of a region's country set names a country, and one did not.`
				);
			}

			if (seen.has(member.countryId)) {
				throw new BadRequestException(
					`${ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION}: ${
						ChannelRegionRefusalReason.REGION_COUNTRY_EXISTS
					} — country '${String(member.countryId)}' is stated twice in one country set, and a region serves a country once.`
				);
			}

			seen.add(member.countryId);
			this.assertProvinceScope(member.provinceCodes);
		}

		await this.typeOrmRegionCountryRepository.manager.transaction(async (manager) => {
			const current: RegionCountry[] = await manager.find(RegionCountry, {
				where: { regionId, ...this.scope }
			} as never);

			for (const row of current) {
				if (!seen.has(row.countryId)) {
					row.deletedAt = new Date();
					await manager.save(RegionCountry, row);
				}
			}

			for (const member of members) {
				const row = current.find((one) => one.countryId === member.countryId);

				if (row) {
					row.isTaxExempt = member.isTaxExempt ?? false;
					row.provinceCodes = member.provinceCodes;
					row.deletedAt = undefined;
					await manager.save(RegionCountry, row);
				} else {
					await manager.save(RegionCountry, {
						countryId: member.countryId,
						regionId,
						isTaxExempt: member.isTaxExempt ?? false,
						provinceCodes: member.provinceCodes,
						...this.scope
					} as never);
				}
			}
		});

		return this.listCountries(regionId);
	}

	/**
	 * Changes the two facts of a membership that exists.
	 *
	 * The pair itself is not editable: a membership moved to another country is a different membership,
	 * and moving one would silently change which addresses a region answers for.
	 *
	 * @param regionId The region.
	 * @param countryId The country.
	 * @param input The facts to change.
	 * @returns The stored membership.
	 * @throws BadRequestException when the province scope is an empty list.
	 * @throws NotFoundException when the membership does not exist in the caller's scope.
	 */
	async updateCountry(regionId: ID, countryId: ID, input: IRegionCountryInput): Promise<IRegionCountry> {
		const membership = await this.findMembershipOrFail(regionId, countryId);

		this.assertProvinceScope(input?.provinceCodes);

		await this.update(membership.id, {
			...(input.isTaxExempt !== undefined ? { isTaxExempt: input.isTaxExempt } : {}),
			...(input.provinceCodes !== undefined ? { provinceCodes: input.provinceCodes } : {})
		} as never);

		return this.findMembershipOrFail(regionId, countryId);
	}

	/**
	 * Withdraws a country from a region.
	 *
	 * @param regionId The region.
	 * @param countryId The country.
	 * @throws NotFoundException when the membership does not exist in the caller's scope.
	 */
	async removeCountry(regionId: ID, countryId: ID): Promise<void> {
		const membership = await this.findMembershipOrFail(regionId, countryId);

		await this.softDelete(membership.id);
	}

	/**
	 * Whether a region serves a country.
	 *
	 * @param regionId The region.
	 * @param countryId The country.
	 * @returns True when a live membership row exists for the pair.
	 */
	async isCountryServed(regionId: ID, countryId: ID): Promise<boolean> {
		return Boolean(await this.findMembership(regionId, countryId));
	}

	/**
	 * Refuses a country the region does not serve — the check a shipping or billing address runs.
	 *
	 * A refusal is the answer, not an exception to be avoided: the platform says which region refused the
	 * country rather than silently pricing the cart in another geography, because a wrong region is a
	 * wrong tax total and not a wrong label.
	 *
	 * @param regionId The region.
	 * @param countryId The country.
	 * @throws BadRequestException when the region serves no membership row for the country.
	 */
	async assertCountryServed(regionId: ID, countryId: ID): Promise<void> {
		if (await this.isCountryServed(regionId, countryId)) {
			return;
		}

		throw new BadRequestException(
			`${ApiErrorCode.VALIDATION_FAILED}: ${ChannelRegionRefusalReason.REGION_COUNTRY_NOT_ALLOWED} — country '${String(
				countryId
			)}' is not served by region '${String(regionId)}'.`
		);
	}

	/**
	 * The membership row of one pair, when the region serves the country.
	 *
	 * @param regionId The region.
	 * @param countryId The country.
	 * @returns The membership, or null.
	 */
	async findMembership(regionId: ID, countryId: ID): Promise<IRegionCountry | null> {
		const rows: RegionCountry[] = await this.find({
			where: { regionId, countryId, ...this.scope }
		} as never);

		return rows.length ? rows[0] : null;
	}

	/**
	 * Loads the membership of one pair.
	 *
	 * @param regionId The region.
	 * @param countryId The country.
	 * @returns The membership.
	 * @throws NotFoundException when the region serves no row for the country.
	 */
	async findMembershipOrFail(regionId: ID, countryId: ID): Promise<IRegionCountry> {
		const membership = await this.findMembership(regionId, countryId);

		if (!membership) {
			throw new NotFoundException(
				`${ApiErrorCode.RESOURCE_NOT_FOUND}: ${
					ChannelRegionRefusalReason.REGION_COUNTRY_NOT_FOUND
				} — region '${String(regionId)}' serves no row for country '${String(countryId)}'.`
			);
		}

		return membership;
	}

	/**
	 * Refuses a province scope that is neither absent nor a non-empty list.
	 *
	 * The absent form and the list form mean different things and both are legitimate; the empty list
	 * means nothing at all while reading, to every consumer that tests for absence, as "the whole
	 * country". One stored value with two readings is what this check rejects.
	 *
	 * @param provinceCodes The scope the caller stated.
	 * @throws BadRequestException when the scope is an empty list, or holds a blank code.
	 */
	private assertProvinceScope(provinceCodes?: string[] | null): void {
		if (provinceCodes === undefined || provinceCodes === null) {
			return;
		}

		const blank = !Array.isArray(provinceCodes) || provinceCodes.length === 0;
		const empty = Array.isArray(provinceCodes) && provinceCodes.some((code) => !String(code ?? '').trim());

		if (blank || empty) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_FAILED}: ${
					ChannelRegionRefusalReason.REGION_COUNTRY_PROVINCES_INVALID
				} — a province scope is either absent, which means the whole country, or a non-empty list of province codes; an empty or blank one names a scope nothing can be read from.`
			);
		}
	}
}
