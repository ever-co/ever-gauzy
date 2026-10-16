import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { In, UpdateResult } from 'typeorm';
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
	RolesEnum
} from '@gauzy/contracts';
import { BaseQueryDTO, TenantAwareCrudService } from '../core/crud';
import { RequestContext } from '../core/context';
import { EmployeeService } from '../employee/employee.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { RoleService } from '../role/role.service';
import { TypeOrmOrganizationTeamEmployeeRepository } from '../organization-team-employee/repository/type-orm-organization-team-employee.repository';
import { TypeOrmOrganizationProjectRepository } from '../organization-project/repository/type-orm-organization-project.repository';
import { OrganizationTeam } from '../core/entities/internal';
import { OrganizationStrategicInitiative } from './organization-strategic-initiative.entity';
import { TypeOrmOrganizationStrategicInitiativeRepository } from './repository/type-orm-organization-strategic-initiative.repository';
import { MikroOrmOrganizationStrategicInitiativeRepository } from './repository/mikro-orm-organization-strategic-initiative.repository';

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

			// The directly linked teams, each one a team of the initiative's organization
			const { teamIds, ...values } = input;
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

			// The directly linked teams are replaced when `teamIds` is stated, and left as they are otherwise
			const { teamIds, ...values } = input;
			const teams = await this.resolveTeams(
				teamIds,
				originalOrganizationStrategicInitiative.organizationId,
				originalOrganizationStrategicInitiative.tenantId
			);

			// Update the organization strategic initiative
			const updatedOrganizationStrategicInitiative = await super.create({
				...values,
				...(teams ? { teams } : {}),
				id
			});
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
		const currentEmployeeId = RequestContext.currentEmployeeId();

		// Ensure relations for visibility check are loaded (the directly linked teams, projects and their teams)
		const relationsToLoad = ['teams', 'projects', 'projects.teams'];
		const existingRelations = Array.isArray(filters.relations) ? filters.relations : [];
		const mergedRelations = [...new Set([...existingRelations, ...relationsToLoad])];

		const { items } = await super.findAll({
			...filters,
			relations: mergedRelations
		});

		// Pre-fetch employee team memberships to avoid N+1 queries
		const employeeTeamIds = await this.getEmployeeTeamIds(currentEmployeeId);

		// Check leadership access once (instead of per-initiative)
		const hasLeadership = await this.hasLeadershipAccess();

		// Filter organization strategic initiatives based on visibility scope (no extra queries)
		const filteredOrganizationStrategicInitiatives = items.filter((initiative) =>
			this.canViewOrganizationStrategicInitiativeSync(initiative, currentEmployeeId, employeeTeamIds, hasLeadership)
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
		const currentEmployeeId = RequestContext.currentEmployeeId();

		// Find the organization strategic initiative with optional relations, and its directly linked teams
		const requestedRelations = Array.isArray(params?.relations) ? params.relations : [];
		const organizationStrategicInitiative = await this.findOneByOptions({
			...(params),
			relations: [...new Set([...requestedRelations, 'teams'])],
			where: {
				...(params?.where && { ...params.where }),
				id
			}
		});

		if (!organizationStrategicInitiative) {
			throw new NotFoundException(`Organization strategic initiative with id ${id} not found`);
		}

		// Check visibility
		const canView = await this.canViewOrganizationStrategicInitiative(organizationStrategicInitiative, currentEmployeeId);
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
		const currentEmployeeId = RequestContext.currentEmployeeId();

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

		if (!project) {
			throw new NotFoundException(`Project with id ${projectId} not found`);
		}

		const organizationStrategicInitiatives = project.organizationStrategicInitiatives ?? [];

		// Pre-fetch employee team memberships to avoid N+1 queries
		const employeeTeamIds = await this.getEmployeeTeamIds(currentEmployeeId);

		// Check leadership access once (instead of per-initiative)
		const hasLeadership = await this.hasLeadershipAccess();

		// Filter by visibility (no extra queries)
		return organizationStrategicInitiatives
			.filter((initiative) =>
				this.canViewOrganizationStrategicInitiativeSync(
					initiative,
					currentEmployeeId,
					employeeTeamIds,
					hasLeadership
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
	 * @returns True if the user can view the organization strategic initiative.
	 */
	private canViewOrganizationStrategicInitiativeSync(
		organizationStrategicInitiative: IOrganizationStrategicInitiative,
		employeeId: ID,
		employeeTeamIds: Set<ID>,
		hasLeadershipAccess: boolean
	): boolean {
		const { visibilityScope, stewardId } = organizationStrategicInitiative;

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
	 * @returns True if the user can view the organization strategic initiative.
	 */
	private async canViewOrganizationStrategicInitiative(
		organizationStrategicInitiative: IOrganizationStrategicInitiative,
		employeeId: ID
	): Promise<boolean> {
		const { visibilityScope, stewardId } = organizationStrategicInitiative;

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
