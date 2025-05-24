import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
	Brackets,
	DataSource,
	DeleteResult,
	FindManyOptions,
	In,
	SelectQueryBuilder,
	UpdateResult,
	WhereExpressionBuilder
} from 'typeorm';
import {
	BaseEntityEnum,
	ActorTypeEnum,
	ID,
	IOrganizationProjectModule,
	IOrganizationProjectModuleCreateInput,
	IOrganizationProjectModuleFindInput,
	IOrganizationProjectModuleUpdateInput,
	IPagination,
	PermissionsEnum,
	ProjectModuleStatusEnum,
	ActionTypeEnum,
	RolesEnum,
	IEmployee,
	ITask
} from '@gauzy/contracts';
import { isEmpty, isNotEmpty } from '@gauzy/utils';
import { BaseQueryDTO, TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { LIKE_OPERATOR } from '../core/util';
import { OrganizationProjectModule } from './organization-project-module.entity';
import { prepareSQLQuery as p } from './../database/database.helper';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { RoleService } from '../role/role.service';
import { EmployeeService } from '../employee/employee.service';
import { TaskService } from '../tasks/task.service';
import { OrganizationProjectModuleEmployee } from './organization-project-module-employee.entity';
import { TypeOrmOrganizationProjectModuleRepository } from './repository/type-orm-organization-project-module.repository';
import { MikroOrmOrganizationProjectModuleRepository } from './repository/mikro-orm-organization-project-module.repository';
import { TypeOrmOrganizationProjectModuleEmployeeRepository } from './repository/type-orm-organization-project-module-employee.repository';
import { MikroOrmOrganizationProjectModuleEmployeeRepository } from './repository/mikro-orm-organization-project-module-employee.repository';

@Injectable()
export class OrganizationProjectModuleService extends TenantAwareCrudService<OrganizationProjectModule> {
	constructor(
		@InjectDataSource() private readonly dataSource: DataSource,
		readonly typeOrmProjectModuleRepository: TypeOrmOrganizationProjectModuleRepository,
		readonly mikroOrmProjectModuleRepository: MikroOrmOrganizationProjectModuleRepository,
		readonly typeOrmOrganizationProjectModuleEmployeeRepository: TypeOrmOrganizationProjectModuleEmployeeRepository,
		readonly mikroOrmOrganizationProjectModuleEmployeeRepository: MikroOrmOrganizationProjectModuleEmployeeRepository,
		private readonly _activityLogService: ActivityLogService,
		private readonly _roleService: RoleService,
		private readonly _employeeService: EmployeeService,
		private readonly _taskService: TaskService
	) {
		super(typeOrmProjectModuleRepository, mikroOrmProjectModuleRepository);
	}

	/**
	 * Creates a new organization project module with the provided input.
	 *
	 * @param entity - The input data to create the project module.
	 * @returns The created organization project module.
	 */
	async create(entity: IOrganizationProjectModuleCreateInput): Promise<IOrganizationProjectModule> {
		const tenantId = RequestContext.currentTenantId() ?? entity.tenantId;
		const employeeId = RequestContext.currentEmployeeId();
		const currentRoleId = RequestContext.currentRoleId();

		const { organizationId, memberIds = [], managerIds = [], tasks = [], ...data } = entity;

		// Add the current employee to managerIds if they have the appropriate role
		await this.addCurrentEmployeeToManagers(managerIds, currentRoleId, employeeId);

		// Merge memberIds and managerIds to form the complete list of employee IDs
		const employeeIds = [...memberIds, ...managerIds].filter(Boolean);

		// Fetch the list of active employees based on the provided employee IDs
		const employees = await this._employeeService.findActiveEmployeesByEmployeeIds(
			employeeIds,
			organizationId,
			tenantId
		);

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();

		try {
			await queryRunner.startTransaction();

			// Get existing tasks
			const existingTasks = await this.getExistingTasks(tasks);
			const members = await this.buildModuleMembers(employees, managerIds, organizationId, tenantId);

			const projectModule = await super.create({
				...data,
				members,
				organizationId,
				tenantId
			});

			await this.assignTasksToModule(existingTasks, projectModule);
			await queryRunner.commitTransaction();

			this.logModuleActivity(ActionTypeEnum.Created, projectModule, undefined, entity);

			return projectModule;
		} catch (error) {
			await queryRunner.rollbackTransaction();
			throw new HttpException(
				`Failed to create organization project module: ${error.message}`,
				HttpStatus.BAD_REQUEST
			);
		} finally {
			await queryRunner.release();
		}
	}

	/**
	 * @description Update Project Module
	 * @param {ID} id - The project module ID to be updated
	 * @param {IOrganizationProjectModuleUpdateInput} entity Body Request data
	 * @returns A promise resolved to updated project module Or Update Result
	 * @memberof OrganizationProjectModuleService
	 */
	async update(
		id: ID,
		entity: IOrganizationProjectModuleUpdateInput
	): Promise<IOrganizationProjectModule | UpdateResult> {
		const tenantId = RequestContext.currentTenantId() ?? entity.tenantId;

		try {
			const { memberIds, managerIds, organizationId, tasks = [] } = entity;

			// Retrieve existing module
			const existingProjectModule = await this.findOneByIdString(id, {
				relations: { parent: true, project: true, teams: true, members: true, tasks: true }
			});

			if (!existingProjectModule) {
				throw new BadRequestException('Module not found');
			}

			// Update members and managers if applicable
			if (Array.isArray(memberIds) || Array.isArray(managerIds)) {
				const employeeIds = [...(memberIds || []), ...(managerIds || [])].filter(Boolean);

				// Retrieves a collection of employees based on specified criteria
				const projectModuleMembers = await this._employeeService.findActiveEmployeesByEmployeeIds(
					employeeIds,
					organizationId,
					tenantId
				);

				// Update nested entity (Organization Project Members)
				await this.updateOrganizationProjectModuleMembers(
					id,
					organizationId,
					projectModuleMembers,
					managerIds || [],
					memberIds || []
				);
			}

			// Update tasks logic
			if (Array.isArray(tasks)) {
				const existingTasks = await this.getExistingTasks(tasks);

				// Determine tasks to add
				const existingTaskIds = new Set(existingTasks.map((task) => task.id));
				const newTasks = tasks.filter((task) => !existingTaskIds.has(task.id));

				// Determine tasks to remove
				const tasksToRemove = existingProjectModule.tasks.filter(
					(task) => !tasks.some((updatedTask) => updatedTask.id === task.id)
				);

				// Add new tasks
				for (const task of newTasks) {
					task.modules = [...(task.modules || []), existingProjectModule];
					await this._taskService.update(task.id, task);
				}

				// Remove tasks
				for (const task of tasksToRemove) {
					task.modules = task.modules?.filter((module) => module.id !== existingProjectModule.id) || [];
					await this._taskService.update(task.id, task);
				}
			}

			// Update the project module with new values
			const updatedProjectModule = await super.create({
				...entity,
				id
			});

			// Generate the activity log
			this.logModuleActivity(ActionTypeEnum.Updated, updatedProjectModule, existingProjectModule, entity);

			// Return updated module
			return updatedProjectModule;
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * @description Find employee project modules
	 * @param options - Options finders and relations
	 * @returns - A promise that resolves after found project modules
	 * @memberof OrganizationProjectModuleService
	 */
	async getEmployeeProjectModules(
		options: BaseQueryDTO<OrganizationProjectModule>
	): Promise<IPagination<IOrganizationProjectModule>> {
		try {
			const { where } = options;
			const { name, status, organizationId, projectId, members } = where;
			const tenantId = RequestContext.currentTenantId() ?? options.where.tenantId;

			// Create query builder
			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
			// Join employees
			query.innerJoin(`${query.alias}.members`, 'members');

			// Apply pagination and query options
			this.applyPaginationAndOptions(query, options);

			query.andWhere((qb: SelectQueryBuilder<OrganizationProjectModule>) => {
				const subQuery = qb.subQuery();
				subQuery
					.select(p('"project_module_employee"."organizationProjectModuleId"'))
					.from(p('project_module_employee'), p('project_module_employee'));

				// If user have permission to change employee
				if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
					if (isNotEmpty(members) && isNotEmpty(members['id'])) {
						const employeeId = members['id'];
						subQuery.andWhere(p('"project_module_employee"."employeeId" = :employeeId'), { employeeId });
					}
				} else {
					// If employee has login and don't have permission to change employee
					const employeeId = RequestContext.currentEmployeeId();
					if (isNotEmpty(employeeId)) {
						subQuery.andWhere(p('"project_module_employee"."employeeId" = :employeeId'), { employeeId });
					}
				}
				return (
					p('"organization_project_module_members"."organizationProjectModuleId" IN ') +
					subQuery.distinct(true).getQuery()
				);
			});
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
					qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
				})
			);
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					// Apply optional filters
					const filters: IOrganizationProjectModuleFindInput = {
						status: status as ProjectModuleStatusEnum,
						projectId: projectId as ID,
						name: name as string
					};

					// Apply optional filters
					this.applyOptionalFilters(query, qb, filters);
				})
			);

			console.log('Get Employees modules', query.getSql()); // Query logs for debugging

			// Execute the query with pagination
			return await this.executePaginationQuery<OrganizationProjectModule>(query);
		} catch (error) {
			// Error logging for debugging
			throw new HttpException(
				`Error while retrieving employee project modules: ${error.message}`,
				HttpStatus.BAD_REQUEST
			);
		}
	}

	/**
	 * @description Find Team's project modules
	 * @param options - Options finders and relations
	 * @returns - A promise that resolves after found project modules
	 * @memberof OrganizationProjectModuleService
	 */
	async findTeamProjectModules(
		options: BaseQueryDTO<OrganizationProjectModule>
	): Promise<IPagination<IOrganizationProjectModule>> {
		try {
			const { where } = options;
			const { name, status, teams = [], organizationId, projectId, members } = where;
			const tenantId = RequestContext.currentTenantId() || where.tenantId;

			// Create query builder
			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

			// Join teams
			query.leftJoin(`${query.alias}.teams`, 'teams');

			// Apply pagination and query options
			this.applyPaginationAndOptions(query, options);

			query.andWhere((qb: SelectQueryBuilder<OrganizationProjectModule>) => {
				const subQuery = qb.subQuery();
				subQuery
					.select(p('"project_module_team"."organizationProjectModuleId"'))
					.from(p('project_module_team'), p('project_module_team'));
				subQuery.leftJoin(
					'organization_team_employee',
					'organization_team_employee',
					p('"organization_team_employee"."organizationTeamId" = "project_module_team"."organizationTeamId"')
				);
				// If user have permission to change employee
				if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
					if (isNotEmpty(members) && isNotEmpty(members['id'])) {
						const employeeId = members['id'];
						subQuery.andWhere(p('"organization_team_employee"."employeeId" = :employeeId'), { employeeId });
					}
				} else {
					// If employee has login and don't have permission to change employee
					const employeeId = RequestContext.currentEmployeeId();
					if (isNotEmpty(employeeId)) {
						subQuery.andWhere(p('"organization_team_employee"."employeeId" = :employeeId'), { employeeId });
					}
				}
				if (isNotEmpty(teams)) {
					subQuery.andWhere(p(`"${subQuery.alias}"."organizationTeamId" IN (:...teams)`), { teams });
				}
				return (
					p(`"organization_project_module_members"."organizationProjectModuleId" IN `) +
					subQuery.distinct(true).getQuery()
				);
			});
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
					qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
				})
			);
			if (isNotEmpty(projectId) && isNotEmpty(teams)) {
				query.orWhere(p(`"${query.alias}"."projectId" = :projectId`), { projectId });
			}
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (isNotEmpty(projectId) && isEmpty(teams)) {
						qb.andWhere(p(`"${query.alias}"."projectId" = :projectId`), { projectId });
					}

					// Apply optional filters
					const filters: IOrganizationProjectModuleFindInput = {
						status: status as ProjectModuleStatusEnum,
						name: name as string
					};

					// Apply optional filters
					this.applyOptionalFilters(query, qb, filters);
				})
			);

			console.log('Get Team modules', query.getSql()); // Query logs for debugging

			// Execute the query with pagination
			return await this.executePaginationQuery<OrganizationProjectModule>(query);
		} catch (error) {
			// Error logging for debugging
			throw new HttpException(
				`Error while retrieving organization team project modules: ${error.message}`,
				HttpStatus.BAD_REQUEST
			);
		}
	}

	/**
	 * @description Find project modules by employee
	 * @param employeeId - The employee ID for whom to search project modules
	 * @param options - Finders options
	 * @returns A promise that resolves after found project modules
	 * @memberof OrganizationProjectModuleService
	 */
	async findByEmployee(
		employeeId: ID,
		options: IOrganizationProjectModuleFindInput
	): Promise<IPagination<IOrganizationProjectModule>> {
		try {
			const tenantId = RequestContext.currentTenantId() || options?.tenantId;
			const organizationId = options?.organizationId;

			// Create query builder
			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

			// Joins and where clauses
			query.innerJoin(`${query.alias}.members`, 'member');
			query.leftJoin(`${query.alias}.teams`, 'project_team');
			query.leftJoin(`${query.alias}."organizationSprints"`, 'sprint');

			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p('member.id = :employeeId'), { employeeId })
						.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId })
						.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });

					// Apply optional filters
					this.applyOptionalFilters(query, qb, options);
				})
			);

			// Execute the query with pagination
			return await this.executePaginationQuery<OrganizationProjectModule>(query);
		} catch (error) {
			// Error logging for debugging
			throw new HttpException(
				`Error while retrieving organization project modules by employee: ${error.message}`,
				HttpStatus.BAD_REQUEST
			);
		}
	}

	/**
	 * Updates an organization project module by managing its members and their roles.
	 *
	 * @param organizationProjectModuleId - ID of the organization project module
	 * @param organizationId - ID of the organization
	 * @param employees - Array of employees to be assigned to the project
	 * @param managerIds - Array of employee IDs to be assigned as managers
	 * @param memberIds - Array of employee IDs to be assigned as members
	 * @returns Promise<void>
	 */
	async updateOrganizationProjectModuleMembers(
		organizationProjectModuleId: ID,
		organizationId: ID,
		employees: IEmployee[],
		managerIds: ID[],
		memberIds: ID[]
	): Promise<void> {
		const tenantId = RequestContext.currentTenantId();
		const membersToUpdate = new Set([...managerIds, ...memberIds].filter(Boolean));

		// Find the manager role
		const managerRole = await this._roleService.findOneByWhereOptions({
			name: RolesEnum.MANAGER
		});

		// Fetch existing project members with their roles
		const projectMembers = await this.typeOrmOrganizationProjectModuleEmployeeRepository.find({
			where: { tenantId, organizationId, organizationProjectModuleId }
		});

		// Create a map of existing members for quick lookup
		const existingMemberMap = new Map(projectMembers.map((member) => [member.employeeId, member]));

		// Separate members into removed, updated, and new members
		const removedMembers = projectMembers.filter((member) => !membersToUpdate.has(member.employeeId));
		const updatedMembers = projectMembers.filter((member) => membersToUpdate.has(member.employeeId));
		const newMembers = employees.filter((employee) => !existingMemberMap.has(employee.id));

		// 1. Remove members who are no longer assigned to the project
		if (removedMembers.length) {
			await this.deleteMemberByIds(removedMembers.map((member) => member.id));
		}

		// 2. Update roles for existing members where necessary
		await Promise.all(
			updatedMembers.map(async (member) => {
				const isManager = managerIds.includes(member.employeeId);
				const newRole = isManager ? managerRole : null;

				// Only update if the role has changed
				if (newRole?.id !== member.roleId) {
					await this.typeOrmOrganizationProjectModuleEmployeeRepository.update(member.id, {
						role: newRole,
						isManager
					});
				}
			})
		);

		// 3. Add new members to the project
		if (newMembers.length) {
			const newProjectMembers = newMembers.map(
				(employee) =>
					new OrganizationProjectModuleEmployee({
						organizationProjectModuleId,
						employeeId: employee.id,
						tenantId,
						organizationId,
						isManager: managerIds.includes(employee.id),
						roleId: managerIds.includes(employee.id) ? managerRole.id : null
					})
			);

			await this.typeOrmOrganizationProjectModuleEmployeeRepository.save(newProjectMembers);
		}
	}

	/**
	 * Apply pagination and query options
	 *
	 * @param query - The query builder to apply pagination and options
	 * @param options - Pagination and query options
	 */
	private applyPaginationAndOptions(
		query: SelectQueryBuilder<OrganizationProjectModule>,
		params: BaseQueryDTO<OrganizationProjectModule>
	) {
		if (isNotEmpty(params)) {
			const options: FindManyOptions<OrganizationProjectModule> = {};

			if ('skip' in params) {
				options.skip = (params.take || 10) * (params.skip - 1);
				options.take = params.take || 10;
			}

			if (params.select) {
				options.select = params.select;
			}

			if (params.order) {
				options.order = params.order;
			}

			if (params.relations) {
				options.relations = params.relations;
			}

			// Apply pagination and query options
			query.setFindOptions(options);
		}
	}

	/**
	 * Apply optional filters to the query builder
	 */
	private applyOptionalFilters(
		query: SelectQueryBuilder<OrganizationProjectModule>,
		qb: WhereExpressionBuilder,
		options: IOrganizationProjectModuleFindInput
	) {
		const { projectId, status, name, organizationSprintId, organizationTeamId } = options;

		if (isNotEmpty(projectId)) {
			qb.andWhere(p(`"${query.alias}"."projectId" = :projectId`), { projectId });
		}

		if (isNotEmpty(status)) {
			qb.andWhere(p(`"${query.alias}"."status" = :status`), { status });
		}

		if (isNotEmpty(name)) {
			qb.andWhere(p(`"${query.alias}"."name" ${LIKE_OPERATOR} :name`), { name: `%${name}%` });
		}

		if (isNotEmpty(organizationSprintId)) {
			qb.andWhere('sprint.id = :organizationSprintId', { organizationSprintId });
		}

		if (isNotEmpty(organizationTeamId)) {
			qb.andWhere('project_team.id = :organizationTeamId', { organizationTeamId });
		}
	}

	/**
	 * Executes the given query with pagination and returns the results.
	 *
	 * @param query The query builder instance to execute.
	 * @returns A promise that resolves to an object containing the paginated items and total count.
	 */
	async executePaginationQuery<BaseType>(query: SelectQueryBuilder<BaseType>): Promise<IPagination<BaseType>> {
		const [items, total] = await query.getManyAndCount();
		return { items, total };
	}

	/**
	 * Delete project Module members by IDs.
	 *
	 * @param memberIds - Array of member IDs to delete
	 * @returns A promise that resolves when all deletions are complete
	 */
	async deleteMemberByIds(memberIds: ID[]): Promise<DeleteResult[]> {
		// Map member IDs to deletion promises
		const deletePromises = memberIds.map((memberId: ID) =>
			this.typeOrmOrganizationProjectModuleEmployeeRepository.delete(memberId)
		);

		// Wait for all deletions to complete
		return await Promise.all(deletePromises);
	}

	/**
	 * Add the current employee to managerIds if applicable.
	 *
	 * @param managerIds List of manager IDs.
	 * @param currentRoleId The current role ID of the user.
	 * @param employeeId The current employee ID.
	 */
	private async addCurrentEmployeeToManagers(managerIds: ID[], currentRoleId: ID, employeeId: ID): Promise<void> {
		try {
			const currentRole = await this._roleService.findOneByIdString(currentRoleId, {
				where: { name: RolesEnum.EMPLOYEE }
			});
			if (currentRole && !managerIds.includes(employeeId)) {
				managerIds.push(employeeId);
			}
		} catch {
			// Role is not "EMPLOYEE" or no action needed.
		}
	}

	/**
	 * Retrieve existing tasks from the database that match the provided list.
	 *
	 * @param tasks - Array of task objects to check.
	 * @returns A promise resolving to an array of existing tasks found in the database.
	 */
	private async getExistingTasks(tasks: ITask[]): Promise<ITask[]> {
		// Extract unique task IDs from the provided tasks
		const taskIds = [...new Set(tasks.map((task) => task.id))];

		// If no valid task IDs are present, return an empty array
		if (taskIds.length === 0) {
			return [];
		}

		// Fetch tasks from the database that match the extracted IDs, including their associated modules
		return this._taskService.find({
			where: { id: In(taskIds) },
			relations: ['modules']
		});
	}

	/**
	 * Constructs an array of OrganizationProjectModuleEmployee instances,
	 * marking specified employees as managers.
	 *
	 * @param employees - Array of employee entities.
	 * @param managerIds - Array of employee IDs designated as managers.
	 * @param organizationId - The ID of the organization.
	 * @param tenantId - The ID of the tenant.
	 * @returns Promise resolving to an array of OrganizationProjectModuleEmployee instances.
	 */
	private async buildModuleMembers(
		employees: IEmployee[],
		managerIds: ID[],
		organizationId: ID,
		tenantId: ID
	): Promise<OrganizationProjectModuleEmployee[]> {
		// Retrieve the manager role once to avoid redundant database calls
		const managerRole = await this._roleService.findOneByWhereOptions({ name: RolesEnum.MANAGER });

		// Convert managerIds array to a Set for efficient lookup
		const managerIdsSet = new Set(managerIds);

		// Map employees to OrganizationProjectModuleEmployee instances
		return employees.map(({ id: employeeId }) => {
			const isManager = managerIdsSet.has(employeeId);
			return new OrganizationProjectModuleEmployee({
				employeeId,
				organizationId,
				tenantId,
				isManager,
				assignedAt: new Date(),
				role: isManager ? managerRole : undefined // Assign role only if the employee is a manager
			});
		});
	}

	/**
	 * Assign tasks to the project module.
	 * @param tasks List of tasks to associate with the module.
	 * @param projectModule The project module to assign tasks to.
	 */
	private async assignTasksToModule(tasks: ITask[], projectModule: IOrganizationProjectModule): Promise<void> {
		const taskUpdates = tasks.map((task) => {
			task.modules = task.modules || []; // Ensure task has modules initialized
			task.modules.push(projectModule);

			// Only update the relevant fields instead of the entire task
			return this._taskService.update(task.id, { modules: task.modules });
		});

		// Await all updates concurrently
		await Promise.all(taskUpdates);
	}

	/**
	 * Log activity for a project module.
	 * @param projectModule The project module to log.
	 * @param organizationId The ID of the organization.
	 * @param tenantId The ID of the tenant.
	 */
	private logModuleActivity(
		action: ActionTypeEnum,
		updatedModule: IOrganizationProjectModule,
		existingModule?: IOrganizationProjectModule,
		changes?: Partial<IOrganizationProjectModuleUpdateInput>
	): void {
		const tenantId = RequestContext.currentTenantId() ?? updatedModule.tenantId;
		const organizationId = updatedModule.organizationId;

		this._activityLogService.logActivity<OrganizationProjectModule>(
			BaseEntityEnum.OrganizationProjectModule,
			action,
			ActorTypeEnum.User,
			updatedModule.id,
			updatedModule.name,
			updatedModule,
			organizationId,
			tenantId,
			existingModule,
			changes
		);
	}
}
