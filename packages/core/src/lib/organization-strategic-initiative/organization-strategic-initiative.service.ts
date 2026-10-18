import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere, In, UpdateResult } from 'typeorm';
import {
	ActionTypeEnum,
	ActorTypeEnum,
	BaseEntityEnum,
	ID,
	IOrganizationStrategicInitiative,
	IOrganizationStrategicInitiativeCreateInput,
	IOrganizationStrategicInitiativeFindInput,
	IOrganizationStrategicInitiativeRead,
	IOrganizationStrategicInitiativeUpdateInput,
	IPagination,
	OrganizationStrategicVisibilityScopeEnum,
	PermissionsEnum,
	RolesEnum
} from '@gauzy/contracts';
import { BaseQueryDTO, TenantAwareCrudService } from '../core/crud';
import { RequestContext } from '../core/context';
import { EmployeeService } from '../employee/employee.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { RoleService } from '../role/role.service';
import { TypeOrmOrganizationTeamEmployeeRepository } from '../organization-team-employee/repository/type-orm-organization-team-employee.repository';
import { TypeOrmOrganizationProjectRepository } from '../organization-project/repository/type-orm-organization-project.repository';
import { OrganizationTeam, UserOrganization } from '../core/entities/internal';
import { OrganizationStrategicInitiative } from './organization-strategic-initiative.entity';
import { TypeOrmOrganizationStrategicInitiativeRepository } from './repository/type-orm-organization-strategic-initiative.repository';
import { MikroOrmOrganizationStrategicInitiativeRepository } from './repository/mikro-orm-organization-strategic-initiative.repository';

/**
 * The relations to load: the ones a caller asked for, in whichever form it used (a list of paths, or the
 * object form `BaseQueryDTO` also accepts), plus the ones a read needs. The object form stays an object, so a
 * request such as `{ steward: true }` keeps its relations.
 *
 * @param requested - The caller's relations, if any.
 * @param required - Dotted paths the read needs.
 * @returns A list when the caller sent a list (or nothing), an object when it sent an object.
 */
export function withRelations(requested: unknown, required: string[]): string[] | Record<string, unknown> {
	if (requested && typeof requested === 'object' && !Array.isArray(requested)) {
		const merged: Record<string, unknown> = { ...(requested as Record<string, unknown>) };
		for (const path of required) {
			let level = merged;
			const segments = path.split('.');
			segments.forEach((segment, index) => {
				const last = index === segments.length - 1;
				const current = level[segment];
				if (last) {
					if (!current) level[segment] = true;
					return;
				}
				const next = current && typeof current === 'object' ? { ...(current as Record<string, unknown>) } : {};
				level[segment] = next;
				level = next;
			});
		}
		return merged;
	}
	const list = Array.isArray(requested) ? (requested as string[]) : [];
	return [...new Set([...list, ...required])];
}

/** The columns the visibility rule reads from an initiative, whatever the caller selected. */
export const VISIBILITY_COLUMNS = ['id', 'organizationId', 'visibilityScope', 'stewardId'];

/**
 * The columns to read: the ones a caller selected, in whichever form it used (a list of names, or the object
 * form), plus the ones a read needs. No selection reads every column, and stays so.
 *
 * @param requested - The caller's selection, if any.
 * @param required - The columns the read needs.
 * @returns The selection, with the required columns.
 */
export function withSelected(requested: unknown, required: string[]): unknown {
	if (Array.isArray(requested)) {
		return requested.length ? [...new Set([...(requested as string[]), ...required])] : requested;
	}
	if (requested && typeof requested === 'object') {
		const merged: Record<string, unknown> = { ...(requested as Record<string, unknown>) };
		if (!Object.keys(merged).length) {
			return requested;
		}
		for (const column of required) {
			if (!merged[column]) merged[column] = true;
		}
		return merged;
	}
	return requested;
}

/**
 * A read's `where` bound to the caller's organizations: an `organizationId` the caller did not state becomes one of
 * theirs (`In`, so a page is cut from their initiatives only); a stated one of theirs is kept, another one reads
 * nothing; an operator the caller stated is kept (each row is still checked after the read). Each condition of a
 * list (`OR`) is bound alike.
 *
 * @param where - The caller's `where`, if any.
 * @param memberOf - The caller's organizations.
 * @returns The bound `where`, or `null` when nothing can match.
 */
export function whereInOrganizations(where: unknown, memberOf: ReadonlySet<ID>): unknown | null {
	const organizationIds = [...memberOf];
	if (!organizationIds.length) {
		return null;
	}
	const bind = (condition: unknown): Record<string, unknown> | null => {
		const values = condition && typeof condition === 'object' ? { ...(condition as Record<string, unknown>) } : {};
		const stated = values['organizationId'];
		if (stated === undefined || stated === null || stated === '') {
			return { ...values, organizationId: In(organizationIds) };
		}
		if (typeof stated === 'string') {
			return memberOf.has(stated as ID) ? values : null;
		}
		return values;
	};
	if (Array.isArray(where)) {
		const conditions = where.map(bind).filter((condition) => condition !== null);
		return conditions.length ? conditions : null;
	}
	return bind(where);
}

