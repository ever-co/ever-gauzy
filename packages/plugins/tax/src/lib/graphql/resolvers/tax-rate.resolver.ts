import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { NotFoundException, UseGuards } from '@nestjs/common';
import { FindManyOptions, FindOptionsWhere, In, Raw } from 'typeorm';
import { DecimalString, ID } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { TAX_PERMISSION_VALUES, taxPermission } from '../tax.permissions';
import { IResolvedTaxRate, TaxWriteInput } from '../tax.types';
import { TaxRate } from './tax-rate.entity';
import { TaxRateService, formatTaxRate } from './tax-rate.service';
import { toConnection } from './connection.helper';
import {
	CreateTaxRateInput,
	PageInput,
	ResolveTaxRateInput,
	SortInput,
	TaxRateConnection,
	TaxRateFilterInput,
	TaxRateSortField,
	UpdateTaxRateInput
} from './graphql.types';

/**
 * The fields of the rate type that may be sorted by, as the entity names them.
 */
const TAX_RATE_SORT_FIELDS: Record<TaxRateSortField, string> = {
	PRIORITY: 'priority',
	RATE: 'rate',
	NAME: 'name',
	CODE: 'code',
	COUNTRY_CODE: 'countryCode',
	STARTS_AT: 'startsAt',
	CREATED_AT: 'createdAt',
	UPDATED_AT: 'updatedAt'
};

/**
 * The tax rate resource over GraphQL.
 *
 * Beside the CRUD root fields the resolver exposes the resolution the capability exists for: given a
 * category and a destination it returns the rates that apply, most specific zone first. Resolution is a
 * read, so it carries the view permission like every other read here, and the mutations carry the edit
 * permission, which overrides the class-level one for that method.
 */
@Resolver('TaxRate')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_VIEW))
export class TaxRateResolver {
	constructor(private readonly taxRateService: TaxRateService) {}

	/**
	 * Lists the rates of the caller's organization.
	 */
	@Query('taxRates')
	async taxRates(
		@Args('filter') filter?: TaxRateFilterInput,
		@Args('sort') sort?: Array<SortInput<TaxRateSortField>>,
		@Args('page') page?: PageInput,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('withDeleted') withDeleted?: boolean
	): Promise<TaxRateConnection> {
		const options = this.toFindOptions(filter, sort, withDeleted);
		options.take = limit ?? page?.first ?? undefined;
		options.skip = offset ?? undefined;

		const { items, total } = await this.taxRateService.paginate(options);

		return toConnection<TaxRate, TaxRate>(items, total, page);
	}

	/**
	 * Reads one rate.
	 *
	 * @throws NotFoundException when it does not exist in the caller's tenant.
	 */
	@Query('taxRate')
	async taxRate(@Args('id') id: ID): Promise<TaxRate> {
		const rate = await this.taxRateService.findOneByIdString(id);
		if (!rate) {
			throw new NotFoundException(`The tax rate ${id} was not found.`);
		}

		return rate;
	}

	/**
	 * Resolves the rates that apply to a destination, most specific zone first.
	 */
	@Query('resolveTaxRate')
	async resolveTaxRate(@Args('input') input: ResolveTaxRateInput): Promise<IResolvedTaxRate[]> {
		return await this.taxRateService.resolve({
			taxCategoryId: input.taxCategoryId,
			regionId: input.regionId,
			countryCode: input.countryCode,
			provinceCode: input.provinceCode,
			postalCode: input.postalCode,
			regionTaxInclusive: input.regionTaxInclusive,
			now: input.at ? new Date(input.at) : undefined
		});
	}

	/**
	 * Creates a rate.
	 */
	@Mutation('createTaxRate')
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_EDIT))
	async createTaxRate(@Args('input') input: CreateTaxRateInput): Promise<TaxRate> {
		return await this.taxRateService.create(input as TaxWriteInput<TaxRate>);
	}

	/**
	 * Amends a rate.
	 */
	@Mutation('updateTaxRate')
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_EDIT))
	async updateTaxRate(@Args('input') input: UpdateTaxRateInput): Promise<TaxRate> {
		const { id, ...changes } = input;

		return await this.taxRateService.update(id, changes as TaxWriteInput<TaxRate>);
	}

	/**
	 * Retires a rate and returns the retired row.
	 *
	 * @throws NotFoundException when it does not exist in the caller's tenant.
	 */
	@Mutation('deleteTaxRate')
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_EDIT))
	async deleteTaxRate(@Args('id') id: ID): Promise<TaxRate> {
		const rate = await this.taxRateService.findOneByIdString(id);
		if (!rate) {
			throw new NotFoundException(`The tax rate ${id} was not found.`);
		}

		await this.taxRateService.delete(id);

		return rate;
	}

	/**
	 * Serialises a rate as the fixed six-decimal string the wire carries.
	 *
	 * The column is `numeric(9,6)` and is read through the platform's numeric transformer, which hands
	 * over a number; the schema declares a `Decimal`, so the value is rendered here rather than being
	 * exposed as a float.
	 */
	@ResolveField('rate')
	rate(@Parent() taxRate: TaxRate): DecimalString {
		return formatTaxRate(taxRate.rate);
	}

	/**
	 * @param filter How the listing is narrowed.
	 * @param sort How it is ordered; the newest first when it is omitted.
	 * @param withDeleted Whether retired rows are included.
	 * @returns The find options the service paginates with.
	 */
	private toFindOptions(
		filter?: TaxRateFilterInput,
		sort?: Array<SortInput<TaxRateSortField>>,
		withDeleted?: boolean
	): FindManyOptions<TaxRate> {
		const where: FindOptionsWhere<TaxRate> = {};

		if (filter?.ids?.length) {
			where.id = In(filter.ids);
		}
		if (filter?.taxCategoryId) {
			where.taxCategoryId = filter.taxCategoryId;
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
		if (filter?.code) {
			where.code = filter.code;
		}
		if (filter?.name) {
			where.name = filter.name;
		}
		if (filter?.providerKey) {
			where.providerKey = filter.providerKey;
		}
		if (filter?.isCompound !== undefined) {
			where.isCompound = filter.isCompound;
		}
		if (filter?.isInclusive !== undefined) {
			where.isInclusive = filter.isInclusive;
		}
		if (filter?.isDefault !== undefined) {
			where.isDefault = filter.isDefault;
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
	 * Narrows the listing to the rates whose validity window contains a moment. An open bound is
	 * unbounded, so a rate that never started and a rate that was never ended both stay eligible.
	 *
	 * @param where The conditions being built.
	 * @param liveAt The moment to test.
	 */
	private applyLiveWindow(where: FindOptionsWhere<TaxRate>, liveAt: Date): void {
		where.startsAt = Raw((alias: string) => `(${alias} IS NULL OR ${alias} <= :liveAt)`, { liveAt });
		where.endsAt = Raw((alias: string) => `(${alias} IS NULL OR ${alias} > :liveAt)`, { liveAt });
	}

	/**
	 * @param sort The requested ordering.
	 * @returns The ordering the repository reads, newest first by default.
	 */
	private toOrder(sort?: Array<SortInput<TaxRateSortField>>): Record<string, 'ASC' | 'DESC'> {
		if (!sort?.length) {
			return { createdAt: 'DESC' };
		}

		return sort.reduce<Record<string, 'ASC' | 'DESC'>>((order, entry) => {
			const field = TAX_RATE_SORT_FIELDS[entry.field];
			if (field) {
				order[field] = entry.direction === 'ASC' ? 'ASC' : 'DESC';
			}

			return order;
		}, {});
	}
}
