import {
	Injectable,
	BadRequestException,
	UnauthorizedException,
	ForbiddenException,
	NotFoundException
} from '@nestjs/common';
import { In, ILike, SelectQueryBuilder, DeleteResult, IsNull, FindManyOptions } from 'typeorm';
import {
	IOrganizationTeamCreateInput,
	IOrganizationTeam,
	RolesEnum,
	IPagination,
	IOrganizationTeamUpdateInput,
	PermissionsEnum,
	IBasePerTenantAndOrganizationEntityModel,
	IUser,
	IDateRangePicker,
	IOrganizationTeamEmployee,
	IOrganizationTeamStatisticInput,
	ITimerStatus
} from '@gauzy/contracts';
import { isNotEmpty, parseToBoolean } from '@gauzy/common';
import { Employee, OrganizationTeamEmployee } from '../core/entities/internal';
import { MultiORMEnum, enhanceWhereWithTenantId, parseTypeORMFindToMikroOrm } from '../core/utils';
import { PaginationParams, TenantAwareCrudService } from '../core/crud';
import { RequestContext } from '../core/context';
import { RoleService } from '../role/role.service';
import { UserService } from './../user/user.service';
import { OrganizationTeamEmployeeService } from '../organization-team-employee/organization-team-employee.service';
import { TaskService } from './../tasks/task.service';
import { prepareSQLQuery as p } from './../database/database.helper';
import { TypeOrmEmployeeRepository } from '../employee/repository';
import { EmployeeService } from './../employee/employee.service';
import { TimerService } from '../time-tracking/timer/timer.service';
import { StatisticService } from '../time-tracking/statistic';
import { GetOrganizationTeamStatisticQuery } from './queries';
import { MikroOrmOrganizationTeamRepository, TypeOrmOrganizationTeamRepository } from './repository';
import { OrganizationTeam } from './organization-team.entity';
import { MikroOrmOrganizationTeamEmployeeRepository } from '../organization-team-employee/repository/mikro-orm-organization-team-employee.repository';

@Injectable()
export class OrganizationTeamService extends TenantAwareCrudService<OrganizationTeam> {
	constructor(
		readonly typeOrmOrganizationTeamRepository: TypeOrmOrganizationTeamRepository,
		readonly mikroOrmOrganizationTeamRepository: MikroOrmOrganizationTeamRepository,
		readonly mikroOrmOrganizationTeamEmployeeRepository: MikroOrmOrganizationTeamEmployeeRepository,
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly statisticService: StatisticService,
		private readonly timerService: TimerService,
		private readonly roleService: RoleService,
		private readonly organizationTeamEmployeeService: OrganizationTeamEmployeeService,
		private readonly userService: UserService,
		private readonly employeeService: EmployeeService,
		private readonly taskService: TaskService
	) {
		super(typeOrmOrganizationTeamRepository, mikroOrmOrganizationTeamRepository);
	}