/**
 * A write input without a raw `teams` list: the directly linked teams are set through `teamIds` only, which
 * {@link OrganizationStrategicInitiativeService} checks against the initiative's organization.
 */
function withoutRawTeams<T extends object>(input: T): Omit<T, 'teams'> {
	const values = { ...(input ?? {}) } as T & { teams?: unknown };
	delete values.teams;
	return values;
}

@Injectable()
export class OrganizationStrategicInitiativeService extends TenantAwareCrudService<OrganizationStrategicInitiative> {
	constructor(
		readonly typeOrmOrganizationStrategicInitiativeRepository: TypeOrmOrganizationStrategicInitiativeRepository,
		readonly mikroOrmOrganizationStrategicInitiativeRepository: MikroOrmOrganizationStrategicInitiativeRepository,
		private readonly _employeeService: EmployeeService,
		private readonly _activityLogService: ActivityLogService,
		private readonly _roleService: RoleService,
		private readonly _typeOrmOrganizationTeamEmployeeRepository: TypeOrmOrganizationTeamEmployeeRepository,
		private readonly _typeOrmOrganizationProjectRepository: TypeOrmOrganizationProjectRepository
	) {
		super(typeOrmOrganizationStrategicInitiativeRepository, mikroOrmOrganizationStrategicInitiativeRepository);
	}

	/**
	 * Creates a new organization strategic initiative.
	 *
	 * @param input - The input data for creating an organization strategic initiative.
	 * @returns A promise that resolves to the created organization strategic initiative.
	 * @throws {NotFoundException} If the steward employee is not found.
	 * @throws {BadRequestException} If an error occurs during the creation.
	 */
	async create(input: IOrganizationStrategicInitiativeCreateInput): Promise<IOrganizationStrategicInitiative> {
		try {
			// Retrieve context-specific IDs
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
			const organizationId = input.organizationId;
			const currentEmployeeId = RequestContext.currentEmployeeId();

			// Validate steward if provided
			if (input.stewardId) {
				const steward = await this._employeeService.findOneByIdString(input.stewardId);
				if (!steward) {
					throw new NotFoundException(`Steward with id ${input.stewardId} not found`);
				}
			}

			// The directly linked teams, each one a team of the initiative's organization. They are set through
			// `teamIds` only: a raw `teams` list in the body (which the DTO does not declare, but a non-whitelisting
			// pipe keeps) would skip the organization check, so it is dropped.
			const { teamIds, ...values } = withoutRawTeams(input);
			const teams = await this.resolveTeams(teamIds, organizationId, tenantId);

			// Create the organization strategic initiative
			const organizationStrategicInitiative = await super.create({
				...values,
				...(teams ? { teams } : {}),
				tenantId,
				organizationId,
				// Set current employee as creator if employeeId not provided
				stewardId: input.stewardId ?? currentEmployeeId
			});
			// The answer lists the teams whether the write stated them or not: none for a create without them.
			if (!Array.isArray(organizationStrategicInitiative.teams)) organizationStrategicInitiative.teams = teams ?? [];
			this.withTeamIds(organizationStrategicInitiative);

			// Log activity for initiative creation
			this._activityLogService.logActivity<OrganizationStrategicInitiative>(
				BaseEntityEnum.OrganizationStrategicInitiative,
				ActionTypeEnum.Created,
				ActorTypeEnum.User,
				organizationStrategicInitiative.id,
				organizationStrategicInitiative.title,
				organizationStrategicInitiative,
				organizationId,
				tenantId
			);

			return organizationStrategicInitiative;
		} catch (error) {
			if (
				error instanceof ForbiddenException ||
				error instanceof NotFoundException ||
				error instanceof BadRequestException
			) {
				throw error;
			}
			throw new BadRequestException('Organization strategic initiative creation failed', error);
		}
	}

