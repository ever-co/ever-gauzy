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

			// Create the organization strategic initiative
			const organizationStrategicInitiative = await super.create({
				...input,
				tenantId,
				organizationId,
				// Set current employee as creator if employeeId not provided
				stewardId: input.stewardId ?? currentEmployeeId
			});

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
			if (error instanceof ForbiddenException || error instanceof NotFoundException) {
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

			// Update the organization strategic initiative
			const updatedOrganizationStrategicInitiative = await super.create({
				...input,
				id
			});

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
			if (error instanceof ForbiddenException || error instanceof NotFoundException) {
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

		// Ensure relations for visibility check are loaded (projects and their teams)
		const relationsToLoad = ['projects', 'projects.teams'];
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
			items: filteredOrganizationStrategicInitiatives,
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

		// Find the organization strategic initiative with optional relations
		const organizationStrategicInitiative = await this.findOneByOptions({
			...(params),
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

		return organizationStrategicInitiative;
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
			relations: [
				'organizationStrategicInitiatives',
				'organizationStrategicInitiatives.projects',
				'organizationStrategicInitiatives.projects.teams'
			]
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
		return organizationStrategicInitiatives.filter((initiative) =>
			this.canViewOrganizationStrategicInitiativeSync(initiative, currentEmployeeId, employeeTeamIds, hasLeadership)
		);
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

		// Steward can always view
		if (stewardId === employeeId) {
			return true;
		}

		switch (visibilityScope) {
			case OrganizationStrategicVisibilityScopeEnum.ORGANIZATION:
				return true;

			case OrganizationStrategicVisibilityScopeEnum.LEADERSHIP:
				return hasLeadershipAccess;

			case OrganizationStrategicVisibilityScopeEnum.TEAM:
				// Check if employee is a member of any team linked to associated projects (using pre-loaded data)
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
		if (!organizationStrategicInitiative.projects?.length || employeeTeamIds.size === 0) {
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

		// Steward and creator can always view
		if (stewardId === employeeId) {
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
			// Load the organization strategic initiative with its projects and their teams
			const organizationStrategicInitiativeWithProjects = await this.findOneByOptions({
				where: { id: organizationStrategicInitiative.id },
				relations: ['projects', 'projects.teams']
			});

			if (!organizationStrategicInitiativeWithProjects?.projects?.length) {
				return false;
			}

			// Collect all team IDs from associated projects
			const teamIds: ID[] = [];
			for (const project of organizationStrategicInitiativeWithProjects.projects) {
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
}
