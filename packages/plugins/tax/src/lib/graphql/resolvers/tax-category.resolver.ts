import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { NotFoundException, UseGuards } from '@nestjs/common';
import { FindManyOptions, FindOptionsWhere, In } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { TAX_PERMISSION_VALUES, taxPermission } from '../../tax.permissions';
import { TaxCategory } from '../../tax-category/tax-category.entity';
import { TaxCategoryService } from '../../tax-category/tax-category.service';
import { TaxRate } from '../../tax-rate/tax-rate.entity';
import { TaxRateService } from '../../tax-rate/tax-rate.service';
import { TaxWriteInput } from '../../tax.types';
import { toConnection } from '../connection.helper';
import { applyPageWindow, searchConditions } from '../predicate.helper';
import {
	CreateTaxCategoryInput,
	PageInput,
	SortInput,
	TaxCategoryConnection,
	TaxCategoryFilterInput,
	TaxCategorySortField,
	UpdateTaxCategoryInput
} from '../graphql.types';

/**
 * The fields of the category type that may be sorted by, as the entity names them.
 */
const TAX_CATEGORY_SORT_FIELDS: Record<TaxCategorySortField, string> = {
	NAME: 'name',
	CODE: 'code',
	IS_DEFAULT: 'isDefault',
	CREATED_AT: 'createdAt',
	UPDATED_AT: 'updatedAt'
};

/**
 * The tax category resource over GraphQL.
 *
 * The guards and the permissions are the ones the REST controller carries, so the two surfaces cannot
 * disagree about who may read or amend a category: the guard resolves the same role permissions and
 * shares the same cache entry. Reads are guarded by the view permission; the three mutations carry the
 * edit permission, which overrides the class-level one for that method.
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
@Resolver('TaxCategory')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_CATEGORIES_VIEW))
export class TaxCategoryResolver {
	constructor(
		private readonly taxCategoryService: TaxCategoryService,
		private readonly taxRateService: TaxRateService
	) {}

	/**
	 * Lists the categories of the caller's organization.
	 */
	@Query('taxCategories')
	async taxCategories(
		@Args('filter') filter?: TaxCategoryFilterInput,
		@Args('sort') sort?: Array<SortInput<TaxCategorySortField>>,
		@Args('page') page?: PageInput,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('withDeleted') withDeleted?: boolean
	): Promise<TaxCategoryConnection> {
		const options = applyPageWindow(this.toFindOptions(filter, sort, withDeleted), {
			limit,
			first: page?.first,
			offset
		});

		const { items, total } = await this.taxCategoryService.paginate(options);

		return toConnection<TaxCategory, TaxCategory>(items, total, page);
	}

	/**
	 * Reads one category.
	 *
	 * @throws NotFoundException when it does not exist in the caller's tenant.
	 */
	@Query('taxCategory')
	async taxCategory(@Args('id') id: ID): Promise<TaxCategory> {
		const category = await this.taxCategoryService.findOneByIdString(id, { relations: ['rates'] });
		if (!category) {
			throw new NotFoundException(`The tax category ${id} was not found.`);
		}

		return category;
	}

	/**
	 * The rates of a category, loaded when a caller selects them.
	 */
	@ResolveField('rates')
	async rates(@Parent() category: TaxCategory): Promise<TaxRate[]> {
		if (Array.isArray(category.rates)) {
			return category.rates;
		}

		return await this.taxRateService.find({
			where: { taxCategoryId: category.id } as FindOptionsWhere<TaxRate>
		});
	}

	/**
	 * Creates a category.
	 */
	@Mutation('createTaxCategory')
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_CATEGORIES_EDIT))
	async createTaxCategory(@Args('input') input: CreateTaxCategoryInput): Promise<TaxCategory> {
		return await this.taxCategoryService.create(input as TaxWriteInput<TaxCategory>);
	}

	/**
	 * Amends a category.
	 */
	@Mutation('updateTaxCategory')
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_CATEGORIES_EDIT))
	async updateTaxCategory(@Args('input') input: UpdateTaxCategoryInput): Promise<TaxCategory> {
		const { id, ...changes } = input;

		return await this.taxCategoryService.update(id, changes as TaxWriteInput<TaxCategory>);
	}

	/**
	 * Retires a category and returns the retired row.
	 *
	 * @throws NotFoundException when it does not exist in the caller's tenant.
	 */
	@Mutation('deleteTaxCategory')
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_CATEGORIES_EDIT))
	async deleteTaxCategory(@Args('id') id: ID): Promise<TaxCategory> {
		const category = await this.taxCategoryService.findOneByIdString(id);
		if (!category) {
			throw new NotFoundException(`The tax category ${id} was not found.`);
		}

		await this.taxCategoryService.delete(id);

		return category;
	}

	/**
	 * @param filter How the listing is narrowed.
	 * @param sort How it is ordered; the newest first when it is omitted.
	 * @param withDeleted Whether retired rows are included.
	 * @returns The find options the service paginates with.
	 */
	private toFindOptions(
		filter?: TaxCategoryFilterInput,
		sort?: Array<SortInput<TaxCategorySortField>>,
		withDeleted?: boolean
	): FindManyOptions<TaxCategory> {
		const where: FindOptionsWhere<TaxCategory> = {};

		if (filter?.ids?.length) {
			where.id = In(filter.ids);
		}
		if (filter?.code) {
			where.code = filter.code;
		}
		if (filter?.isDefault !== undefined) {
			where.isDefault = filter.isDefault;
		}
		if (filter?.isActive !== undefined) {
			where.isActive = filter.isActive;
		}

		const options: FindManyOptions<TaxCategory> = {
			where: this.withSearch(where, filter),
			order: this.toOrder(sort),
			...(withDeleted ? { withDeleted: true } : {})
		};

		return options;
	}

	/**
	 * Adds the free-text narrowing, which is matched against the code and the name.
	 */
	private withSearch(
		where: FindOptionsWhere<TaxCategory>,
		filter?: TaxCategoryFilterInput
	): FindOptionsWhere<TaxCategory> | Array<FindOptionsWhere<TaxCategory>> {
		const search = filter?.search?.trim();
		if (!search) {
			return where;
		}

		return searchConditions<TaxCategory>(where, ['code', 'name'], search);
	}

	/**
	 * @param sort The requested ordering.
	 * @returns The ordering the repository reads, newest first by default.
	 */
	private toOrder(sort?: Array<SortInput<TaxCategorySortField>>): Record<string, 'ASC' | 'DESC'> {
		if (!sort?.length) {
			return { createdAt: 'DESC' };
		}

		return sort.reduce<Record<string, 'ASC' | 'DESC'>>((order, entry) => {
			const field = TAX_CATEGORY_SORT_FIELDS[entry.field];
			if (field) {
				order[field] = entry.direction === 'ASC' ? 'ASC' : 'DESC';
			}

			return order;
		}, {});
	}
}