	/**
	 * Updates an existing organization strategic initiative.
	 *
	 * @param id - The unique identifier of the organization strategic initiative to update.
	 * @param input - The update data for the organization strategic initiative.
	 * @returns A promise that resolves to the updated organization strategic initiative.
	 * @throws {NotFoundException} If the organization strategic initiative is not found.
	 * @throws {BadRequestException} If the organization strategic initiative update fails.
	 */
	async update(
		id: ID,
		input: IOrganizationStrategicInitiativeUpdateInput
	): Promise<IOrganizationStrategicInitiative | UpdateResult> {
		try {
			const tenantId = RequestContext.currentTenantId();

			// Find the organization strategic initiative
			const originalOrganizationStrategicInitiative = await this.findOneByWhereOptions({
				id,
				tenantId
			});

			if (!originalOrganizationStrategicInitiative) {
				throw new NotFoundException(`Organization strategic initiative with id ${id} not found`);
			}

			// Validate new steward if being changed
			if (input.stewardId && input.stewardId !== originalOrganizationStrategicInitiative.stewardId) {
				const steward = await this._employeeService.findOneByIdString(input.stewardId);
				if (!steward) {
					throw new NotFoundException(`Steward with id ${input.stewardId} not found`);
				}
			}

			// The directly linked teams are replaced when `teamIds` is stated, and left as they are otherwise. They
			// are checked against the organization the initiative is SAVED in: when the update moves it to another
			// organization without stating `teamIds`, the links to the old organization's teams are removed, so no
			// member of those teams keeps `team` visibility of it there. A raw `teams` list is dropped (see create).
			const { teamIds, ...values } = withoutRawTeams(input);
			const organizationId = values.organizationId ?? originalOrganizationStrategicInitiative.organizationId;
			const movesOrganization = organizationId !== originalOrganizationStrategicInitiative.organizationId;
			const teams = await this.resolveTeams(
				teamIds ?? (movesOrganization ? [] : undefined),
				organizationId,
				originalOrganizationStrategicInitiative.tenantId
			);

			// Update the organization strategic initiative
			const updatedOrganizationStrategicInitiative = await super.create({
				...values,
				...(teams ? { teams } : {}),
				id
			});
			// The answer lists the teams whether the write stated them or not: the stored ones when it did not (REST,
			// GraphQL and the signals update alike), so a client refreshing from it never reads "no teams".
			if (!Array.isArray(updatedOrganizationStrategicInitiative.teams)) {
				updatedOrganizationStrategicInitiative.teams = teams ?? (await this.linkedTeams(id));
			}
			this.withTeamIds(updatedOrganizationStrategicInitiative);

			// Log activity for organization strategic initiative update
			this._activityLogService.logActivity<OrganizationStrategicInitiative>(
				BaseEntityEnum.OrganizationStrategicInitiative,
				ActionTypeEnum.Updated,
				ActorTypeEnum.User,
				id,
				updatedOrganizationStrategicInitiative.title,
				updatedOrganizationStrategicInitiative,
				updatedOrganizationStrategicInitiative.organizationId,
				tenantId,
				originalOrganizationStrategicInitiative,
				updatedOrganizationStrategicInitiative as Partial<OrganizationStrategicInitiative>
			);

			return updatedOrganizationStrategicInitiative;
		} catch (error) {
			if (
				error instanceof ForbiddenException ||
				error instanceof NotFoundException ||
				error instanceof BadRequestException
			) {
				throw error;
			}
			console.error(`Error while updating strategic initiative: ${error.message}`, error);
			throw new BadRequestException('Strategic initiative update failed', error);
		}
	}

	/**
	 * Finds all strategic initiatives with visibility filtering.
	 *
	 * @param filters - Filter criteria for initiatives.
	 * @returns A promise that resolves to a paginated list of initiatives.
	 */
	async findAll(
		filters: BaseQueryDTO<OrganizationStrategicInitiative> & IOrganizationStrategicInitiativeFindInput
	): Promise<IPagination<IOrganizationStrategicInitiative>> {
		return this.readVisible(filters, (options) => super.findAll(options));
	}

	/**
	 * The CRUD controller's inherited `GET /pagination`: the same read as the list (the caller's organizations, then
	 * the visibility rule), then one page of what the caller may see, and the number of all of it. The rule has no
	 * query form (the steward, the caller's teams through the linked teams and the projects' teams), so the page is cut
	 * after it: a page cut in the query would come back short, and its total would hide the later pages. As in the
	 * CRUD base, `skip` is the page number and a page holds `take` initiatives (10 unless stated).
	 *
	 * @param filters - Filter criteria and the page.
	 * @returns The page of initiatives the caller may see, and how many they may see in all.
	 */
	async paginate(
		filters?: BaseQueryDTO<OrganizationStrategicInitiative> & IOrganizationStrategicInitiativeFindInput
	): Promise<IPagination<IOrganizationStrategicInitiative>> {
		const { take, skip, ...rest } = (filters ?? {}) as BaseQueryDTO<OrganizationStrategicInitiative> & { take?: number; skip?: number };
		// With no order of the caller's, by primary key, as the CRUD base orders a page: pages never overlap.
		const ordered = (rest as { order?: unknown }).order ? rest : { ...rest, order: { id: 'ASC' } };
		const { items } = await this.readVisible(ordered as typeof filters, (options) => super.findAll(options));
		const size = Number(take) > 0 ? Number(take) : 10;
		const offset = Number(skip) > 0 ? size * (Number(skip) - 1) : 0;
		return { items: items.slice(offset, offset + size), total: items.length };
	}

