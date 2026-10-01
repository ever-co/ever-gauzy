import { BadRequestException, Injectable } from '@nestjs/common';
import { Brackets, FindOptionsRelations, SelectQueryBuilder } from 'typeorm';
import { isNotEmpty } from '@gauzy/utils';
import { FileStorageProviderEnum, IPagination, ITag, ITagFindInput } from '@gauzy/contracts';
import { getConfig } from '@gauzy/config';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { MultiORMEnum, parseFindOptionsRelations } from '../core/utils';
import { LIKE_OPERATOR } from '../core/util';
import { Tag } from './tag.entity';
import { FileStorage } from './../core/file-storage';
import { prepareSQLQuery as p } from './../database/database.helper';
import { MikroOrmTagRepository } from './repository/mikro-orm-tag.repository';
import { TypeOrmTagRepository } from './repository/type-orm-tag.repository';

/**
 * Relations a tag can be attached to, with the join alias and the `*_counter` field the tags page sums
 * into the usage count: [relation property, join alias, counter name].
 */
export const TAG_USAGE_COUNTERS: ReadonlyArray<readonly [string, string, string]> = [
	['candidates', 'candidate', 'candidate_counter'],
	['employees', 'employee', 'employee_counter'],
	['employeeLevels', 'employeeLevel', 'employee_level_counter'],
	['equipments', 'equipment', 'equipment_counter'],
	['eventTypes', 'eventType', 'event_type_counter'],
	['expenses', 'expense', 'expense_counter'],
	['incomes', 'income', 'income_counter'],
	['integrations', 'integration', 'integration_counter'],
	['invoices', 'invoice', 'invoice_counter'],
	['merchants', 'merchant', 'merchant_counter'],
	['organizations', 'organization', 'organization_counter'],
	['organizationContacts', 'organizationContact', 'organization_contact_counter'],
	['organizationDepartments', 'organizationDepartment', 'organization_department_counter'],
	['organizationEmploymentTypes', 'organizationEmploymentType', 'organization_employment_type_counter'],
	['expenseCategories', 'expenseCategory', 'expense_category_counter'],
	['organizationPositions', 'organizationPosition', 'organization_position_counter'],
	['organizationProjects', 'organizationProject', 'organization_project_counter'],
	['organizationTeams', 'organizationTeam', 'organization_team_counter'],
	['organizationVendors', 'organizationVendor', 'organization_vendor_counter'],
	['payments', 'payment', 'payment_counter'],
	['products', 'product', 'product_counter'],
	['requestApprovals', 'requestApproval', 'request_approval_counter'],
	['tasks', 'task', 'task_counter'],
	['users', 'user', 'user_counter'],
	['warehouses', 'warehouse', 'warehouse_counter']
];

@Injectable()
export class TagService extends TenantAwareCrudService<Tag> {
	constructor(typeOrmTagRepository: TypeOrmTagRepository, mikroOrmTagRepository: MikroOrmTagRepository) {
		super(typeOrmTagRepository, mikroOrmTagRepository);
	}

