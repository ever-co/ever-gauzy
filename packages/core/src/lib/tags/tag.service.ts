import { BadRequestException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Brackets, FindOptionsRelations, IsNull, SelectQueryBuilder } from 'typeorm';
import { isNotEmpty } from '@gauzy/utils';
import { ID, IOrganizationTeam, IPagination, ITag, ITagFindInput } from '@gauzy/contracts';
import { getConfig } from '@gauzy/config';
import { RequestContext } from '../core/context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { isWithinOrganizationBoundary, TenantAwareCrudService } from '../core/crud';
import { mikroOrmContains, MultiORMEnum, parseFindOptionsRelations } from '../core/utils';
import { LIKE_OPERATOR } from '../core/util';
import { Tag } from './tag.entity';
import { localFileUrl } from './../core/file-storage/file-storage';
import { prepareSQLQuery as p } from './../database/database.helper';
import { manyToManyCountSubquery } from './relation-count-subquery';
import { tagNameKeyOf, TEAM_STARTER_TAGS } from './tag-name';
import { MikroOrmTagRepository } from './repository/mikro-orm-tag.repository';
import { TypeOrmTagRepository } from './repository/type-orm-tag.repository';

/**
 * Relations a tag can be attached to, with the alias they had in the tags list query and the `*_counter` field
 * the tags page sums into the usage count: [relation property, alias, counter name].
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

/** Where a tag lives: the tenant, the organization (none for a tenant tag), the team (none for an organization tag). */
export interface TagScope {
	tenantId: ID;
	organizationId: ID | null;
	organizationTeamId: ID | null;
}

/** A tag's name and the fields of a body that place it: the ids, or the relation objects a body may send instead. */
export interface TagNameInput {
	name?: string | null;
	organizationId?: ID | null;
	organization?: { id?: ID | null } | null;
	organizationTeamId?: ID | null;
	organizationTeam?: { id?: ID | null } | null;
}

function organizationIdOf(input: TagNameInput): ID | null {
	return input.organizationId ?? input.organization?.id ?? null;
}

function organizationTeamIdOf(input: TagNameInput): ID | null {
	return input.organizationTeamId ?? input.organizationTeam?.id ?? null;
}

/**
 * The organization a change states, read as the update reads it (`TenantAwareCrudService.statedOrganizationId`): the
 * id whenever the body sends one, `null` included, else the object's.
 */
function statedOrganizationIdOf(changes: TagNameInput): ID | null | undefined {
	return changes.organizationId !== undefined ? changes.organizationId : changes.organization?.id;
}

/** Whether a change names the tag's organization (or team), by id or by object, be it only to clear it. */
function hasScopeField(changes: TagNameInput, field: 'organization' | 'organizationTeam'): boolean {
	return `${field}Id` in changes || field in changes;
}

@Injectable()
export class TagService extends TenantAwareCrudService<Tag> {
	private readonly logger = new Logger(TagService.name);

	constructor(typeOrmTagRepository: TypeOrmTagRepository, mikroOrmTagRepository: MikroOrmTagRepository) {
		super(typeOrmTagRepository, mikroOrmTagRepository);
	}

