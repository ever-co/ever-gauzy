import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { NotFoundException, UseGuards } from '@nestjs/common';
import { FindManyOptions, FindOptionsWhere, In } from 'typeorm';
import { DecimalString, ID } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { TAX_PERMISSION_VALUES, taxPermission } from '../../tax.permissions';
import { IResolvedTaxRate, TaxCalculationResult, TaxWriteInput } from '../../tax.types';
import { TaxRatePart } from '../../tax-rate-part/tax-rate-part.entity';
import { TaxRatePartService } from '../../tax-rate-part/tax-rate-part.service';
import { TaxRate } from '../../tax-rate/tax-rate.entity';
import { TaxRateService, formatTaxRate } from '../../tax-rate/tax-rate.service';
import { toConnection } from '../connection.helper';
import { applyPageWindow, liveWindowConditions } from '../predicate.helper';
import {
	CreateTaxRateInput,
	PageInput,
	ResolveTaxRateInput,
	SetTaxRatePartsInput,
	SortInput,
	TaxCalculationInput,
	TaxRateConnection,
	TaxRateFilterInput,
	TaxRateSortField,
	UpdateTaxRateInput
} from '../graphql.types';

/**
 * The fields of the rate type that may be sorted by, as the entity names them.
 */
const TAX_RATE_SORT_FIELDS: Record<TaxRateSortField, string> = {
	PRIORITY: 'priority',
	RATE: 'rate',
	NAME: 'name',
	CODE: 'code',
	COUNTRY_CODE: 'countryCode',
	DIRECTION: 'direction',
	STARTS_AT: 'startsAt',
	CREATED_AT: 'createdAt',
	UPDATED_AT: 'updatedAt'
};

/**
 * The tax rate resource over GraphQL.
 *
 * Beside the CRUD root fields the resolver exposes the resolution the capability exists for: given a
 * category, the party's assignment and a destination it returns the rates that apply, direction and regime
 * first and then most specific zone. Resolution is a read, so it carries the view permission like every
 * other read here, and the mutations carry the edit permission, which overrides the class-level one for
 * that method.
 *
 * A rate's parts are reached through the rate and not as a resource of their own: a part exists only as an
 * element of its rate's ordered list and is written by the person who authors the rate, under the rate's
 * editing permission.
 *
 * **The gate is the catalogue's.** `FeatureFlagGuard` is appended to the guard chain this resolver
 * already carried, and the code it reads is `FEATURE_GRAPHQL` — the commerce catalogue's entry for "the
 * GraphQL endpoint and its resolvers, under the same guards and permissions as REST". The code is
 * imported rather than restated because the value has to agree with the catalogue's `code` and nothing
 * checks one string against another: a literal that drifted names a code no catalogue row carries, which
 * the guard resolves as disabled, so every field here would answer `Cannot query field <name>` for every
 * caller with nothing red anywhere. One statement on the class puts every field behind it, and a tenant
 * that switched the capability off is answered the refusal a disabled capability's routes answer with a
 * 404.
 */
@Resolver('TaxRate')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_VIEW))
export class TaxRateResolver {
	constructor(
		private readonly taxRateService: TaxRateService,
		private readonly taxRatePartService: TaxRatePartService
	) {}

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
		const options = applyPageWindow(this.toFindOptions(filter, sort, withDeleted), {
			limit,
			first: page?.first,
			offset
		});

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
	 * Resolves the rates that apply to a destination, direction and regime first.
	 */
	@Query('resolveTaxRate')
	async resolveTaxRate(@Args('input') input: ResolveTaxRateInput): Promise<IResolvedTaxRate[]> {
		return await this.taxRateService.resolve({
			taxCategoryId: input.taxCategoryId,
			taxRegimeId: input.taxRegimeId,
			partyTaxRegistrationPresent: input.partyTaxRegistrationPresent,
			documentDirection: input.documentDirection,
			regionId: input.regionId,
			countryCode: input.countryCode,
			provinceCode: input.provinceCode,
			postalCode: input.postalCode,
			regionTaxInclusive: input.regionTaxInclusive,
			now: input.at ? new Date(input.at) : undefined
		});
	}

	/**
	 * Reads the ordered parts a rate is made of.
	 */
	@Query('taxRateParts')
	async taxRateParts(@Args('id') id: ID): Promise<TaxRatePart[]> {
		return await this.taxRateService.listParts(id);
	}