	/**
	 * How many initiatives the caller may see (the CRUD controller's inherited `GET /count`, the GraphQL count):
	 * counted on the list's read, so a count never answers for another organization, nor for an initiative the
	 * visibility rule hides (the rule has no query form; the read is bound to the caller's organizations and costs
	 * what the list route costs).
	 *
	 * @param where - Filter criteria.
	 * @returns The number of initiatives the caller may see.
	 */
	async countBy(where?: FindOptionsWhere<OrganizationStrategicInitiative>): Promise<number> {
		const { total } = await this.findAll({ ...(where ? { where } : {}) } as BaseQueryDTO<OrganizationStrategicInitiative>);
		return total;
	}

	/**
	 * A list read narrowed to what the caller may see: bound to the caller's organizations in the query itself (before
	 * a page is cut), then each row through the organization check and the visibility rule.
	 *
	 * @param filters - Filter criteria for initiatives.
	 * @param read - The base read (the whole list, or a page).
	 * @returns The initiatives the caller may see.
	 */
	private async readVisible(
		filters: (BaseQueryDTO<OrganizationStrategicInitiative> & IOrganizationStrategicInitiativeFindInput) | undefined,
		read: (options: BaseQueryDTO<OrganizationStrategicInitiative>) => Promise<IPagination<OrganizationStrategicInitiative>>
	): Promise<IPagination<IOrganizationStrategicInitiative>> {
		const { employeeId: currentEmployeeId, memberOf, seesAllIn } = await this.viewer();

		// Nothing to read outside the caller's organizations
		const where = whereInOrganizations(filters?.where, memberOf);
		if (!where) {
			return { items: [], total: 0 };
		}

		// Ensure relations for visibility check are loaded (the directly linked teams, projects and their teams),
		// next to the ones the caller asked for, in whichever form it asked (a list or an object)
		const { items } = await read({
			...filters,
			where,
			relations: withRelations(filters?.relations, ['teams', 'projects', 'projects.teams']),
			// The rule's own columns are read even when the caller selected others (the admin override needs the
			// organization)
			...(filters?.select ? { select: withSelected(filters.select, VISIBILITY_COLUMNS) } : {})
		} as BaseQueryDTO<OrganizationStrategicInitiative>);

		// Pre-fetch employee team memberships to avoid N+1 queries
		const employeeTeamIds = await this.getEmployeeTeamIds(currentEmployeeId);

		// Check leadership access once (instead of per-initiative)
		const hasLeadership = await this.hasLeadershipAccess();

		// Filter organization strategic initiatives: the caller's organizations only, then the visibility scope (no
		// extra queries)
		const filteredOrganizationStrategicInitiatives = items.filter(
			(initiative) =>
				this.isInMemberOrganization(initiative, memberOf) &&
				this.canViewOrganizationStrategicInitiativeSync(initiative, currentEmployeeId, employeeTeamIds, hasLeadership, seesAllIn)
		);

		return {
			items: filteredOrganizationStrategicInitiatives.map((initiative) => this.withTeamIds(initiative)),
			total: filteredOrganizationStrategicInitiatives.length
		};
	}

	/**
	 * Finds a single organization strategic initiative by ID with visibility checks.
	 *
	 * @param id - The unique identifier of the organization strategic initiative.
	 * @param params - Optional query parameters.
	 * @returns A promise that resolves to the organization strategic initiative if found and visible.
	 * @throws {NotFoundException} If the organization strategic initiative is not found or not visible.
	 */
	async findOneById(
		id: ID,
		params?: BaseQueryDTO<OrganizationStrategicInitiative>
	): Promise<IOrganizationStrategicInitiative> {
		const { employeeId: currentEmployeeId, memberOf, seesAllIn } = await this.viewer();

		// Find the organization strategic initiative with the requested relations (a list or an object), and its
		// directly linked teams
		const organizationStrategicInitiative = await this.findOneByOptions({
			...params,
			relations: withRelations(params?.relations, [
				'teams'
			]) as BaseQueryDTO<OrganizationStrategicInitiative>['relations'],
			...(params?.select
				? { select: withSelected(params.select, VISIBILITY_COLUMNS) as BaseQueryDTO<OrganizationStrategicInitiative>['select'] }
				: {}),
			where: {
				...(params?.where && { ...params.where }),
				id
			}
		});

		if (!organizationStrategicInitiative) {
			throw new NotFoundException(`Organization strategic initiative with id ${id} not found`);
		}

		// Check visibility: an initiative of an organization the caller is not a member of is answered as one that
		// is not there, before the scope rule is read
		const canView =
			this.isInMemberOrganization(organizationStrategicInitiative, memberOf) &&
			(await this.canViewOrganizationStrategicInitiative(organizationStrategicInitiative, currentEmployeeId, seesAllIn));
		if (!canView) {
			throw new NotFoundException(
				`Organization strategic initiative with id ${id} not found or you don't have permission to view it`
			);
		}

		return this.withTeamIds(organizationStrategicInitiative);
	}