	/**
	 * The ids and names of the visible tags of one scope (system tags are never listed, so they never take a name from
	 * anyone). For a team in an organization, the team's tags stored with no organization count too: `create` does not
	 * stamp the organization, so a body naming only the team files its tag there, and the team lists it all the same.
	 */
	async namesInScope(scope: TagScope): Promise<Array<Pick<ITag, 'id' | 'name'>>> {
		const { tenantId, organizationId, organizationTeamId } = scope;
		const alsoWithoutOrganization = !!organizationTeamId && !!organizationId;
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const items = await this.mikroOrmRepository.find({
					tenantId,
					organizationTeamId,
					isSystem: false,
					...(alsoWithoutOrganization
						? { $or: [{ organizationId }, { organizationId: null }] }
						: { organizationId })
				} as any);
				return items.map(({ id, name }) => ({ id, name }));
			}
			case MultiORMEnum.TypeORM:
			default: {
				const where = {
					tenantId,
					organizationId: organizationId ?? IsNull(),
					organizationTeamId: organizationTeamId ?? IsNull(),
					isSystem: false
				};
				return await this.typeOrmRepository.find({
					select: { id: true, name: true },
					where: alsoWithoutOrganization ? [where, { ...where, organizationId: IsNull() }] : where
				});
			}
		}
	}

	/**
	 * The organization a team belongs to, read in the given tenant; `null` when the team is not there.
	 *
	 * @param tenantId The caller's tenant.
	 * @param organizationTeamId The team.
	 */
	private async organizationOfTeam(tenantId: ID, organizationTeamId: ID): Promise<ID | null> {
		const where = { id: organizationTeamId, tenantId };
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const team = await this.mikroOrmRepository.getEntityManager().findOne('OrganizationTeam', where as any);
				return (team as { organizationId?: ID } | null)?.organizationId ?? null;
			}
			case MultiORMEnum.TypeORM:
			default: {
				const team = await this.typeOrmRepository.manager.findOne('organization_team', {
					select: { organizationId: true },
					where
				} as any);
				return (team as { organizationId?: ID } | null)?.organizationId ?? null;
			}
		}
	}

	/**
	 * Refuses a name another tag of the same team already has (409, `UNIQUE_CONSTRAINT_VIOLATION` on `name`). Ever
	 * Teams tells a team's labels apart by name, in its task filters and pickers, so two labels of one name would
	 * collide there (ever-co/ever-teams#5016). Names compare as {@link tagNameKeyOf} reads them. The scope is read from
	 * the ids or from the relation objects a body may send instead (`organization: { id }`).
	 *
	 * Only a team's own tags are checked. A tag of no team (an organization's or the tenant's) is filed as before, a
	 * name its organization has already included: such tags are typed per entity (invoices, tasks, equipment…), and
	 * one name may serve several types.
	 *
	 * An organization outside the caller's organization boundary is not read: the write refuses it anyway, and a 409
	 * there would tell the caller whether that organization has a tag of the name.
	 *
	 * The check is the service's, not the database's: two requests racing on one name can still both pass it. A unique
	 * index on the normalized name would close that, after a migration resolving the duplicates filed before.
	 *
	 * @param input The tag's name and scope; the tenant is the caller's.
	 * @param exceptId The tag being renamed, which keeps its own name.
	 */
	async assertNameIsFree(input: TagNameInput, exceptId?: ID): Promise<void> {
		const key = tagNameKeyOf(input.name);
		if (!key) {
			return;
		}
		const organizationTeamId = organizationTeamIdOf(input);
		if (!organizationTeamId) {
			// A tag of no team: names stay free, as they were before names were checked
			return;
		}
		const tenantId = RequestContext.currentTenantId();
		// A team tag sent with no organization is listed with the team's other labels, those of its organization
		// included: check it there. The team is read in the caller's tenant only.
		const statedOrganizationId = organizationIdOf(input);
		let organizationId = statedOrganizationId ?? (await this.organizationOfTeam(tenantId, organizationTeamId));
		if (!isWithinOrganizationBoundary(organizationId, this.organizationBoundary())) {
			if (statedOrganizationId) {
				// An organization the caller named and cannot reach: the write refuses it anyway
				return;
			}
			// The team's organization is out of the caller's reach: its tags there are not read, the team's tags of no
			// organization (shared across the tenant, and writable) still are
			organizationId = null;
		}
		const names = await this.namesInScope({ tenantId, organizationId, organizationTeamId });
		const isTaken = names.some((tag) => tag.id !== exceptId && tagNameKeyOf(tag.name) === key);
		if (isTaken) {
			throw new ApiException(
				HttpStatus.CONFLICT,
				ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION,
				`A tag named "${input.name?.trim()}" already exists here.`,
				{ field: 'name' }
			);
		}
	}

	/**
	 * Whether a change moves the tag to the organization it names, be it only to clear it. For a caller confined to
	 * their organization, the update leaves out any other (`TenantAwareCrudService.withoutScopeChanges`): such a change
	 * keeps the tag where it is, and is checked there.
	 *
	 * @param changes What the request changes.
	 */
	private movesOrganization(changes: TagNameInput): boolean {
		if (!hasScopeField(changes, 'organization')) {
			return false;
		}
		const boundary = this.organizationBoundary();
		return (
			!boundary ||
			(isNotEmpty(boundary.organizationId) &&
				String(statedOrganizationIdOf(changes)) === String(boundary.organizationId))
		);
	}

	/**
	 * The check of a change to a tag: only a new name or a new scope is checked. A tag that shares its name with an
	 * older one (filed before names were checked) can still have its colour, icon or description changed.
	 *
	 * @param existing The tag as stored.
	 * @param changes What the request changes.
	 * @param id The tag.
	 */
	async assertChangeIsFree(existing: ITag, changes: TagNameInput, id: ID): Promise<void> {
		const next: TagNameInput = {
			name: changes.name ?? existing.name,
			organizationId: this.movesOrganization(changes)
				? organizationIdOf(changes)
				: (existing.organizationId ?? null),
			organizationTeamId: hasScopeField(changes, 'organizationTeam')
				? organizationTeamIdOf(changes)
				: (existing.organizationTeamId ?? null)
		};
		const isSameName = tagNameKeyOf(next.name) === tagNameKeyOf(existing.name);
		const isSameOrganization = next.organizationId === (existing.organizationId ?? null);
		const isSameTeam = next.organizationTeamId === (existing.organizationTeamId ?? null);
		if (isSameName && isSameOrganization && isSameTeam) {
			return;
		}
		await this.assertNameIsFree(next, id);
	}

	/**
	 * Refuses to recover a tag whose name its scope gave to another tag after it was deleted (409, as for a create).
	 * A system tag is recovered as it is.
	 *
	 * @param id The soft-deleted tag.
	 */
	async assertRecoveryIsFree(id: ID): Promise<void> {
		const tag = await this.findOneByIdString(id, { withDeleted: true });
		if (tag.isSystem) {
			return;
		}
		await this.assertNameIsFree(tag, id);
	}

	/**
	 * Gives a new team the starter labels ({@link TEAM_STARTER_TAGS}) as its own tags. A name the team has already is
	 * left as it is, so running it again adds nothing; a failure is logged and the team keeps working without them.
	 *
	 * @param team The team just created.
	 * @returns The tags created.
	 */
	async createTeamStarterTags(team: Pick<IOrganizationTeam, 'id' | 'organizationId'>): Promise<ITag[]> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const scope: TagScope = { tenantId, organizationId: team.organizationId, organizationTeamId: team.id };
			const taken = new Set((await this.namesInScope(scope)).map((tag) => tagNameKeyOf(tag.name)));
			const missing = TEAM_STARTER_TAGS.filter((tag) => !taken.has(tagNameKeyOf(tag.name)));
			if (missing.length === 0) {
				return [];
			}
			return await this.createMany(
				missing.map(({ name, color }) => ({
					name,
					color,
					isSystem: false,
					organizationId: team.organizationId,
					organizationTeamId: team.id
				}))
			);
		} catch (error) {
			this.logger.error('Error while creating the starter tags of a team', error);
			return [];
		}
	}

	/**
	 * Case-insensitive "contains" filters on name / color / description for the MikroORM tag queries
	 * (`$ilike` is PostgreSQL-only, see `mikroOrmContains`).
	 */
	private mikroOrmTextFilters(fields: Record<string, string | undefined>): Record<string, unknown> {
		const filters: Record<string, unknown> = {};
		for (const [field, value] of Object.entries(fields)) {
			if (isNotEmpty(value)) filters[field] = mikroOrmContains(value);
		}
		return filters;
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
				Object.assign(where, this.mikroOrmTextFilters({ name, color, description }));

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
					Object.assign(where, this.mikroOrmTextFilters({ name, color, description }));

					// Always load tagType: tagTypeName below is derived from it, whatever the caller asked for
					const requested = Array.isArray(relations) ? relations : Object.keys(relations);
					const populate = new Set([...requested, 'tagType']);
					const [items, total] = await this.mikroOrmRepository.findAndCount(where, {
						populate: [...populate] as any[]
					});

					const serialized = await Promise.all(
						items.map(async (item: any) => {
							// `tagTypeName` is not a Tag column: the TypeORM branch adds it as a raw select alias
							const s: Tag & { tagTypeName?: string | null } = this.serialize(item);
							// Same field the TypeORM branch selects; the tags page shows it in its Type column
							s.tagTypeName = s.tagType?.type ?? null;
							if (s.icon) s.fullIconUrl = await localFileUrl(s.icon);
							return s;
						})
					);
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
					// The requested relations are joined but not selected (`select` below replaces their columns):
					// a to-many one repeats the tag row once per match, which the GROUP BY below folds back.
					const joinsRequestedRelations = query.expressionMap.joinAttributes.length > 0;

					query.leftJoin(`${query.alias}.tagType`, 'tagType');

					// Add new selection to the SELECT query
					query.select(`${query.alias}.*`);
					query.addSelect(p(`"tagType"."type"`), `tagTypeName`);

					// Usage counters: one correlated subquery per relation, cast to integer. They used to be
					// `COUNT(DISTINCT ...)` over LEFT JOINs of every relation at once, which made the database build
					// the cross product of all of a tag's relation rows before grouping (seconds for a few hundred
					// tags); each subquery counts the same live rows of one relation (see manyToManyCountSubquery).
					const { metadata } = this.typeOrmRepository;
					const { driver } = this.typeOrmRepository.manager.dataSource;
					const counterOf = (relationPath: string) =>
						`CAST(${manyToManyCountSubquery(metadata, relationPath, query.alias, driver)} AS INTEGER)`;

					for (const [relation, , counter] of TAG_USAGE_COUNTERS) {
						query.addSelect(counterOf(relation), counter);
					}

					// Custom Entity Fields: Add a counter for each many-to-many custom field
					for (const field of customFields) {
						if (field.relationType === 'many-to-many') {
							query.addSelect(counterOf(`customFields.${field.name}`), `${field.name}_counter`);
						}
					}

					// One row per tag: only the requested relations can repeat it (tagType is many-to-one)
					if (joinsRequestedRelations) {
						query.addGroupBy(`${query.alias}.id`);
						query.addGroupBy(`tagType.type`);
					}
					// Additionally you can add parameters used in where expression.
					query.where((qb: SelectQueryBuilder<Tag>) => {
						this.getFilterTagQuery(qb, input);
					});
					// The tags came back ordered by id when every counter was a GROUP BY aggregate (PostgreSQL grouped
					// by sorting); without the GROUP BY that order is no longer implied, so it is stated.
					query.orderBy(`${query.alias}.id`, 'ASC');
					let items = await query.getRawMany();

					items = await Promise.all(
						items.map(async (item) => {
							if (item.icon) item.fullIconUrl = await localFileUrl(item.icon);
							return item;
						})
					);
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