	/**
	 * Computes the tax of a set of amounts.
	 *
	 * The route it mirrors is `POST /tax-rates/calculate`, and the mapping is the route's own, member for
	 * member: the lines lose everything the computation does not read — a line's own destination is kept
	 * and its identity is not — and the request-level members are forwarded as they stand. The one member
	 * that is not forwarded verbatim is `at`, which the route turns into the `now` instant the validity
	 * windows are evaluated at; the field turns it into the same instant, so a caller that states one gets
	 * the same chain from either surface.
	 *
	 * The permission is the route's, which is the view grant: nothing is written, so this field is a query
	 * rather than a mutation, which is what its own type declares and what a generated client needs to be
	 * told. `06-api-specification.md` §7.6 spells the route `/tax/calculate` and this controller serves it
	 * at `/tax-rates/calculate`, and the spec's request admits a `cartId` this DTO has never carried — both
	 * are reported by this wave rather than resolved from one side.
	 *
	 * @param input The amounts and the destination they are taxed at.
	 * @returns The breakdown, which the caller persists through the tax ledger.
	 */
	@Query('calculateTax')
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_VIEW))
	async calculateTax(@Args('input') input: TaxCalculationInput): Promise<TaxCalculationResult> {
		return await this.taxRateService.calculate({
			currency: input.currency,
			lines: (input.lines ?? []).map((line) => ({
				referenceId: line.referenceId,
				taxCategoryId: line.taxCategoryId,
				amount: line.amount,
				quantity: line.quantity,
				regionId: line.regionId,
				countryCode: line.countryCode,
				provinceCode: line.provinceCode,
				postalCode: line.postalCode
			})),
			taxRegimeId: input.taxRegimeId,
			partyTaxRegistrationPresent: input.partyTaxRegistrationPresent,
			documentDirection: input.documentDirection,
			regionId: input.regionId,
			countryCode: input.countryCode,
			provinceCode: input.provinceCode,
			postalCode: input.postalCode,
			regionTaxInclusive: input.regionTaxInclusive,
			allowUntaxedCatalog: input.allowUntaxedCatalog,
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
	 * Retires a rate recoverably, keeping it and the tax lines that name it.
	 *
	 * The route it mirrors is `DELETE /tax-rates/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. Without this
	 * field a rate retired over GraphQL could not be brought back over GraphQL, while a REST caller could
	 * do both — and the hard delete the endpoint does serve drops the row entirely, which is the
	 * operation the soft route exists to avoid.
	 *
	 * The permission is the controller's own for the route — `TAX_RATES_EDIT` — and not the class-level
	 * view grant, because a retired rate stops resolving for every destination that had matched it.
	 *
	 * @param id The rate to retire.
	 * @returns The rate, as the soft delete left it.
	 */
	@Mutation('softDeleteTaxRate')
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_EDIT))
	async softDeleteTaxRate(@Args('id') id: ID): Promise<TaxRate> {
		return await this.taxRateService.softRemove(id);
	}

	/**
	 * Restores a rate that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /tax-rates/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A restored rate
	 * becomes a candidate for the destinations it matched again, which is why the route states the
	 * editing grant rather than the reading one.
	 *
	 * @param id The rate to restore.
	 * @returns The restored rate.
	 */
	@Mutation('recoverTaxRate')
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_EDIT))
	async recoverTaxRate(@Args('id') id: ID): Promise<TaxRate> {
		return await this.taxRateService.softRecover(id);
	}

	/**
	 * Replaces the ordered parts a rate is made of.
	 */
	@Mutation('setTaxRateParts')
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_EDIT))
	async setTaxRateParts(@Args('input') input: SetTaxRatePartsInput): Promise<TaxRatePart[]> {
		return await this.taxRateService.setParts(input.id, input.parts as TaxWriteInput<TaxRatePart>[]);
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
	 * The ordered parts the rate is made of, read through the part service.
	 *
	 * An empty list means the rate carries its one implied part — `TAX`, 100 %, base 1 — which is the
	 * breakdown every rate produced before parts existed; the resolution reports that implied part so a
	 * caller never has to know the rule to read a breakdown.
	 */
	@ResolveField('parts')
	async parts(@Parent() taxRate: TaxRate): Promise<TaxRatePart[]> {
		return await this.taxRatePartService.listForRate(taxRate.id);
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
		if (filter?.amountType) {
			where.amountType = filter.amountType;
		}
		if (filter?.direction) {
			where.direction = filter.direction;
		}

		return {
			where: filter?.liveAt ? this.applyLiveWindow(where, filter.liveAt) : where,
			order: this.toOrder(sort),
			...(withDeleted ? { withDeleted: true } : {})
		};
	}

	/**
	 * Narrows the listing to the rates whose validity window contains a moment. An open bound is
	 * unbounded, so a rate that never started and a rate that was never ended both stay eligible.
	 *
	 * The window used to be written as two `Raw()` SQL fragments, which is a predicate only TypeORM can
	 * read: under `DB_ORM=mikro-orm` it was answered as no predicate at all, and this listing returned
	 * superseded rates and rates that had not started — the wrong rate, with nothing reported. The
	 * conditions are now stated with operators both ORMs translate, which `liveWindowConditions`
	 * expands into the four combinations of the two open bounds.
	 *
	 * @param where The conditions built so far.
	 * @param liveAt The moment to test.
	 * @returns The conditions to read as a disjunction.
	 */
	private applyLiveWindow(where: FindOptionsWhere<TaxRate>, liveAt: Date): Array<FindOptionsWhere<TaxRate>> {
		return liveWindowConditions<TaxRate>(where, liveAt);
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
