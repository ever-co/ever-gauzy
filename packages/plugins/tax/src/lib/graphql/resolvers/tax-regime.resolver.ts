import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { NotFoundException, UseGuards } from '@nestjs/common';
import { FindManyOptions, FindOptionsWhere, In, Raw } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { TAX_PERMISSION_VALUES, taxPermission } from '../../tax.permissions';
import { IResolvedTaxRegime, TaxWriteInput } from '../../tax.types';
import { TaxRegimeRate } from '../../tax-regime-rate/tax-regime-rate.entity';
import { TaxRegime } from '../../tax-regime/tax-regime.entity';
import { TaxRegimeService } from '../../tax-regime/tax-regime.service';
import { toConnection } from '../connection.helper';
import {
	CreateTaxRegimeInput,
	PageInput,
	ResolveTaxRegimeInput,
	SetTaxRegimeRatesInput,
	SortInput,
	TaxRegimeConnection,
	TaxRegimeFilterInput,
	TaxRegimeSortField,
	UpdateTaxRegimeInput
} from '../graphql.types';

/**
 * The fields of the regime type that may be sorted by, as the entity names them.
 */
const TAX_REGIME_SORT_FIELDS: Record<TaxRegimeSortField, string> = {
	PRIORITY: 'priority',
	NAME: 'name',
	CODE: 'code',
	STARTS_AT: 'startsAt',
	CREATED_AT: 'createdAt',
	UPDATED_AT: 'updatedAt'
};

/**
 * The tax regime resource over GraphQL.
 *
 * The resolver mirrors the controller field for field, under the same guards and the same permissions, so
 * the two protocols cannot drift: a caller reaches the regime, its rate membership and the resolution that
 * selects it over either door with the same authority.
 *
 * Membership is a field of the regime and a mutation on the regime rather than a resource of its own,
 * because a membership row has no lifecycle: it is the statement "this rate belongs to this set", and the
 * permission that guards reshaping a set is the regime's own.
 */
@Resolver('TaxRegime')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_REGIMES_VIEW))
export class TaxRegimeResolver {
	constructor(private readonly taxRegimeService: TaxRegimeService) {}

	/**
	 * Lists the regimes of the caller's organization.
	 */
	@Query('taxRegimes')
	async taxRegimes(
		@Args('filter') filter?: TaxRegimeFilterInput,
		@Args('sort') sort?: Array<SortInput<TaxRegimeSortField>>,
		@Args('page') page?: PageInput,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('withDeleted') withDeleted?: boolean
	): Promise<TaxRegimeConnection> {
		const options = this.toFindOptions(filter, sort, withDeleted);
		options.take = limit ?? page?.first ?? undefined;
		options.skip = offset ?? undefined;

		const { items, total } = await this.taxRegimeService.paginate(options);

		return toConnection<TaxRegime, TaxRegime>(items, total, page);
	}

	/**
	 * Reads one regime.
	 *
	 * @throws NotFoundException when it does not exist in the caller's tenant.
	 */
	@Query('taxRegime')
	async taxRegime(@Args('id') id: ID): Promise<TaxRegime> {
		const regime = await this.taxRegimeService.findOneByIdString(id);
		if (!regime) {
			throw new NotFoundException(`The tax regime ${id} was not found.`);
		}

		return regime;
	}

	/**
	 * Reads the rates one regime selects.
	 */
	@Query('taxRegimeRates')
	async taxRegimeRates(@Args('id') id: ID): Promise<TaxRegimeRate[]> {
		return await this.taxRegimeService.listRates(id);
	}

	/**
	 * Resolves the regime a document is taxed under.
	 *
	 * The party's own assignment always wins; when it names none the most specific matching regime of the
	 * destination is selected, and when nothing matches the general set of rates applies.
	 */
	@Query('resolveTaxRegime')
	async resolveTaxRegime(@Args('input') input: ResolveTaxRegimeInput): Promise<IResolvedTaxRegime | undefined> {
		return await this.taxRegimeService.resolveRegime({
			taxRegimeId: input.taxRegimeId,
			partyTaxRegistrationPresent: input.partyTaxRegistrationPresent,
			regionId: input.regionId,
			countryCode: input.countryCode,
			provinceCode: input.provinceCode,
			postalCode: input.postalCode,
			now: input.at ? new Date(input.at) : undefined
		});
	}