	/**
	 * Finds all strategic initiatives linked to a specific project.
	 *
	 * @param projectId - The project ID.
	 * @returns A promise that resolves to a list of initiatives.
	 */
	async findByProject(projectId: ID): Promise<IOrganizationStrategicInitiative[]> {
		const tenantId = RequestContext.currentTenantId();
		const { employeeId: currentEmployeeId, memberOf, seesAllIn } = await this.viewer();

		// Get the project with its strategic initiatives and their projects/teams for visibility check
		const project = await this._typeOrmOrganizationProjectRepository.findOne({
			where: { id: projectId, tenantId },
			relations: {
				organizationStrategicInitiatives: {
					teams: true,
					projects: {
						teams: true
					}
				}
			}
		});

		// A project of an organization the caller is not a member of is answered as one that is not there
		if (!project || !memberOf.has(project.organizationId as ID)) {
			throw new NotFoundException(`Project with id ${projectId} not found`);
		}

		const organizationStrategicInitiatives = project.organizationStrategicInitiatives ?? [];

		// Pre-fetch employee team memberships to avoid N+1 queries
		const employeeTeamIds = await this.getEmployeeTeamIds(currentEmployeeId);

		// Check leadership access once (instead of per-initiative)
		const hasLeadership = await this.hasLeadershipAccess();

		// Filter: the caller's organizations only, then the visibility scope (no extra queries)
		return organizationStrategicInitiatives
			.filter(
				(initiative) =>
					this.isInMemberOrganization(initiative, memberOf) &&
					this.canViewOrganizationStrategicInitiativeSync(
						initiative,
						currentEmployeeId,
						employeeTeamIds,
						hasLeadership,
						seesAllIn
					)
			)
			.map((initiative) => this.withTeamIds(initiative));
	}

	/**
	 * Updates the organization strategic signals of an initiative.
	 *
	 * @param id - The organization strategic initiative ID.
	 * @param signals - The new signals data.
	 * @returns The updated organization strategic initiative.
	 */
	async updateSignals(
		id: ID,
		signals: IOrganizationStrategicInitiative['signals']
	): Promise<IOrganizationStrategicInitiative> {
		const tenantId = RequestContext.currentTenantId();
		const currentEmployeeId = RequestContext.currentEmployeeId();

		// Find the organization strategic initiative
		const organizationStrategicInitiative = await this.findOneByWhereOptions({ id, tenantId });
		if (!organizationStrategicInitiative) {
			throw new NotFoundException(`Organization strategic initiative with id ${id} not found`);
		}

		// Parse existing signals if string (with safe fallback for malformed data)
		const existingSignals =
			typeof organizationStrategicInitiative.signals === 'string'
				? this.safeJsonParse(organizationStrategicInitiative.signals, {})
				: organizationStrategicInitiative.signals ?? {};

		// Parse new signals if string (with safe fallback for malformed input)
		const parsedNewSignals =
			typeof signals === 'string' ? this.safeJsonParse(signals, {}) : signals ?? {};

		// Merge with new signals
		const updatedSignals = {
			...existingSignals,
			...parsedNewSignals,
			lastAssessedAt: new Date(),
			lastAssessedById: currentEmployeeId
		};

		// Update
		return (await this.update(id, { signals: updatedSignals })) as IOrganizationStrategicInitiative;
	}

	// ============================================================
	// PRIVATE METHODS - Visibility & Permission Logic
	// ============================================================

