import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, FindManyOptions, FindOptionsWhere, In, UpdateResult } from 'typeorm';
import {
	ActionTypeEnum,
	ActorTypeEnum,
	BaseEntityEnum,
	BroadcastVisibilityModeEnum,
	IAudienceRules,
	IBroadcast,
	IBroadcastCreateInput,
	IBroadcastFindInput,
	IBroadcastUpdateInput,
	ID,
	IPagination,
	RolesEnum
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { RequestContext } from '../core/context';
import { EmployeeService } from '../employee/employee.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { RoleService } from '../role/role.service';
import { TypeOrmOrganizationTeamEmployeeRepository } from '../organization-team-employee/repository/type-orm-organization-team-employee.repository';
import { Broadcast } from './broadcast.entity';
import { TypeOrmBroadcastRepository } from './repository/type-orm-broadcast.repository';
import { MikroOrmBroadcastRepository } from './repository/mikro-orm-broadcast.repository';

@Injectable()
export class BroadcastService extends TenantAwareCrudService<Broadcast> {
	constructor(
		@InjectDataSource() private readonly dataSource: DataSource,
		readonly typeOrmBroadcastRepository: TypeOrmBroadcastRepository,
		readonly mikroOrmBroadcastRepository: MikroOrmBroadcastRepository,
		private readonly _employeeService: EmployeeService,
		private readonly _activityLogService: ActivityLogService,
		private readonly _roleService: RoleService,
		private readonly _typeOrmOrganizationTeamEmployeeRepository: TypeOrmOrganizationTeamEmployeeRepository
	) {
		super(typeOrmBroadcastRepository, mikroOrmBroadcastRepository);
	}

	/**
	 * Creates a new broadcast.
	 *
	 * @param input - The input data for creating a broadcast.
	 * @returns A promise that resolves to the created broadcast.
	 * @throws {NotFoundException} If the employee (publisher) is not found.
	 * @throws {BadRequestException} If an error occurs during the creation.
	 */
	async create(input: IBroadcastCreateInput): Promise<IBroadcast> {
		try {
			// Retrieve context-specific IDs
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
			const employeeId = RequestContext.currentEmployeeId();
			const { organizationId, ...data } = input;

			// Validate that the employee exists
			const employee = await this._employeeService.findOneByIdString(employeeId);
			if (!employee) {
				throw new NotFoundException(`Employee with id ${employeeId} not found`);
			}

			// Create the broadcast with publishedAt defaulting to now if not provided
			const broadcast = await super.create({
				...data,
				employeeId,
				tenantId,
				organizationId,
				publishedAt: input.publishedAt ?? new Date()
			});

			// Log activity for broadcast creation
			this._activityLogService.logActivity<Broadcast>(
				BaseEntityEnum.Broadcast,
				ActionTypeEnum.Created,
				ActorTypeEnum.User,
				broadcast.id,
				broadcast.title,
				broadcast,
				organizationId,
				tenantId
			);

			return broadcast;
		} catch (error) {
			console.log(`Error while creating broadcast: ${error.message}`, error);
			throw new BadRequestException('Broadcast creation failed', error);
		}
	}

	/**
	 * Updates an existing broadcast.
	 *
	 * @param id - The unique identifier of the broadcast to update.
	 * @param input - The update data for the broadcast.
	 * @returns A promise that resolves to the updated broadcast or update result.
	 * @throws {BadRequestException} If the broadcast is not found or update fails.
	 */
	async update(id: ID, input: IBroadcastUpdateInput): Promise<IBroadcast | UpdateResult> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const employeeId = RequestContext.currentEmployeeId();

			// Find the broadcast for the current employee with the given id
			const originalBroadcast = await this.findOneByWhereOptions({
				id,
				employeeId
			});

			if (!originalBroadcast) {
				throw new BadRequestException(`Broadcast with id ${id} not found or you don't have permission to update it`);
			}

			// Update the broadcast with the new input data
			const updatedBroadcast = await super.create({
				...input,
				id
			});

			// Log activity for broadcast update
			this._activityLogService.logActivity<Broadcast>(
				BaseEntityEnum.Broadcast,
				ActionTypeEnum.Updated,
				ActorTypeEnum.User,
				id,
				updatedBroadcast.title,
				updatedBroadcast,
				originalBroadcast.organizationId,
				tenantId,
				originalBroadcast,
				input as Partial<Broadcast>
			);

			return updatedBroadcast;
		} catch (error) {
			console.log(`Error while updating broadcast: ${error.message}`, error);
			throw new BadRequestException('Broadcast update failed', error);
		}
	}

	/**
	 * Finds broadcasts with visibility and audience filtering.
	 *
	 * @param filters - Filter criteria for broadcasts.
	 * @returns A promise that resolves to a paginated list of broadcasts.
	 */
	async findBroadcasts(filters: IBroadcastFindInput & { relations?: string[] }): Promise<IPagination<IBroadcast>> {
		const tenantId = RequestContext.currentTenantId();
		const employeeId = RequestContext.currentEmployeeId();
		const currentUser = RequestContext.currentUser();
		const currentRoleId = RequestContext.currentRoleId();

		const { entity, entityId, category, visibilityMode, isArchived = false, relations = [] } = filters;

		// Build the base where condition
		const where: FindOptionsWhere<Broadcast> = {
			tenantId,
			...(entity && { entity }),
			...(entityId && { entityId }),
			...(category && { category }),
			...(visibilityMode && { visibilityMode }),
			isArchived,
			isActive: true
		};

		// Retrieve all broadcasts matching base criteria
		const queryOptions: FindManyOptions<Broadcast> = {
			where,
			relations,
			order: { publishedAt: 'DESC' }
		};

		const { items } = await super.findAll(queryOptions);

		// Filter broadcasts based on visibility mode and audience rules
		const filteredBroadcasts: IBroadcast[] = [];
		for (const broadcast of items) {
			const canView = await this.canViewBroadcast(broadcast, employeeId, currentUser?.id, currentRoleId);
			if (canView) {
				filteredBroadcasts.push(broadcast);
			}
		}

		return {
			items: filteredBroadcasts,
			total: filteredBroadcasts.length
		};
	}

	/**
	 * Checks if the current user can view a broadcast based on visibility mode and audience rules.
	 *
	 * @param broadcast - The broadcast to check.
	 * @param employeeId - The current employee ID.
	 * @param userId - The current user ID.
	 * @param roleId - The current role ID.
	 * @returns True if the user can view the broadcast, false otherwise.
	 */
	private async canViewBroadcast(broadcast: IBroadcast, employeeId: ID, userId: ID, roleId: ID): Promise<boolean> {
		const { visibilityMode, audienceRules, employeeId: publisherId, entity, entityId } = broadcast;

		// Publisher can always view their own broadcasts
		if (publisherId === employeeId) {
			return true;
		}

		switch (visibilityMode) {
			case BroadcastVisibilityModeEnum.ORGANIZATION:
				// All organization members can view
				return true;

			case BroadcastVisibilityModeEnum.ENTITY_MEMBERS:
				// Check if employee is a member of the entity
				return await this.isEntityMember(entity, entityId, employeeId);

			case BroadcastVisibilityModeEnum.RESTRICTED:
				// Check audience rules
				return await this.checkAudienceRules(audienceRules, employeeId, userId, roleId);

			case BroadcastVisibilityModeEnum.EXTERNAL_VIEW:
				// External view requires a shared token, not direct access
				return false;

			default:
				return false;
		}
	}

	/**
	 * Checks if an employee is a member of a specific entity by loading the entity with its members relation.
	 * Supports: Organization (employees), OrganizationProject, OrganizationTeam, OrganizationDepartment (members).
	 *
	 * @param entity - The entity type.
	 * @param entityId - The entity ID.
	 * @param employeeId - The employee ID to check.
	 * @returns True if the employee is a member of the entity.
	 */
	private async isEntityMember(entity: BaseEntityEnum, entityId: ID, employeeId: ID): Promise<boolean> {
		try {
			// Organization uses 'employees' relation, others use 'members'
			const relationName = entity === BaseEntityEnum.Organization ? 'employees' : 'members';

			// Load the entity with its members/employees relation
			const repository = this.dataSource.getRepository(entity);
			const entityWithMembers = await repository.findOne({
				where: { id: entityId },
				relations: [relationName]
			});

			if (!entityWithMembers) {
				return false;
			}

			const members = entityWithMembers[relationName] || [];

			// OrganizationProject & OrganizationTeam: members are liaison entities with employeeId, isActive, isArchived
			// OrganizationDepartment & Organization: members/employees are Employee entities directly (check by id)
			if (entity === BaseEntityEnum.OrganizationProject || entity === BaseEntityEnum.OrganizationTeam) {
				return members.some((m: any) => m.employeeId === employeeId && m.isActive && !m.isArchived);
			}

			// OrganizationDepartment & Organization: direct Employee relation
			return members.some((m: any) => m.id === employeeId);
		} catch (error) {
			console.log(`Error checking entity membership for ${entity}:`, error.message);
			return false;
		}
	}

	/**
	 * Checks if the current user matches the audience rules.
	 *
	 * @param audienceRules - The audience rules to check.
	 * @param employeeId - The current employee ID.
	 * @param userId - The current user ID.
	 * @param roleId - The current role ID.
	 * @returns True if the user matches the audience rules, false otherwise.
	 */
	private async checkAudienceRules(
		audienceRules: IAudienceRules | string | undefined,
		employeeId: ID,
		userId: ID,
		roleId: ID
	): Promise<boolean> {
		if (!audienceRules) {
			return false;
		}

		// Parse audience rules if stored as string
		const rules: IAudienceRules =
			typeof audienceRules === 'string' ? JSON.parse(audienceRules) : audienceRules;

		// Check if user is in allowed user IDs
		if (rules.userIds?.includes(userId)) {
			return true;
		}

		// Check if employee is in allowed employee IDs
		if (rules.employeeIds?.includes(employeeId)) {
			return true;
		}

		// Check if user's role matches allowed roles
		if (rules.roles?.length && roleId) {
			try {
				const role = await this._roleService.findOneByIdString(roleId);
				if (role?.name) {
					const roleName = role.name as RolesEnum;

					// Check if role is in allowed roles
					if (rules.roles.includes(roleName)) {
						// Also check if role is not in excluded roles
						if (!rules.excludeRoles?.includes(roleName)) {
							return true;
						}
					}
				}
			} catch (error) {
				// Role not found, continue checking other rules
				console.log(`Role with id ${roleId} not found:`, error.message);
			}
		}

		// Check if employee is in allowed teams
		if (rules.teamIds?.length && employeeId) {
			try {
				const teamMemberships = await this._typeOrmOrganizationTeamEmployeeRepository.find({
					where: {
						employeeId,
						organizationTeamId: In(rules.teamIds)
					}
				});

				if (teamMemberships.length > 0) {
					return true;
				}
			} catch (error) {
				// Error checking team membership, continue
				console.log(`Error checking team membership:`, error.message);
			}
		}

		return false;
	}
}