	/**
	 * Creates a regime.
	 */
	@Mutation('createTaxRegime')
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_REGIMES_EDIT))
	async createTaxRegime(@Args('input') input: CreateTaxRegimeInput): Promise<TaxRegime> {
		return await this.taxRegimeService.create(input as TaxWriteInput<TaxRegime>);
	}

	/**
	 * Amends a regime.
	 */
	@Mutation('updateTaxRegime')
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_REGIMES_EDIT))
	async updateTaxRegime(@Args('input') input: UpdateTaxRegimeInput): Promise<TaxRegime> {
		const { id, ...changes } = input;

		return await this.taxRegimeService.update(id, changes as TaxWriteInput<TaxRegime>);
	}

	/**
	 * Retires a regime and returns the retired row.
	 *
	 * @throws NotFoundException when it does not exist in the caller's tenant.
	 */
	@Mutation('deleteTaxRegime')
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_REGIMES_EDIT))
	async deleteTaxRegime(@Args('id') id: ID): Promise<TaxRegime> {
		const regime = await this.taxRegimeService.findOneByIdString(id);
		if (!regime) {
			throw new NotFoundException(`The tax regime ${id} was not found.`);
		}

		await this.taxRegimeService.delete(id);

		return regime;
	}

	/**
	 * Sets which rates a regime selects.
	 */
	@Mutation('setTaxRegimeRates')
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_REGIMES_EDIT))
	async setTaxRegimeRates(@Args('input') input: SetTaxRegimeRatesInput): Promise<TaxRegimeRate[]> {
		return await this.taxRegimeService.setRates(input.id, input.taxRateIds);
	}

	/**
	 * The rates the regime selects, read through the membership service.
	 */
	@ResolveField('rates')
	async rates(@Parent() regime: TaxRegime): Promise<TaxRegimeRate[]> {
		return await this.taxRegimeService.listRates(regime.id);
	}

	/**
	 * @param filter How the listing is narrowed.
	 * @param sort How it is ordered; the newest first when it is omitted.
	 * @param withDeleted Whether retired rows are included.
	 * @returns The find options the service paginates with.
	 */
	private toFindOptions(
		filter?: TaxRegimeFilterInput,
		sort?: Array<SortInput<TaxRegimeSortField>>,
		withDeleted?: boolean
	): FindManyOptions<TaxRegime> {
		const where: FindOptionsWhere<TaxRegime> = {};

		if (filter?.ids?.length) {
			where.id = In(filter.ids);
		}
		if (filter?.code) {
			where.code = filter.code;
		}
		if (filter?.name) {
			where.name = filter.name;
		}
		if (filter?.regionId) {
			where.regionId = filter.regionId;
		}
		if (filter?.countryCode) {
			where.countryCode = filter.countryCode;
		}
		if (filter?.provinceCode) {
			where.provinceCode = filter.provinceCode;
		}
		if (filter?.postalCodePattern) {
			where.postalCodePattern = filter.postalCodePattern;
		}
		if (filter?.requiresPartyTaxRegistration !== undefined) {
			where.requiresPartyTaxRegistration = filter.requiresPartyTaxRegistration;
		}
		if (filter?.isActive !== undefined) {
			where.isActive = filter.isActive;
		}
		if (filter?.liveAt) {
			this.applyLiveWindow(where, filter.liveAt);
		}

		return {
			where,
			order: this.toOrder(sort),
			...(withDeleted ? { withDeleted: true } : {})
		};
	}

	/**
	 * Narrows the listing to the regimes whose validity window contains a moment. An open bound is
	 * unbounded, so a regime that never started and one that was never ended both stay eligible.
	 *
	 * @param where The conditions being built.
	 * @param liveAt The moment to test.
	 */
	private applyLiveWindow(where: FindOptionsWhere<TaxRegime>, liveAt: Date): void {
		where.startsAt = Raw((alias: string) => `(${alias} IS NULL OR ${alias} <= :liveAt)`, { liveAt });
		where.endsAt = Raw((alias: string) => `(${alias} IS NULL OR ${alias} > :liveAt)`, { liveAt });
	}

	/**
	 * @param sort The requested ordering.
	 * @returns The ordering the repository reads, newest first by default.
	 */
	private toOrder(sort?: Array<SortInput<TaxRegimeSortField>>): Record<string, 'ASC' | 'DESC'> {
		if (!sort?.length) {
			return { createdAt: 'DESC' };
		}

		return sort.reduce<Record<string, 'ASC' | 'DESC'>>((order, entry) => {
			const field = TAX_REGIME_SORT_FIELDS[entry.field];
			if (field) {
				order[field] = entry.direction === 'ASC' ? 'ASC' : 'DESC';
			}

			return order;
		}, {});
	}
}