	/**
	 * Who reads, for the visibility rule.
	 *
	 * - `memberOf`: the organizations of the tenant the caller is a current member of (see
	 *   `memberOrganizationIds`). Every read answers only initiatives of these organizations, whatever their scope:
	 *   the CRUD base adds the tenant, not the organization, and the routes and GraphQL fields check permissions,
	 *   not membership of the record's organization (#11050 review, CWE-863).
	 * - `employeeId`: the caller's own employee. `RequestContext.currentEmployeeId()` is empty for a user who may
	 *   act for every employee (`CHANGE_SELECTED_EMPLOYEE`, an admin), which hid a team-scoped initiative from its
	 *   own steward when the steward was an admin not on the team, and never counted an admin's team membership.
	 * - `seesAllIn`: the organizations in which every initiative is visible to the caller. An organization admin
	 *   who may edit initiatives (may act for every employee and holds `ORG_STRATEGIC_INITIATIVE_UPDATE`, as the
	 *   default super admin and admin roles do) sees every initiative of the organizations they are a member of
	 *   (a `user_organization` row, as `assertCurrentUserBelongsToOrganization` checks): they already edit them,
	 *   and could not read what they edit. Never another organization of the tenant; empty for everybody else.
	 *
	 * @returns The caller's employee (or `null`), their organizations and those whose every initiative they see.
	 */
	private async viewer(): Promise<{ employeeId: ID | null; memberOf: ReadonlySet<ID>; seesAllIn: ReadonlySet<ID> }> {
		let ownEmployeeId: ID | null = null;
		try {
			ownEmployeeId = (RequestContext.currentUser()?.employeeId as ID) ?? null;
		} catch {
			ownEmployeeId = null;
		}
		const employeeId = (RequestContext.currentEmployeeId() as ID) ?? ownEmployeeId;
		const initiativeAdmin =
			RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE) &&
			RequestContext.hasPermission(PermissionsEnum.ORG_STRATEGIC_INITIATIVE_UPDATE);
		const memberOf = await this.memberOrganizationIds();
		return {
			employeeId: employeeId || null,
			memberOf,
			seesAllIn: initiativeAdmin ? memberOf : new Set<ID>()
		};
	}

	/**
	 * The organizations of the caller's tenant they are a current member of: a `user_organization` row of the
	 * tenant and user (as `assertCurrentUserBelongsToOrganization` checks) that is not deactivated
	 * (`isActive = false`) or archived (`isArchived = true`); a row that states neither, as the column defaults
	 * leave it, counts. None without a tenant or user in the request (fails closed).
	 *
	 * @returns Their organization ids.
	 */
	private async memberOrganizationIds(): Promise<Set<ID>> {
		const tenantId = RequestContext.currentTenantId();
		const userId = RequestContext.currentUserId();
		if (!tenantId || !userId) {
			return new Set();
		}
		try {
			const memberships = await this.typeOrmRepository.manager.find(UserOrganization, {
				where: { tenantId, userId },
				select: { organizationId: true, isActive: true, isArchived: true }
			});
			return new Set(
				memberships
					.filter((membership) => membership.isActive !== false && membership.isArchived !== true)
					.map((membership) => membership.organizationId as ID)
					.filter(Boolean)
			);
		} catch (error) {
			console.error('Error fetching organization memberships:', error.message);
			return new Set();
		}
	}

	/**
	 * Whether an initiative belongs to one of the caller's organizations (see `viewer`). One read without its
	 * organization is not (fails closed).
	 *
	 * @param organizationStrategicInitiative - The initiative (its `organizationId` read).
	 * @param memberOf - The caller's organizations.
	 * @returns True when the initiative is in one of them.
	 */
	private isInMemberOrganization(
		organizationStrategicInitiative: IOrganizationStrategicInitiative,
		memberOf: ReadonlySet<ID>
	): boolean {
		const organizationId = organizationStrategicInitiative?.organizationId as ID;
		return !!organizationId && memberOf.has(organizationId);
	}

	/**
	 * Whether every initiative of this one's organization is visible to the caller (see `viewer`).
	 *
	 * @param organizationStrategicInitiative - The initiative (its `organizationId` read).
	 * @param seesAllIn - The organizations whose every initiative the caller sees.
	 * @returns True when the initiative is in one of them.
	 */
	private seesEveryInitiativeOf(
		organizationStrategicInitiative: IOrganizationStrategicInitiative,
		seesAllIn: ReadonlySet<ID>
	): boolean {
		const organizationId = organizationStrategicInitiative?.organizationId as ID;
		return !!organizationId && seesAllIn.has(organizationId);
	}

	/**
	 * Safely parses a JSON string with a fallback value.
	 * Prevents 500 errors from malformed or manually edited database values.
	 *
	 * @param jsonString - The JSON string to parse.
	 * @param fallback - The fallback value if parsing fails.
	 * @returns The parsed object or the fallback value.
	 */
	private safeJsonParse<T>(jsonString: string, fallback: T): T {
		try {
			return JSON.parse(jsonString);
		} catch (error) {
			console.error('Failed to parse JSON string, using fallback:', error.message);
			return fallback;
		}
	}

	/**
	 * Gets all team IDs that an employee is a member of.
	 * This is used to batch-check team membership instead of N+1 queries.
	 *
	 * @param employeeId - The employee ID.
	 * @returns A Set of team IDs the employee belongs to.
	 */
	private async getEmployeeTeamIds(employeeId: ID): Promise<Set<ID>> {
		if (!employeeId) {
			return new Set();
		}

		try {
			const teamMemberships = await this._typeOrmOrganizationTeamEmployeeRepository.find({
				where: {
					employeeId,
					isActive: true
				},
				select: {
					organizationTeamId: true
				}
			});

			return new Set(teamMemberships.map((m) => m.organizationTeamId));
		} catch (error) {
			console.error('Error fetching employee team memberships:', error.message);
			return new Set();
		}
	}

	/**
	 * Synchronous version of visibility check that uses pre-loaded data.
	 * Avoids N+1 queries by using pre-fetched employee team IDs and organization strategic initiative relations.
	 *
	 * @param organizationStrategicInitiative - The organization strategic initiative (with projects.teams relations loaded).
	 * @param employeeId - The current employee ID.
	 * @param employeeTeamIds - Pre-fetched Set of team IDs the employee belongs to.
	 * @param hasLeadership - Pre-computed leadership access flag.
	 * @param seesAllIn - The organizations whose every initiative the caller sees (see `viewer`).
	 * @returns True if the user can view the organization strategic initiative.
	 */
	private canViewOrganizationStrategicInitiativeSync(
		organizationStrategicInitiative: IOrganizationStrategicInitiative,
		employeeId: ID,
		employeeTeamIds: Set<ID>,
		hasLeadershipAccess: boolean,
		seesAllIn: ReadonlySet<ID> = new Set()
	): boolean {
		const { visibilityScope, stewardId } = organizationStrategicInitiative;

		if (this.seesEveryInitiativeOf(organizationStrategicInitiative, seesAllIn)) {
			return true;
		}

		// Steward can always view — only when there IS a steward and a caller identity (both may be
		// null: an unassigned initiative viewed by a non-employee user must not match on null === null).
		if (stewardId && employeeId && stewardId === employeeId) {
			return true;
		}

		switch (visibilityScope) {
			case OrganizationStrategicVisibilityScopeEnum.ORGANIZATION:
				return true;

			case OrganizationStrategicVisibilityScopeEnum.LEADERSHIP:
				return hasLeadershipAccess;

			case OrganizationStrategicVisibilityScopeEnum.TEAM:
				// A member of a team linked directly, or of a team of an associated project (pre-loaded data)
				return this.isTeamMemberOfAssociatedProjectsSync(organizationStrategicInitiative, employeeTeamIds);

			default:
				return false;
		}
	}

	/**
	 * Synchronous check if employee is a team member of associated projects.
	 * Uses pre-loaded relations and pre-fetched team memberships.
	 *
	 * @param organizationStrategicInitiative - The organization strategic initiative with projects.teams relations already loaded.
	 * @param employeeTeamIds - Pre-fetched Set of team IDs the employee belongs to.
	 * @returns True if the employee is a team member of associated projects.
	 */
	private isTeamMemberOfAssociatedProjectsSync(
		organizationStrategicInitiative: IOrganizationStrategicInitiative,
		employeeTeamIds: Set<ID>
	): boolean {
		if (employeeTeamIds.size === 0) {
			return false;
		}

		// A team linked to the initiative directly
		if (organizationStrategicInitiative.teams?.some((team) => employeeTeamIds.has(team.id))) {
			return true;
		}

		if (!organizationStrategicInitiative.projects?.length) {
			return false;
		}

		// Check if any project team matches employee's teams
		for (const project of organizationStrategicInitiative.projects) {
			if (project.teams?.length) {
				for (const team of project.teams) {
					if (employeeTeamIds.has(team.id)) {
						return true;
					}
				}
			}
		}

		return false;
	}

	/**
	 * Checks if the current user can view a strategic initiative based on visibility scope.
	 *
	 * Visibility rules:
	 * - LEADERSHIP: Only admins/managers can view
	 * - ORGANIZATION: All organization members can view
	 * - TEAM: Members of teams linked to associated projects can view
	 *
	 * @param organizationStrategicInitiative - The organization strategic initiative to check.
	 * @param employeeId - The current employee ID.
	 * @param seesAllIn - The organizations whose every initiative the caller sees (see `viewer`).
	 * @returns True if the user can view the organization strategic initiative.
	 */
	private async canViewOrganizationStrategicInitiative(
		organizationStrategicInitiative: IOrganizationStrategicInitiative,
		employeeId: ID,
		seesAllIn: ReadonlySet<ID> = new Set()
	): Promise<boolean> {
		const { visibilityScope, stewardId } = organizationStrategicInitiative;

		if (this.seesEveryInitiativeOf(organizationStrategicInitiative, seesAllIn)) {
			return true;
		}

		// Steward and creator can always view — only when there IS a steward and a caller identity
		// (an unassigned initiative viewed by a non-employee user must not match on null === null).
		if (stewardId && employeeId && stewardId === employeeId) {
			return true;
		}

		switch (visibilityScope) {
			case OrganizationStrategicVisibilityScopeEnum.ORGANIZATION:
				// All organization members can view
				return true;

			case OrganizationStrategicVisibilityScopeEnum.LEADERSHIP:
				// Only leadership (admins/managers) can view
				return await this.hasLeadershipAccess();

			case OrganizationStrategicVisibilityScopeEnum.TEAM:
				// Check if employee is a member of any team linked to associated projects
				return await this.isTeamMemberOfAssociatedProjects(organizationStrategicInitiative, employeeId);

			default:
				return false;
		}
	}

	/**
	 * Checks if the current user has leadership access (admin or manager role).
	 *
	 * @returns True if user has leadership access.
	 */
	private async hasLeadershipAccess(): Promise<boolean> {
		const currentRoleId = RequestContext.currentRoleId();

		// Check if user has a leadership role
		if (currentRoleId) {
			try {
				const role = await this._roleService.findOneByIdString(currentRoleId);
				if (role?.name) {
					const leadershipRoles: RolesEnum[] = [
						RolesEnum.SUPER_ADMIN,
						RolesEnum.ADMIN,
						RolesEnum.MANAGER,
					];
					return leadershipRoles.includes(role.name as RolesEnum);
				}
			} catch (error) {
				console.error('Error checking leadership access:', error.message);
			}
		}

		return false;
	}

	/**
	 * Checks if the employee is a member of any team linked to projects associated with the organization strategic initiative.
	 *
	 * @param organizationStrategicInitiative - The organization strategic initiative.
	 * @param employeeId - The employee ID to check.
	 * @returns True if the employee is a team member of associated projects.
	 */
	private async isTeamMemberOfAssociatedProjects(
		organizationStrategicInitiative: IOrganizationStrategicInitiative,
		employeeId: ID
	): Promise<boolean> {
		try {
			// No employee identity, no team membership — same answer the batch path
			// (getEmployeeTeamIds / canViewOrganizationStrategicInitiativeSync) gives. An empty
			// employeeId used to be dropped from the membership query, turning the check into
			// "any active member exists in a linked team".
			if (!employeeId) {
				return false;
			}
			// Load the organization strategic initiative with its directly linked teams, projects and their teams
			const organizationStrategicInitiativeWithProjects = await this.findOneByOptions({
				where: { id: organizationStrategicInitiative.id },
				relations: ['teams', 'projects', 'projects.teams']
			});

			// Collect the directly linked teams and the teams of the associated projects
			const teamIds: ID[] = (organizationStrategicInitiativeWithProjects?.teams ?? []).map((team) => team.id);
			for (const project of organizationStrategicInitiativeWithProjects?.projects ?? []) {
				if (project.teams?.length) {
					teamIds.push(...project.teams.map((team) => team.id));
				}
			}

			if (teamIds.length === 0) {
				return false;
			}

			// Check if employee is a member of any of these teams
			const membership = await this._typeOrmOrganizationTeamEmployeeRepository.findOne({
				where: {
					employeeId,
					organizationTeamId: In(teamIds),
					isActive: true
				}
			});

			return !!membership;
		} catch (error) {
			console.error('Error checking team membership for initiative:', error.message);
			return false;
		}
	}

	/**
	 * The teams an initiative is linked to directly, as stored.
	 *
	 * @param id - The initiative.
	 * @returns Its directly linked teams (none when it has none).
	 */
	private async linkedTeams(id: ID): Promise<NonNullable<OrganizationStrategicInitiative['teams']>> {
		const row = await this.typeOrmRepository.manager.findOne(OrganizationStrategicInitiative, {
			where: { id },
			relations: { teams: true }
		});
		return row?.teams ?? [];
	}

	/**
	 * Fills `teamIds` from the loaded `teams`, so every read answers the identifiers of the directly linked
	 * teams (REST and GraphQL alike).
	 *
	 * @param initiative - The initiative as read.
	 * @returns The same initiative.
	 */
	private withTeamIds<T extends IOrganizationStrategicInitiative>(
		initiative: T
	): T & IOrganizationStrategicInitiativeRead {
		if (initiative && Array.isArray(initiative.teams)) {
			(initiative as T & IOrganizationStrategicInitiativeRead).teamIds = initiative.teams.map((team) => team.id);
		}
		return initiative as T & IOrganizationStrategicInitiativeRead;
	}

	/**
	 * Resolves the directly linked teams an initiative write states, by identifier. Every identifier must name a
	 * team of the initiative's organization in the caller's tenant: a team of another organization or tenant is
	 * refused rather than linked.
	 *
	 * @param teamIds - The stated identifiers; `undefined` when the write does not touch the teams.
	 * @param organizationId - The initiative's organization.
	 * @param tenantId - The initiative's tenant.
	 * @returns The teams to link (an empty list unlinks them all), or `undefined` to leave them as they are.
	 * @throws {BadRequestException} When an identifier names no team of the organization.
	 */
	private async resolveTeams(
		teamIds: ID[] | undefined,
		organizationId: ID,
		tenantId: ID
	): Promise<OrganizationTeam[] | undefined> {
		if (teamIds === undefined || teamIds === null) {
			return undefined;
		}
		if (!Array.isArray(teamIds)) {
			throw new BadRequestException('teamIds must be a list of team identifiers.');
		}
		const ids = [...new Set(teamIds)];
		if (ids.length === 0) {
			return [];
		}
		if (!organizationId || !tenantId) {
			throw new BadRequestException('The teams of an initiative are read in its organization and tenant.');
		}
		const teams = await this.typeOrmRepository.manager.find(OrganizationTeam, {
			where: { id: In(ids), organizationId, tenantId },
			select: { id: true }
		});
		if (teams.length !== ids.length) {
			throw new BadRequestException("Every linked team must be a team of the initiative's organization.");
		}
		return ids.map((id) => ({ id }) as OrganizationTeam);
	}
}
