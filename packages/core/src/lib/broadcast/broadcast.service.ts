import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, FindManyOptions, FindOptionsWhere, In, UpdateResult } from 'typeorm';
import {
	ActionTypeEnum,
	ActorTypeEnum,
	BaseEntityEnum,
	BroadcastVisibilityModeEnum,
	EmployeeNotificationTypeEnum,
	IAudienceRules,
	IBroadcast,
	IBroadcastCreateInput,
	IBroadcastUpdateInput,
	ID,
	IPagination, NotificationActionTypeEnum,
	RolesEnum
} from '@gauzy/contracts';
import { BaseQueryDTO, TenantAwareCrudService } from '../core/crud';
import { RequestContext } from '../core/context';
import { EmployeeService } from '../employee/employee.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { RoleService } from '../role/role.service';
import { EmployeeNotificationService } from '../employee-notification/employee-notification.service';
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
		private readonly _employeeNotificationService: EmployeeNotificationService,
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

			// Notify the audience asynchronously (don't await to avoid blocking)
			this.notifyAudience(broadcast, employee?.fullName).catch((err) =>
				console.error('Error notifying audience:', err.message)
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
	async findAll(filters: BaseQueryDTO<Broadcast>): Promise<IPagination<IBroadcast>> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId() ?? filters.where?.organizationId;
		const employeeId = RequestContext.currentEmployeeId();
		const currentUser = RequestContext.currentUser();
		const currentRoleId = RequestContext.currentRoleId();

		// Extract filters from where clause
		const whereClause = filters.where ?? {};
		const { entity, entityId, category, visibilityMode, isArchived = false } = whereClause;
		const relations = Array.isArray(filters.relations) ? filters.relations as string[] : [];

		// Extract pagination options from filters
		const { take, skip } = filters;

		// Build the base where condition with organizationId for proper scoping
		const where: FindOptionsWhere<Broadcast> = {
			tenantId,
			...(organizationId && { organizationId }),
			...(entity && { entity }),
			...(entityId && { entityId }),
			...(category && { category }),
			...(visibilityMode && { visibilityMode }),
			isArchived,
			isActive: true
		};

		// Retrieve broadcasts matching base criteria with pagination
		const queryOptions: FindManyOptions<Broadcast> = {
			where,
			relations,
			order: { publishedAt: 'DESC' },
			...(take !== undefined && { take }),
			...(skip !== undefined && { skip })
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
	 * Finds a single broadcast by ID with visibility checks.
	 *
	 * @param id - The unique identifier of the broadcast.
	 * @param relations - Optional relations to load.
	 * @returns A promise that resolves to the broadcast if found and visible.
	 * @throws {NotFoundException} If the broadcast is not found or not visible to the current user.
	 */
	async findOneById(id: ID, params?: BaseQueryDTO<Broadcast>): Promise<IBroadcast> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId() ?? params?.where?.organizationId;
		const employeeId = RequestContext.currentEmployeeId();
		const currentUser = RequestContext.currentUser();
		const currentRoleId = RequestContext.currentRoleId();

		// Build where condition with tenant and organization scoping
		const where: FindOptionsWhere<Broadcast> = {
			id,
			tenantId,
			...(organizationId && { organizationId }),
			isActive: true
		};

		// Find the broadcast with optional relations
		const broadcast = await this.findOneByOptions({
			where,
			...(params?.relations && { relations: params.relations })
		});

		if (!broadcast) {
			throw new NotFoundException(`Broadcast with id ${id} not found`);
		}

		// Check if the current user can view this broadcast
		const canView = await this.canViewBroadcast(broadcast, employeeId, currentUser?.id, currentRoleId);

		if (!canView) {
			throw new NotFoundException(`Broadcast with id ${id} not found or you don't have permission to view it`);
		}

		return broadcast;
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

		// Parse audience rules if stored as string, with error handling for malformed JSON
		let rules: IAudienceRules;
		try {
			rules = typeof audienceRules === 'string' ? JSON.parse(audienceRules) : audienceRules;
		} catch (error) {
			console.error('Failed to parse audienceRules JSON:', error.message);
			// Treat invalid JSON as "not visible" for security
			return false;
		}

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
				console.log('Role not found', { roleId, message: error.message });
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

	/**
	 * Notifies the audience of a new broadcast based on visibility mode and audience rules.
	 *
	 * @param broadcast - The broadcast to notify about.
	 * @param publisherName - The name of the employee who published the broadcast.
	 */
	private async notifyAudience(broadcast: IBroadcast, publisherName: string): Promise<void> {
		const { visibilityMode, audienceRules, organizationId, tenantId, employeeId: publisherId } = broadcast;

		// Get the list of employee IDs to notify based on visibility mode
		let employeeIdsToNotify: ID[] = [];

		switch (visibilityMode) {
			case BroadcastVisibilityModeEnum.ORGANIZATION:
				// Notify all employees in the organization
				const orgEmployees = await this._employeeService.findAll({
					where: { organizationId, tenantId, isActive: true }
				});
				employeeIdsToNotify = orgEmployees.items.map((e) => e.id).filter((id) => id !== publisherId);
				break;

			case BroadcastVisibilityModeEnum.ENTITY_MEMBERS:
				// Notify entity members (handled via isEntityMember check already in findAll)
				// For notifications, we need to get the actual members
				employeeIdsToNotify = await this.getEntityMemberIds(broadcast);
				break;

			case BroadcastVisibilityModeEnum.RESTRICTED:
				// Notify only employees in audience rules
				employeeIdsToNotify = await this.getRestrictedAudienceIds(audienceRules, organizationId, tenantId);
				break;

			case BroadcastVisibilityModeEnum.EXTERNAL_VIEW:
				// External view doesn't notify internal employees
				return;
		}

		// Remove duplicates and the publisher
		const uniqueEmployeeIds = [...new Set(employeeIdsToNotify)].filter((id) => id !== publisherId);

		// Send notifications to each employee
		for (const receiverEmployeeId of uniqueEmployeeIds) {
			this._employeeNotificationService.publishNotificationEvent(
				{
					entity: BaseEntityEnum.Broadcast,
					entityId: broadcast.id,
					type: EmployeeNotificationTypeEnum.BROADCAST,
					message: broadcast.title,
					sentByEmployeeId: publisherId,
					receiverEmployeeId,
					organizationId,
					tenantId
				},
				NotificationActionTypeEnum.Broadcasted,
				broadcast.title,
				publisherName
			);
		}
	}

	/**
	 * Gets employee IDs that are members of the broadcast's entity.
	 *
	 * @param broadcast - The broadcast containing entity information.
	 * @returns Array of employee IDs.
	 */
	private async getEntityMemberIds(broadcast: IBroadcast): Promise<ID[]> {
		const { entity, entityId } = broadcast;
		const relationName = entity === BaseEntityEnum.Organization ? 'employees' : 'members';

		try {
			const repository = this.dataSource.getRepository(entity);
			const entityWithMembers = await repository.findOne({
				where: { id: entityId },
				relations: [relationName]
			});

			if (!entityWithMembers) return [];

			const members = entityWithMembers[relationName] || [];

			// Project/Team: members have employeeId; Department/Organization: members are employees directly
			if (entity === BaseEntityEnum.OrganizationProject || entity === BaseEntityEnum.OrganizationTeam) {
				return members.filter((m: any) => m.isActive && !m.isArchived).map((m: any) => m.employeeId);
			}

			return members.map((m: any) => m.id);
		} catch (error) {
			console.error(`Error getting entity members for ${entity}:`, error.message);
			return [];
		}
	}

	/**
	 * Gets employee IDs from restricted audience rules.
	 *
	 * @param audienceRules - The audience rules defining who can view.
	 * @param organizationId - The organization ID.
	 * @param tenantId - The tenant ID.
	 * @returns Array of employee IDs.
	 */
	private async getRestrictedAudienceIds(
		audienceRules: IAudienceRules | string,
		organizationId: ID,
		tenantId: ID
	): Promise<ID[]> {
		if (!audienceRules) return [];

		// Parse audience rules if stored as string, with error handling for malformed JSON
		let rules: IAudienceRules;
		try {
			rules = typeof audienceRules === 'string' ? JSON.parse(audienceRules) : audienceRules;
		} catch (error) {
			console.error('Failed to parse audienceRules JSON in getRestrictedAudienceIds:', error.message);
			// Return empty array if rules cannot be parsed
			return [];
		}

		const employeeIds: ID[] = [];

		// Add directly specified employee IDs
		if (rules.employeeIds?.length) {
			employeeIds.push(...rules.employeeIds);
		}

		// Get employees from specified teams
		if (rules.teamIds?.length) {
			const teamMembers = await this._typeOrmOrganizationTeamEmployeeRepository.find({
				where: { organizationTeamId: In(rules.teamIds), isActive: true }
			});
			employeeIds.push(...teamMembers.map((m) => m.employeeId));
		}

		// Get employees with specified roles
		if (rules.roles?.length) {
			const employees = await this._employeeService.findAll({
				where: { organizationId, tenantId, isActive: true },
				relations: ['user', 'user.role']
			});

			for (const emp of employees.items) {
				const roleName = emp.user?.role?.name as RolesEnum;
				if (roleName && rules.roles.includes(roleName)) {
					if (!rules.excludeRoles?.includes(roleName)) {
						employeeIds.push(emp.id);
					}
				}
			}
		}

		return employeeIds;
	}
}