	/**
	 * Execute the GetOrganizationTeamStatisticQuery.
	 *
	 * @param input - The input query for getting organization team statistics.
	 * @returns The organization team with optional statistics.
	 */
	async getOrganizationTeamStatistic(input: GetOrganizationTeamStatisticQuery): Promise<IOrganizationTeam> {
		try {
			console.time('Get Organization Team ID Query');
			const { organizationTeamId, query } = input;
			const { withLastWorkedTask } = query;

			/**
			 * Find the organization team by ID with optional relations.
			 */
			const options = query['relations'] ? { relations: query['relations'] } : {};
			const organizationTeam = await this.findOneByIdString(organizationTeamId, options);

			/**
			 * If the organization team has 'members', sync last worked tasks based on the query.
			 */
			if ('members' in organizationTeam && withLastWorkedTask) {
				organizationTeam['members'] = await this.syncLastWorkedTask(
					organizationTeamId,
					organizationTeam['members'],
					query
				);
			}

			console.timeEnd('Get Organization Team ID Query');
			return organizationTeam;
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Synchronize last worked task information for members of an organization team.
	 *
	 * @param members - Array of organization team members.
	 * @param input - Input parameters including date range and statistics options.
	 * @returns A promise resolving to an array of organization team members with updated statistics.
	 */
	private async syncLastWorkedTask(
		organizationTeamId: IOrganizationTeam['id'],
		members: IOrganizationTeamEmployee[],
		input: IDateRangePicker & IOrganizationTeamStatisticInput
	): Promise<IOrganizationTeamEmployee[]> {
		try {
			const { organizationId, startDate, endDate, withLastWorkedTask, source } = input;
			const tenantId = RequestContext.currentTenantId() || input.tenantId;
			const employeeIds = members.map(({ employeeId }) => employeeId);

			// Retrieves timer statistics with optional task relation.
			const statistics = await this.timerService.getTimerWorkedStatus({
				source,
				employeeIds,
				organizationId,
				tenantId,
				organizationTeamId,
				...(parseToBoolean(withLastWorkedTask) ? { relations: ['task'] } : {})
			});

			//
			const memberPromises = members.map(async (member: IOrganizationTeamEmployee) => {
				const { employeeId } = member;
				//
				const timerWorkedStatus = statistics.find(
					(statistic: ITimerStatus) => statistic.lastLog.employeeId === employeeId
				);
				//
				const [totalWorkedTasks, totalTodayTasks] = await Promise.all([
					this.statisticService.getTasks({
						organizationId,
						tenantId,
						organizationTeamId,
						employeeIds: [employeeId]
					}),
					this.statisticService.getTasks({
						organizationId,
						tenantId,
						organizationTeamId,
						employeeIds: [employeeId],
						startDate,
						endDate
					})
				]);
				return {
					...member,
					lastWorkedTask: parseToBoolean(withLastWorkedTask) ? timerWorkedStatus?.lastLog?.task : null,
					running: timerWorkedStatus?.running,
					duration: timerWorkedStatus?.duration,
					timerStatus: timerWorkedStatus?.timerStatus,
					totalWorkedTasks,
					totalTodayTasks
				};
			});

			return await Promise.all(memberPromises);
		} catch (error) {
			console.error('Error while retrieving team members last worked task', error);
			return []; // or handle the error in an appropriate way
		}
	}

	/**
	 * Retrieves a collection of employees based on specified criteria.
	 * @param memberIds - Array of member IDs to include in the query.
	 * @param managerIds - Array of manager IDs to include in the query.
	 * @param organizationId - The organization ID for filtering.
	 * @param tenantId - The tenant ID for filtering.
	 * @returns A Promise resolving to an array of Employee entities with associated user information.
	 */
	async retrieveEmployees(
		memberIds: string[],
		managerIds: string[],
		organizationId: string,
		tenantId: string
	): Promise<Employee[]> {
		try {
			// Filter out falsy values (e.g., null or undefined) from the union of memberIds and managerIds
			const filteredIds = [...memberIds, ...managerIds].filter(Boolean);

			// Retrieve employees based on specified criteria
			const employees = await this.typeOrmEmployeeRepository.findBy({
				id: In(filteredIds), // Filtering by employee IDs (union of memberIds and managerIds)
				organizationId, // Filtering by organizationId
				tenantId // Filtering by tenantId
			});

			return employees;
		} catch (error) {
			// Handle any potential errors during the retrieval process
			throw new Error(`Failed to retrieve employees: ${error}`);
		}
	}

	/**
	 * Creates an organization team based on the provided input.
	 * @param input - Input data for creating the organization team.
	 * @returns A Promise resolving to the created organization team.
	 * @throws BadRequestException if there is an error in the creation process.
	 */
	async create(input: IOrganizationTeamCreateInput): Promise<IOrganizationTeam> {
		const { tags = [], memberIds = [], managerIds = [], projects = [] } = input;
		const { name, organizationId, prefix, profile_link, logo, imageId } = input;

		try {
			const tenantId = RequestContext.currentTenantId();
			const employeeId = RequestContext.currentEmployeeId();
			const currentRoleId = RequestContext.currentRoleId();

			// If, employee create teams, default add as a manager
			try {
				// Check if the current role is EMPLOYEE
				await this.roleService.findOneByIdString(currentRoleId, {
					where: { name: RolesEnum.EMPLOYEE }
				});
				// Check if the employeeId is not already included in the managerIds array
				if (!managerIds.includes(employeeId)) {
					// If not included, add the employeeId to the managerIds array
					managerIds.push(employeeId);
				}
			} catch (error) { }

			// Retrieves a collection of employees based on specified criteria.
			const employees = await this.retrieveEmployees(
				memberIds,
				managerIds,
				organizationId,
				tenantId
			);

			// Find the manager role
			const managerRole = await this.roleService.findOneByWhereOptions({ name: RolesEnum.MANAGER });

			// Create a Set for faster membership checks
			const managerIdsSet = new Set(managerIds);

			// Use destructuring to directly extract 'id' from 'employee'
			const members = employees.map(({ id: employeeId }) => new OrganizationTeamEmployee({
				employee: { id: employeeId },
				organization: { id: organizationId },
				tenant: { id: tenantId },
				role: managerIdsSet.has(employeeId) ? managerRole : null
			}));

			// Create the organization team with the prepared members
			return await super.create({
				organization: { id: organizationId },
				tenant: { id: tenantId },
				tags, name, prefix, members, profile_link, public: input.public, logo, imageId, projects
			});
		} catch (error) {
			throw new BadRequestException(`Failed to create a team: ${error}`);
		}
	}

	/**
	 * Update an organization team.
	 *
	 * @param id - The ID of the organization team to be updated.
	 * @param input - The updated information for the organization team.
	 * @returns A Promise resolving to the updated organization team.
	 * @throws ForbiddenException if the user lacks permission or if certain conditions are not met.
	 * @throws BadRequestException if there's an error during the update process.
	 */
	async update(id: IOrganizationTeam['id'], input: IOrganizationTeamUpdateInput): Promise<IOrganizationTeam> {
		const tenantId = RequestContext.currentTenantId() || input.tenantId;
		const { managerIds, memberIds, organizationId } = input;

		let organizationTeam = await super.findOneByIdString(id, {
			where: { organizationId, tenantId }
		});

		// Check permission for CHANGE_SELECTED_EMPLOYEE
		if (!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			try {
				const employeeId = RequestContext.currentEmployeeId();
				// If employee ID is present, restrict update to manager role
				if (employeeId) {
					organizationTeam = await super.findOneByIdString(id, {
						where: {
							organizationId,
							tenantId,
							members: {
								employeeId,
								tenantId,
								organizationId,
								role: { name: RolesEnum.MANAGER }
							}
						}
					});
				}
			} catch (error) {
				throw new ForbiddenException();
			}
		}

		try {
			if (isNotEmpty(memberIds) || isNotEmpty(managerIds)) {
				// Find the manager role
				const role = await this.roleService.findOneByWhereOptions({
					name: RolesEnum.MANAGER
				});

				// Retrieves a collection of employees based on specified criteria.
				const employees = await this.retrieveEmployees(
					memberIds,
					managerIds,
					organizationId,
					tenantId
				);

				// Update nested entity
				await this.organizationTeamEmployeeService.updateOrganizationTeam(
					id,
					organizationId,
					employees,
					role,
					managerIds,
					memberIds
				);
			}

			const { id: organizationTeamId } = organizationTeam;

			// Update the organization team with the prepared members
			return await super.create({
				...input,
				organizationId,
				tenantId,
				id: organizationTeamId
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Find teams associated with the current user.
	 *
	 * @param options - Pagination options.
	 * @returns A Promise resolving to the paginated list of teams.
	 * @throws UnauthorizedException if an unauthorized user attempts to access this information.
	 */
	public async findMyTeams(options: PaginationParams<OrganizationTeam>): Promise<IPagination<OrganizationTeam>> {
		try {
			return await this.findAll(options);
		} catch (error) {
			throw new UnauthorizedException(`Failed to find user's teams: ${error.message}`);
		}
	}

	/**
	 * GET organization teams pagination by params
	 *
	 * @param filter
	 * @returns
	 */
	public async pagination(options?: PaginationParams<OrganizationTeam>): Promise<IPagination<OrganizationTeam>> {
		if ('where' in options) {
			const { where } = options;
			if ('name' in where) {
				options['where']['name'] = ILike(`%${where.name}%`);
			}
			if ('tags' in where) {
				options['where']['tags'] = {
					id: In(where.tags as [])
				};
			}
		}
		return await this.findAll(options);
	}

	/**
	 * Retrieves a paginated list of organization teams based on specified options.
	 * @param options - Pagination and filtering options.
	 * @returns A Promise resolving to an object containing paginated organization teams.
	 */
	public async findAll(options?: PaginationParams<OrganizationTeam>): Promise<IPagination<IOrganizationTeam>> {
		// Retrieve tenantId from RequestContext or options
		const tenantId = RequestContext.currentTenantId() || options?.where?.tenantId;

		// Initialize variables to store the retrieved items and total count.
		let items: OrganizationTeam[]; // Array to store retrieved items
		let total: number; // Variable to store total count of items

		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				/**
				 * Fetches distinct organization team IDs for a given employee.
				 * Filters based on employee ID, tenant ID, and optionally organization ID.
				 *
				 * @param employeeId - The ID of the employee to filter the teams by.
				 * @returns A Promise that resolves to an array of unique organization team IDs.
				 */
				const fetchDistinctOrgTeamIdsForEmployee = async (employeeId: string): Promise<string[]> => {
					const knex = this.mikroOrmOrganizationTeamEmployeeRepository.getKnex();

					// Construct your SQL query using knex
					let sqlQuery = knex('organization_team_employee').select(
						knex.raw(`
							DISTINCT ON ("organization_team_employee"."organizationTeamId")
							"organization_team_employee"."organizationTeamId"
						`)
					);

					// Builds an SQL query with specific where clauses.
					sqlQuery.andWhere({ tenantId });
					sqlQuery.andWhere({ employeeId });
					sqlQuery.andWhere({ isActive: true });
					sqlQuery.andWhere({ isArchived: false });

					// Apply the organization filter if available
					if (options?.where?.organizationId) {
						const { organizationId } = options.where;
						sqlQuery.andWhere({ organizationId });
					}

					// Execute the raw SQL query and get the results
					const rawResults: OrganizationTeamEmployee[] = (await knex.raw(sqlQuery.toString())).rows || [];
					const organizationTeamIds = rawResults.map((entry: OrganizationTeamEmployee) => entry.organizationTeamId);

					// Convert to string for the subquery
					return organizationTeamIds || [];
				};

				// If admin has login and doesn't have permission to change employee
				if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
					const members = options?.where?.members;
					if ('members' in options?.where) {
						delete options.where['members'];
					}
					if (isNotEmpty(members) && isNotEmpty(members['employeeId'])) {
						const employeeId = members['employeeId'];
						// Fetches distinct organization team IDs for a given employee.
						const organizationTeamIds = await fetchDistinctOrgTeamIdsForEmployee(employeeId);
						options.where.id = In(organizationTeamIds);
					}
				} else {
					// If employee has login and doesn't have permission to change employee
					const employeeId = RequestContext.currentEmployeeId();
					// Fetches distinct organization team IDs for a given employee.
					const organizationTeamIds = await fetchDistinctOrgTeamIdsForEmployee(employeeId);
					options.where.id = In(organizationTeamIds);
				}

				// Converts TypeORM find options to a format compatible with MikroORM for a given entity.
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<OrganizationTeam>(options as FindManyOptions);
				// Retrieve the items and total count
				const [entities, totalEntities] = await this.mikroOrmOrganizationTeamRepository.findAndCount(
					enhanceWhereWithTenantId(tenantId, where), // Add a condition for the tenant ID
					mikroOptions
				);

				// Optionally serialize the items
				items = entities.map((item: OrganizationTeam) => this.serialize(item)) as OrganizationTeam[];
				total = totalEntities;
				break;
			case MultiORMEnum.TypeORM:
				// Create a query builder for the OrganizationTeam entity
				const typeOrmQueryBuilder = this.typeOrmRepository.createQueryBuilder(this.tableName);

				/**
				 * Generates a subquery for selecting organization team IDs based on specified conditions.
				 * @param cb - The SelectQueryBuilder instance for constructing the subquery.
				 * @param employeeId - The employee ID for filtering the teams.
				 * @returns A SQL condition string to be used in the main query's WHERE clause.
				 */
				const subQueryBuilder = (cb: SelectQueryBuilder<OrganizationTeam>, employeeId: string) => {
					const subQuery = cb.subQuery().select(p('"team"."organizationTeamId"'));
					subQuery.from('organization_team_employee', 'team');

					// Apply the tenant filter
					subQuery.andWhere(p(`"${subQuery.alias}"."tenantId" = :tenantId`), { tenantId });

					// Apply the organization filter if available
					if (options?.where?.organizationId) {
						const { organizationId } = options.where;
						subQuery.andWhere(p(`"${subQuery.alias}"."organizationId" = :organizationId`), { organizationId });
					}

					// Additional conditions
					subQuery.andWhere(p(`"${subQuery.alias}"."isActive" = :isActive`), { isActive: true });
					subQuery.andWhere(p(`"${subQuery.alias}"."isArchived" = :isArchived`), { isArchived: false });
					subQuery.andWhere(p(`"${subQuery.alias}"."employeeId" = :employeeId`), { employeeId });

					return p(`"organization_team"."id" IN ${subQuery.distinct(true).getQuery()}`);
				};

				// If admin has login and doesn't have permission to change employee
				if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
					const members = options?.where?.members;
					if ('members' in options?.where) {
						delete options.where['members'];
					}

					if (isNotEmpty(members) && isNotEmpty(members['employeeId'])) {
						const employeeId = members['employeeId'];
						// Sub query to get only employee assigned teams
						typeOrmQueryBuilder.andWhere((cb: SelectQueryBuilder<OrganizationTeam>) => subQueryBuilder(cb, employeeId));
					}
				} else {
					// If employee has login and doesn't have permission to change employee
					const employeeId = RequestContext.currentEmployeeId();
					// Sub query to get only employee assigned teams
					typeOrmQueryBuilder.andWhere((cb: SelectQueryBuilder<OrganizationTeam>) => subQueryBuilder(cb, employeeId));
				}

				// Set query options
				if (isNotEmpty(options)) {
					typeOrmQueryBuilder.setFindOptions({
						...(options.skip ? { skip: options.take * (options.skip - 1) } : {}),
						...(options.take ? { take: options.take } : {}),
						...(options.select ? { select: options.select } : {}),
						...(options.relations ? { relations: options.relations } : {}),
						...(options.where ? { where: options.where } : {}),
						...(options.order ? { order: options.order } : {})
					});
				}

				// Apply the tenant filter
				typeOrmQueryBuilder.andWhere(p(`"${typeOrmQueryBuilder.alias}"."tenantId" = :tenantId`), { tenantId });

				// Retrieve the items and total count
				[items, total] = await typeOrmQueryBuilder.getManyAndCount();
				// Return paginated result
				return { items, total };
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}

		return { items, total };
	}

	/**
	 * Delete an organization team.
	 *
	 * @param teamId - The ID of the organization team to be deleted.
	 * @param options - Additional options for the deletion, such as organizationId.
	 * @returns A Promise resolving to the result of the deletion operation.
	 * @throws ForbiddenException if the current context lacks the necessary permission.
	 */
	async deleteTeam(
		teamId: IOrganizationTeam['id'],
		options: IBasePerTenantAndOrganizationEntityModel
	): Promise<DeleteResult | IOrganizationTeam> {
		try {
			const { organizationId } = options;
			const tenantId = RequestContext.currentTenantId() || options.tenantId;

			const team = await this.findOneByIdString(teamId, {
				where: {
					tenantId,
					organizationId,
					...(!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
						? {
							members: {
								employeeId: RequestContext.currentEmployeeId(),
								role: {
									name: RolesEnum.MANAGER
								}
							}
						}
						: {})
				}
			});

			// Check if the team was found before attempting deletion
			if (team) {
				return await this.typeOrmRepository.remove(team);
			} else {
				// You might want to handle the case where the team was not found differently
				throw new NotFoundException(`Organization team with ID ${teamId} not found.`);
			}
		} catch (error) {
			throw new ForbiddenException();
		}
	}

	/**
	 * Checks if a user is a member of any teams and performs necessary actions.
	 *
	 * @param userId - The ID of the user to check.
	 * @returns A Promise resolving to the result of the operation.
	 * @throws ForbiddenException if the current context lacks the necessary permission or if the user is not found or not associated with an employee.
	 */
	public async existTeamsAsMember(userId: IUser['id']): Promise<DeleteResult> {
		const currentUserId = RequestContext.currentUserId();

		// If user don't have enough permission (CHANGE_SELECTED_EMPLOYEE).
		if (!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			// If user try to delete someone other user account, just denied the request.
			if (currentUserId != userId) {
				throw new ForbiddenException('You can not removed account for other members!');
			}
		}

		const user = await this.userService.findOneByIdString(userId);

		if (!user) {
			throw new ForbiddenException('User not found!');
		}

		const employee = await this.employeeService.findOneByOptions({
			where: {
				userId: user.id
			}
		});

		if (!employee) {
			throw new ForbiddenException('User is not associated with an employee!');
		}

		try {
			// Check if the user is only a manager (has no specific role)
			await this.organizationTeamEmployeeService.findOneByOptions({
				where: {
					employeeId: employee.id,
					roleId: IsNull()
				}
			});

			// Unassign this user from all tasks in a team
			await this.taskService.unassignEmployeeFromTeamTasks(employee.id, undefined);

			// Delete the team employee record
			return await this.organizationTeamEmployeeService.delete({
				employeeId: employee.id,
				roleId: IsNull()
			});
		} catch (error) {
			throw new ForbiddenException('You are not able to removed account where you are only the manager!');
		}
	}
}