	/**
	 * GET tags by tenant or organization level
	 *
	 * @param input - Filter criteria for finding tags.
	 * @param relations - Optional relations to include in the query.
	 * @returns A pagination object containing the filtered tags and total count.
	 */
	async findTagsByLevel(input: ITagFindInput, relations: string[] = []): Promise<IPagination<ITag>> {
		// This method builds its own query instead of going through the CRUD read methods, so the
		// sink-level check in `CrudService` never runs for it. Assert the sensitive-relation table
		// here too: every tenant-scoped entity exposes an `organization` relation, so a client-supplied
		// `relations` reaches the protected rows from any entity, not only from the ones whose
		// controller mounts `SensitiveRelationsInterceptor`.
		this.assertRelationsPermitted({ relations });

		const tenantId = RequestContext.currentTenantId() || input.tenantId;
		const { organizationId, organizationTeamId, name, color, description } = input;

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const where: any = {
					tenantId,
					$or: [{ organizationId: null }, { organizationId }],
					isSystem: false
				};
				if (isNotEmpty(organizationTeamId)) where.organizationTeamId = organizationTeamId;
				if (isNotEmpty(name)) where.name = { $ilike: `%${name}%` };
				if (isNotEmpty(color)) where.color = { $ilike: `%${color}%` };
				if (isNotEmpty(description)) where.description = { $ilike: `%${description}%` };

				const [items, total] = await this.mikroOrmRepository.findAndCount(where, {
					populate: relations as any[]
				});
				return { items: items.map((e) => this.serialize(e)) as ITag[], total };
			}
			case MultiORMEnum.TypeORM:
			default: {
				const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

				// Add relations if specified
				if (relations.length) {
					query.setFindOptions({ relations: parseFindOptionsRelations(relations) });
				}

				// Apply filter criteria
				this.getFilterTagQuery(query, input);

				// Fetch the filtered data and count
				const [items, total] = await query.getManyAndCount();

				// Return the paginated result
				return { items, total };
			}
		}
	}

	/**
	 * GET tenant/organization level tags
	 *
	 * @param input
	 * @param relations
	 * @returns
	 */
	async findTags(
		input: ITagFindInput,
		relations: string[] | FindOptionsRelations<Tag> = []
	): Promise<IPagination<ITag>> {
		// See findTagsByLevel: this method builds its own query and never reaches the CRUD sink, so the
		// sensitive-relation table has to be asserted here. `GET /api/tags` is the cheapest route to
		// the protected rows — the controller declares no permission at all.
		this.assertRelationsPermitted({ relations });

		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const tenantId = RequestContext.currentTenantId() || input.tenantId;
					const { organizationId, organizationTeamId, name, color, description } = input;

					const where: any = {
						tenantId,
						$or: [{ organizationId: null }, { organizationId }],
						isSystem: false
					};
					if (isNotEmpty(organizationTeamId)) where.organizationTeamId = organizationTeamId;
					if (isNotEmpty(name)) where.name = { $ilike: `%${name}%` };
					if (isNotEmpty(color)) where.color = { $ilike: `%${color}%` };
					if (isNotEmpty(description)) where.description = { $ilike: `%${description}%` };

					// Always load tagType: tagTypeName below is derived from it, whatever the caller asked for
					const requested = Array.isArray(relations) ? relations : Object.keys(relations);
					const populate = new Set([...requested, 'tagType']);
					const [items, total] = await this.mikroOrmRepository.findAndCount(where, {
						populate: [...populate] as any[]
					});

					const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
					const serialized = await Promise.all(items.map(async (item: any) => {
						const s = this.serialize(item);
						// Same field the TypeORM branch selects; the tags page shows it in its Type column
						s.tagTypeName = s.tagType?.type ?? null;
						if (s.icon) s.fullIconUrl = await store.getProviderInstance().url(s.icon);
						return s;
					}));
					return { items: serialized as ITag[], total };
				}
				case MultiORMEnum.TypeORM:
				default: {
					// Get the list of custom fields for the specified entity
					const customFields = getConfig().customFields?.['Tag'] ?? [];

					const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
					// Define special criteria to find specific relations
					query.setFindOptions({
						...(relations ? { relations: parseFindOptionsRelations(relations) } : {})
					});

					// Left join all relational tables with tag table
					query.leftJoin(`${query.alias}.tagType`, 'tagType');
					for (const [relation, alias] of TAG_USAGE_COUNTERS) {
						query.leftJoin(`${query.alias}.${relation}`, alias);
					}

					// Custom Entity Fields: Add left joins for each custom field if they exist
					if (customFields.length > 0) {
						customFields.forEach((field) => {
							if (field.relationType === 'many-to-many') {
								query.leftJoin(`${query.alias}.customFields.${field.name}`, field.name);
							}
						});
					}

					// Add new selection to the SELECT query
					query.select(`${query.alias}.*`);

					query.addSelect(p(`"tagType"."type"`), `tagTypeName`);
					// Add the select statement for counting, and cast it to integer. DISTINCT is required: the
					// relations are all LEFT JOINed at once, so each count would otherwise be multiplied by the
					// matches of every other relation (2 employees + 3 tasks counted 6 + 6).
					for (const [, alias, counter] of TAG_USAGE_COUNTERS) {
						query.addSelect(p(`CAST(COUNT(DISTINCT "${alias}"."id") AS INTEGER)`), counter);
					}

					// Custom Entity Fields: Add select statements for each custom field if they exist
					if (customFields.length > 0) {
						customFields.forEach((field) => {
							if (field.relationType === 'many-to-many') {
								const selectionAliasName = `${field.name}_counter`;
								query.addSelect(
									`CAST(COUNT(DISTINCT ${field.name}.id) AS INTEGER)`,
									selectionAliasName
								);
							}
						});
					}

					// Adds GROUP BY condition in the query builder.
					query.addGroupBy(`${query.alias}.id`);
					query.addGroupBy(`tagType.type`);
					// Additionally you can add parameters used in where expression.
					query.where((qb: SelectQueryBuilder<Tag>) => {
						this.getFilterTagQuery(qb, input);
					});
					let items = await query.getRawMany();

					const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
					items = await Promise.all(items.map(async (item) => {
						if (item.icon) item.fullIconUrl = await store.getProviderInstance().url(item.icon);
						return item;
					}));
					const total = items.length;

					return { items, total };
				}
			}
		} catch (error) {
			console.log('Error while getting tags', error);
			throw new BadRequestException(error);
		}
	}

	/**
	 * Builds a query to filter tags based on provided criteria.
	 *
	 * @param query - The query builder instance for the Tag entity.
	 * @param request - The input criteria for filtering tags.
	 * @returns The modified query builder instance.
	 */
	getFilterTagQuery(query: SelectQueryBuilder<Tag>, request: ITagFindInput): SelectQueryBuilder<Tag> {
		const tenantId = RequestContext.currentTenantId() || request.tenantId;
		const { organizationId, organizationTeamId, name, color, description } = request;

		// Mandatory tenant filter
		query.andWhere(`${query.alias}.tenantId = :tenantId`, { tenantId });

		// Optional organization filter
		query.andWhere(
			new Brackets((qb) => {
				qb.where(`${query.alias}.organizationId IS NULL`).orWhere(
					`${query.alias}.organizationId = :organizationId`,
					{ organizationId }
				);
			})
		);

		// Optional organization team filter
		if (isNotEmpty(organizationTeamId)) {
			query.andWhere(`${query.alias}.organizationTeamId = :organizationTeamId`, { organizationTeamId });
		}

		// System tag filter (non-system tags only)
		query.andWhere(`${query.alias}.isSystem = :isSystem`, { isSystem: false });

		// Dynamic filters for name, color, and description
		const dynamicFilters = { name, color, description };
		Object.entries(dynamicFilters).forEach(([key, value]) => {
			if (isNotEmpty(value)) {
				query.andWhere(`${query.alias}.${key} ${LIKE_OPERATOR} :${key}`, { [key]: `%${value}%` });
			}
		});

		return query;
	}
}
