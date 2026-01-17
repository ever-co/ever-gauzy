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

		const { items } = await super.findAll(filters);

		// Filter organization strategic initiatives based on visibility scope
		const filteredOrganizationStrategicInitiatives: IOrganizationStrategicInitiative[] = [];
		for (const organizationStrategicInitiative of items) {
			const canView = await this.canViewOrganizationStrategicInitiative(organizationStrategicInitiative, currentEmployeeId);
			if (canView) {
				filteredOrganizationStrategicInitiatives.push(organizationStrategicInitiative);
			}
		}

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
			...(params)
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

		// Get the project with its strategic initiatives
		const project = await this._typeOrmOrganizationProjectRepository.findOne({
			where: { id: projectId, tenantId },
			relations: ['organizationStrategicInitiatives']
		});

		if (!project) {
			throw new NotFoundException(`Project with id ${projectId} not found`);
		}

		const organizationStrategicInitiatives = project.organizationStrategicInitiatives ?? [];

		// Filter by visibility
		const visibleOrganizationStrategicInitiatives: IOrganizationStrategicInitiative[] = [];
		for (const organizationStrategicInitiative of organizationStrategicInitiatives) {
			const canView = await this.canViewOrganizationStrategicInitiative(organizationStrategicInitiative, currentEmployeeId);
			if (canView) {
				visibleOrganizationStrategicInitiatives.push(organizationStrategicInitiative);
			}
		}

		return visibleOrganizationStrategicInitiatives;
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

		// Parse existing signals if string
		const existingSignals =
			typeof organizationStrategicInitiative.signals === 'string' ? JSON.parse(organizationStrategicInitiative.signals) : organizationStrategicInitiative.signals ?? {};

		// Merge with new signals
		const updatedSignals = {
			...existingSignals,
			...(typeof signals === 'string' ? JSON.parse(signals) : signals),
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
		const { visibilityScope, stewardId} = organizationStrategicInitiative;

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
