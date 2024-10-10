import { Injectable, BadRequestException, HttpStatus, HttpException } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import {
	IsNull,
	SelectQueryBuilder,
	Brackets,
	WhereExpressionBuilder,
	Raw,
	In,
	FindOptionsWhere,
	FindManyOptions,
	Between
} from 'typeorm';
import { isBoolean, isUUID } from 'class-validator';
import {
	ActionTypeEnum,
	ActivityLogEntityEnum,
	ActorTypeEnum,
	ID,
	IEmployee,
	IGetTaskOptions,
	IGetTasksByViewFilters,
	IPagination,
	ITask,
	ITaskUpdateInput,
	PermissionsEnum
} from '@gauzy/contracts';
import { isEmpty, isNotEmpty } from '@gauzy/common';
import { isPostgres, isSqlite } from '@gauzy/config';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { ActivityLogEvent } from '../activity-log/events';
import { activityLogUpdatedFieldsAndValues, generateActivityLogDescription } from '../activity-log/activity-log.helper';
import { Task } from './task.entity';
import { TypeOrmOrganizationSprintTaskHistoryRepository } from './../organization-sprint/repository/type-orm-organization-sprint-task-history.repository';
import { TypeOrmTaskViewRepository } from './views/repository/type-orm-task-view.repository';
import { GetTaskByIdDTO } from './dto';
import { prepareSQLQuery as p } from './../database/database.helper';
import { TypeOrmTaskRepository } from './repository/type-orm-task.repository';
import { MikroOrmTaskRepository } from './repository/mikro-orm-task.repository';

@Injectable()
export class TaskService extends TenantAwareCrudService<Task> {
	constructor(
		readonly typeOrmTaskRepository: TypeOrmTaskRepository,
		readonly mikroOrmTaskRepository: MikroOrmTaskRepository,
		readonly typeOrmOrganizationSprintTaskHistoryRepository: TypeOrmOrganizationSprintTaskHistoryRepository,
		readonly typeOrmTaskViewRepository: TypeOrmTaskViewRepository,
		private readonly _eventBus: EventBus
	) {
		super(typeOrmTaskRepository, mikroOrmTaskRepository);
	}

	/**
	 * Update task, if already exist
	 *
	 * @param id - The ID of the task to update
	 * @param input - The data to update the task with
	 * @returns The updated task
	 */
	async update(id: ID, input: Partial<ITaskUpdateInput>): Promise<ITask> {
		try {
			const tenantId = RequestContext.currentTenantId() || input.tenantId;
			const userId = RequestContext.currentUserId();
			const { organizationSprintId } = input;
			const task = await this.findOneByIdString(id);

			if (input.projectId && input.projectId !== task.projectId) {
				const { organizationId, projectId } = task;

				// Get the maximum task number for the project
				const maxNumber = await this.getMaxTaskNumberByProject({
					tenantId,
					organizationId,
					projectId
				});

				// Update the task with the new project and task number
				await super.update(id, {
					projectId,
					number: maxNumber + 1
				});
			}

			// Update the task with the provided data
			const updatedTask = await super.create({
				...input,
				id
			});

			// Register Task Sprint moving history
			if (organizationSprintId && organizationSprintId !== task.organizationSprintId) {
				await this.typeOrmOrganizationSprintTaskHistoryRepository.save({
					fromSprintId: task.organizationSprintId,
					toSprintId: organizationSprintId,
					taskId: updatedTask.id,
					movedById: userId,
					reason: input.taskSprintMoveReason,
					organizationId: input.organizationId,
					tenantId
				});
			}

			// Generate the activity log description
			const description = generateActivityLogDescription(
				ActionTypeEnum.Updated,
				ActivityLogEntityEnum.Task,
				updatedTask.title
			);

			const { updatedFields, previousValues, updatedValues } = activityLogUpdatedFieldsAndValues(
				updatedTask,
				input
			);

			// Emit an event to log the activity
			this._eventBus.publish(
				new ActivityLogEvent({
					entity: ActivityLogEntityEnum.Task,
					entityId: updatedTask.id,
					action: ActionTypeEnum.Updated,
					actorType: ActorTypeEnum.User, // TODO : Since we have Github Integration, make sure we can also store "System" for actor
					description,
					updatedFields,
					updatedValues,
					previousValues,
					data: updatedTask,
					organizationId: updatedTask.organizationId,
					tenantId
				})
			);

			return updatedTask;
		} catch (error) {
			console.error(`Error while updating task: ${error.message}`, error.message);
			throw new HttpException({ message: error?.message, error }, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Retrieves a task by its ID and includes optional related data.
	 *
	 * @param id The unique identifier of the task.
	 * @param params Additional parameters for fetching task details, including related entities.
	 * @returns A Promise that resolves to the task entity.
	 */
	async findById(id: ID, params: GetTaskByIdDTO): Promise<ITask> {
		const task = await this.findOneByIdString(id, params);

		// Include the root epic if requested
		if (params.includeRootEpic && task) {
			task.rootEpic = await this.findParentUntilEpic(task.id);
		}

		return task;
	}

	/**
	 * Recursively searches for the parent epic of a given task (issue) using a SQL recursive query.
	 *
	 * @param issueId The ID of the task (issue) to start the search from.
	 * @returns A Promise that resolves to the epic task if found, otherwise null.
	 */
	async findParentUntilEpic(issueId: ID): Promise<Task | null> {
		// Define the recursive SQL query to find the parent epic
		const query = p(`
			WITH RECURSIVE IssueHierarchy AS (
				SELECT *
				FROM task
				WHERE id = $1
			UNION ALL
				SELECT i.*
				FROM task i
				INNER JOIN IssueHierarchy ih ON i.id = ih."parentId"
			)
			SELECT *
			FROM IssueHierarchy
			WHERE "issueType" = 'Epic'
			LIMIT 1;
		`);

		// Execute the raw SQL query with the issueId parameter
		const result = await this.typeOrmRepository.query(query, [issueId]);

		// Return the first epic task found or null if no epic is found
		return result.length > 0 ? result[0] : null;
	}

	/**
	 * GET my tasks
	 *
	 * @param options
	 * @returns
	 */
	async getMyTasks(options: PaginationParams<Task>) {
		return await this.getEmployeeTasks(options);
	}

	/**
	 * Find employee tasks
	 *
	 * @param options
	 * @returns
	 */
	async getEmployeeTasks(options: PaginationParams<Task>) {
		try {
			const { where } = options;
			const { status, title, prefix, isDraft, organizationSprintId = null } = where;
			const { organizationId, projectId, members } = where;
			const likeOperator = isPostgres() ? 'ILIKE' : 'LIKE';

			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
			query.innerJoin(`${query.alias}.members`, 'members');
			/**
			 * If find options
			 */
			if (isNotEmpty(options)) {
				if ('skip' in options) {
					query.setFindOptions({
						skip: (options.take || 10) * (options.skip - 1),
						take: options.take || 10
					});
				}
				query.setFindOptions({
					...(options.relations ? { relations: options.relations } : {})
				});
			}
			query.andWhere((qb: SelectQueryBuilder<Task>) => {
				const subQuery = qb.subQuery();
				subQuery.select(p('"task_employee"."taskId"')).from(p('task_employee'), p('task_employee'));

				// If user have permission to change employee
				if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
					if (isNotEmpty(members) && isNotEmpty(members['id'])) {
						const employeeId = members['id'];
						subQuery.andWhere(p('"task_employee"."employeeId" = :employeeId'), { employeeId });
					}
				} else {
					// If employee has login and don't have permission to change employee
					const employeeId = RequestContext.currentEmployeeId();
					if (isNotEmpty(employeeId)) {
						subQuery.andWhere(p('"task_employee"."employeeId" = :employeeId'), { employeeId });
					}
				}
				return p('"task_members"."taskId" IN ') + subQuery.distinct(true).getQuery();
			});
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					const tenantId = RequestContext.currentTenantId();
					qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
					qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
				})
			);
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (isNotEmpty(projectId)) {
						qb.andWhere(p(`"${query.alias}"."projectId" = :projectId`), { projectId });
					}
					if (isNotEmpty(status)) {
						qb.andWhere(p(`"${query.alias}"."status" = :status`), {
							status
						});
					}
					if (isNotEmpty(isDraft)) {
						qb.andWhere(p(`"${query.alias}"."isDraft" = :isDraft`), {
							isDraft
						});
					}
					if (isNotEmpty(title)) {
						qb.andWhere(p(`"${query.alias}"."title" ${likeOperator} :title`), {
							title: `%${title}%`
						});
					}
					if (isNotEmpty(title)) {
						qb.andWhere(p(`"${query.alias}"."prefix" ${likeOperator} :prefix`), {
							prefix: `%${prefix}%`
						});
					}
					if (isNotEmpty(organizationSprintId) && !isUUID(organizationSprintId)) {
						qb.andWhere(p(`"${query.alias}"."organizationSprintId" IS NULL`));
					}
				})
			);

			console.log('query.getSql', query.getSql());
			const [items, total] = await query.getManyAndCount();
			return { items, total };
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error);
		}
	}

	/**
	 * GET all tasks by employee
	 *
	 * @param employeeId
	 * @param filter
	 * @returns
	 */
	async getAllTasksByEmployee(employeeId: IEmployee['id'], options: PaginationParams<Task>) {
		try {
			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
			query.leftJoin(`${query.alias}.members`, 'members');
			query.leftJoin(`${query.alias}.teams`, 'teams');
			/**
			 * If additional options found
			 */
			query.setFindOptions({
				...(isNotEmpty(options) &&
					isNotEmpty(options.where) && {
						where: options.where
					}),
				...(isNotEmpty(options) &&
					isNotEmpty(options.relations) && {
						relations: options.relations
					})
			});
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					const tenantId = RequestContext.currentTenantId();
					qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), {
						tenantId
					});
				})
			);
			query.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					web.andWhere((qb: SelectQueryBuilder<Task>) => {
						const subQuery = qb.subQuery();
						subQuery.select(p('"task_employee"."taskId"')).from(p('task_employee'), p('task_employee'));
						subQuery.andWhere(p('"task_employee"."employeeId" = :employeeId'), { employeeId });
						return p(`"task_members"."taskId" IN (${subQuery.distinct(true).getQuery()})`);
					});
					web.orWhere((qb: SelectQueryBuilder<Task>) => {
						const subQuery = qb.subQuery();
						subQuery.select(p('"task_team"."taskId"')).from(p('task_team'), p('task_team'));
						subQuery.leftJoin(
							'organization_team_employee',
							'organization_team_employee',
							p('"organization_team_employee"."organizationTeamId" = "task_team"."organizationTeamId"')
						);
						subQuery.andWhere(p('"organization_team_employee"."employeeId" = :employeeId'), { employeeId });
						return p(`"task_teams"."taskId" IN (${subQuery.distinct(true).getQuery()})`);
					});
				})
			);
			return await query.getMany();
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * GET team tasks
	 *
	 * @param options
	 * @returns
	 */
	async findTeamTasks(options: PaginationParams<Task>): Promise<IPagination<ITask>> {
		try {
			const { where } = options;

			const { status, teams = [], title, prefix, isDraft, organizationSprintId = null } = where;
			const { organizationId, projectId, members } = where;
			const likeOperator = isPostgres() ? 'ILIKE' : 'LIKE';

			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
			query.leftJoin(`${query.alias}.teams`, 'teams');

			/**
			 * If find options
			 */
			if (isNotEmpty(options)) {
				if ('skip' in options) {
					query.setFindOptions({
						skip: (options.take || 10) * (options.skip - 1),
						take: options.take || 10
					});
				}
				query.setFindOptions({
					...(options.select ? { select: options.select } : {}),
					...(options.relations ? { relations: options.relations } : {}),
					...(options.order ? { order: options.order } : {})
				});
			}
			query.andWhere((qb: SelectQueryBuilder<Task>) => {
				const subQuery = qb.subQuery();
				subQuery.select(p('"task_team"."taskId"')).from(p('task_team'), p('task_team'));
				subQuery.leftJoin(
					'organization_team_employee',
					'organization_team_employee',
					p('"organization_team_employee"."organizationTeamId" = "task_team"."organizationTeamId"')
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
					subQuery.andWhere(p(`"${subQuery.alias}"."organizationTeamId" IN (:...teams)`), {
						teams
					});
				}
				return p(`"task_teams"."taskId" IN `) + subQuery.distinct(true).getQuery();
			});
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					const tenantId = RequestContext.currentTenantId();
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
					if (isNotEmpty(status)) {
						qb.andWhere(p(`"${query.alias}"."status" = :status`), {
							status
						});
					}
					if (isNotEmpty(isDraft)) {
						qb.andWhere(p(`"${query.alias}"."isDraft" = :isDraft`), {
							isDraft
						});
					}
					if (isNotEmpty(title)) {
						qb.andWhere(p(`"${query.alias}"."title" ${likeOperator} :title`), {
							title: `%${title}%`
						});
					}
					if (isNotEmpty(title)) {
						qb.andWhere(p(`"${query.alias}"."prefix" ${likeOperator} :prefix`), {
							prefix: `%${prefix}%`
						});
					}
					if (isNotEmpty(organizationSprintId) && !isUUID(organizationSprintId)) {
						qb.andWhere(p(`"${query.alias}"."organizationSprintId" IS NULL`));
					}
				})
			);
			const [items, total] = await query.getManyAndCount();
			return { items, total };
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * GET tasks by pagination with filtering options.
	 *
	 * @param options The pagination and filtering parameters.
	 * @returns A Promise that resolves to a paginated list of tasks.
	 */
	public async pagination(options: PaginationParams<Task>): Promise<IPagination<ITask>> {
		// Define the like operator based on the database type
		const likeOperator = isPostgres() ? 'ILIKE' : 'LIKE';

		// Check if there are any filters in the options
		if (options?.where) {
			const { where } = options;

			// Apply filters for task title with like operator
			if (where.title) {
				options.where.title = Raw((alias) => `${alias} ${likeOperator} '%${where.title}%'`);
			}

			// Apply filters for task prefix with like operator
			if (where.prefix) {
				options.where.prefix = Raw((alias) => `${alias} ${likeOperator} '%${where.prefix}%'`);
			}

			// Apply filters for isDraft, setting null if not a boolean
			if (where.isDraft !== undefined && !isBoolean(where.isDraft)) {
				options.where.isDraft = IsNull();
			}

			// Apply filters for organizationSprintId, setting null if not a valid UUID
			if (where.organizationSprintId && !isUUID(where.organizationSprintId)) {
				options.where.organizationSprintId = IsNull();
			}

			// Apply filters for teams, ensuring it uses In for array comparison
			if (where.teams) {
				options.where.teams = {
					id: In(where.teams as string[])
				};
			}
		}

		// Call the base paginate method
		return await super.paginate(options);
	}

	/**
	 * GET maximum task number by project filter
	 *
	 * @param options The filtering options including tenant, organization, and project details.
	 * @returns A Promise that resolves to the maximum task number for the given project.
	 */
	public async getMaxTaskNumberByProject(options: IGetTaskOptions): Promise<number> {
		try {
			// Extract tenantId from context or options
			const tenantId = RequestContext.currentTenantId() || options.tenantId;
			const { organizationId, projectId } = options;

			// Create a query builder for the Task entity
			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

			// Build the query to get the maximum task number
			query.select(p(`COALESCE(MAX("${query.alias}"."number"), 0)`), 'maxTaskNumber');

			// Apply filters for organization and tenant
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
					qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
				})
			);

			// Apply project filter if provided, otherwise check for null
			if (isNotEmpty(projectId)) {
				query.andWhere(p(`"${query.alias}"."projectId" = :projectId`), { projectId });
			} else {
				query.andWhere(p(`"${query.alias}"."projectId" IS NULL`));
			}

			// Execute the query and parse the result to a number
			const result = await query.getRawOne();
			const maxTaskNumber = parseInt(result.maxTaskNumber, 10);
			console.log('get max task number', maxTaskNumber);

			return maxTaskNumber;
		} catch (error) {
			// Log the error and throw a detailed exception
			console.log(`Error fetching max task number: ${error.message}`, error.stack);
			throw new HttpException({ message: 'Failed to get the max task number', error }, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Unassign employee from team task
	 * @param employeeId
	 * @param organizationTeamId
	 */
	public async unassignEmployeeFromTeamTasks(employeeId: string, organizationTeamId?: string) {
		try {
			const tenantId = RequestContext.currentTenantId();

			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
			query.leftJoinAndSelect(`${query.alias}.members`, 'members');

			if (organizationTeamId) {
				query.leftJoinAndSelect(`${query.alias}.teams`, 'teams', 'teams.id = :organizationTeamId', {
					organizationTeamId
				});
			} else {
				query.leftJoinAndSelect(`${query.alias}.teams`, 'teams');
			}

			query.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });

			query.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					web.andWhere((qb: SelectQueryBuilder<Task>) => {
						const subQuery = qb.subQuery();
						subQuery.select(p('"task_employee"."taskId"')).from(p('task_employee'), p('task_employee'));
						subQuery.andWhere(p('"task_employee"."employeeId" = :employeeId'), { employeeId });

						return p('"task_members"."taskId" IN ') + subQuery.distinct(true).getQuery();
					});
					web.orWhere((qb: SelectQueryBuilder<Task>) => {
						const subQuery = qb.subQuery();
						subQuery.select(p('"task_team"."taskId"')).from(p('task_team'), p('task_team'));
						subQuery.leftJoin(
							'organization_team_employee',
							'ote',
							p('"ote"."organizationTeamId" = "task_team"."organizationTeamId"')
						);
						subQuery.andWhere(p('"ote"."employeeId" = :employeeId'), { employeeId });
						subQuery.andWhere(p(`"ote"."tenantId" = :tenantId`), { tenantId });

						return p('"task_teams"."taskId" IN ') + subQuery.distinct(true).getQuery();
					});
				})
			);

			// If unassigned for specific team
			if (organizationTeamId) {
				query.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						web.andWhere((qb: SelectQueryBuilder<Task>) => {
							const subQuery = qb.subQuery();
							subQuery.select(p('"task_team"."taskId"')).from(p('task_team'), p('task_team'));
							subQuery.andWhere(p('"task_teams"."organizationTeamId" = :organizationTeamId'), {
								organizationTeamId
							});
							subQuery.andWhere(p('"task_teams"."tenantId" = :tenantId'), { tenantId });
							return p('"task_teams"."taskId" IN ') + subQuery.distinct(true).getQuery();
						});
					})
				);
			}

			// Find all assigned tasks of employee
			const tasks = await query.getMany();

			// Unassign member from All the Team Tasks
			tasks.forEach((task) => {
				if (task.teams.length) {
					task.members = task.members.filter((member) => member.id !== employeeId);
				}
			});

			// Save updated entities to DB
			await this.typeOrmRepository.save(tasks);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Retrieves module tasks based on the provided options.
	 *
	 * @param {PaginationParams<Task>} options - The pagination options and filters for querying tasks.
	 * @returns {Promise<IPagination<ITask>>} A promise that resolves with pagination task items and total count.
	 */
	async findModuleTasks(options: PaginationParams<Task>): Promise<IPagination<ITask>> {
		try {
			const { where } = options;
			const {
				status,
				modules = [],
				title,
				prefix,
				isDraft,
				organizationSprintId = null,
				organizationId,
				projectId,
				members
			} = where;
			const tenantId = RequestContext.currentTenantId() || where.tenantId;
			const likeOperator = isPostgres() ? 'ILIKE' : 'LIKE';

			// Initialize the query
			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
			query.leftJoin(`${query.alias}.modules`, 'modules');

			// Apply find options if provided
			if (isNotEmpty(options)) {
				query.setFindOptions({
					...(options.select && { select: options.select }),
					...(options.relations && { relations: options.relations }),
					...(options.order && { order: options.order })
				});
			}

			// Filter by project_module_task with a sub query
			query.andWhere((qb: SelectQueryBuilder<Task>) => {
				const subQuery = qb
					.subQuery()
					.select(p('"pmt"."taskId"')) // Use the alias 'pmt' here
					.from(p('project_module_task'), 'pmt') // Assign alias 'pmt' to project_module_task
					.leftJoin(
						'project_module_employee',
						'pme',
						p('"pme"."organizationProjectModuleId" = "pmt"."organizationProjectModuleId"')
					);

				// Retrieve the employee ID based on the permission
				const employeeId = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
					? members?.['id']
					: RequestContext.currentEmployeeId();

				if (isNotEmpty(employeeId)) {
					subQuery.andWhere(p('"pme"."employeeId" = :employeeId'), { employeeId });
				}
				if (isNotEmpty(modules)) {
					subQuery.andWhere(p(`"pmt"."organizationProjectModuleId" IN (:...modules)`), { modules });
				}

				return p(`"task_modules"."taskId" IN `) + subQuery.distinct(true).getQuery();
			});

			// Add organization and tenant filters
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
					qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
				})
			);

			// Filter by projectId and modules
			if (isNotEmpty(projectId)) {
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						if (isEmpty(modules)) {
							qb.andWhere(p(`"${query.alias}"."projectId" = :projectId`), { projectId });
						}
					})
				);
			}

			// Add additional filters (status, draft, title, etc.)
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (isNotEmpty(status)) {
						qb.andWhere(p(`"${query.alias}"."status" = :status`), { status });
					}
					if (isNotEmpty(isDraft)) {
						qb.andWhere(p(`"${query.alias}"."isDraft" = :isDraft`), { isDraft });
					}
					if (isNotEmpty(title)) {
						qb.andWhere(p(`"${query.alias}"."title" ${likeOperator} :title`), { title: `%${title}%` });
					}
					if (isNotEmpty(prefix)) {
						qb.andWhere(p(`"${query.alias}"."prefix" ${likeOperator} :prefix`), { prefix: `%${prefix}%` });
					}
					if (!isUUID(organizationSprintId)) {
						qb.andWhere(p(`"${query.alias}"."organizationSprintId" IS NULL`));
					}
				})
			);

			const [items, total] = await query.getManyAndCount();
			return { items, total };
		} catch (error) {
			console.log('Error while retrieving module tasks', error);
			throw new BadRequestException(error);
		}
	}

	/**
	 * @description Get tasks by views query
	 * @param {ID} viewId - View ID
	 * @returns {Promise<IPagination<ITask>>} A Promise resolved to paginated found tasks and total matching query filters
	 * @memberof TaskService
	 */
	async findTasksByViewQuery(viewId: ID): Promise<IPagination<ITask>> {
		const tenantId = RequestContext.currentTenantId();
		try {
			// Retrieve Task View by ID for getting their pre-defined query params
			const taskView = await this.typeOrmTaskViewRepository.findOne({ where: { id: viewId } });
			if (!taskView) {
				throw new HttpException('View not found', HttpStatus.NOT_FOUND);
			}

			// Extract `queryParams` from the view
			const queryParams = taskView.queryParams;
			const viewFilters = isSqlite()
				? (JSON.parse(queryParams as string) as IGetTasksByViewFilters)
				: (queryParams as IGetTasksByViewFilters) || {};

			// Extract filters
			const {
				projects = [],
				teams = [],
				members = [],
				modules = [],
				sprints = [],
				statusIds = [],
				statuses = [],
				priorityIds = [],
				priorities = [],
				sizeIds = [],
				sizes = [],
				tags = [],
				types = [],
				creators = [],
				startDates = [],
				dueDates = [],
				organizationId,
				relations = []
			} = viewFilters;

			// Calculate min and max dates only if arrays are not empty
			const getMinMaxDates = (dates: Date[]) =>
				dates.length
					? [
							new Date(Math.min(...dates.map((date) => new Date(date).getTime()))),
							new Date(Math.max(...dates.map((date) => new Date(date).getTime())))
					  ]
					: [undefined, undefined];

			const [minStartDate, maxStartDate] = getMinMaxDates(startDates);
			const [minDueDate, maxDueDate] = getMinMaxDates(dueDates);

			// Build the 'where' condition
			const where: FindOptionsWhere<Task> = {
				...(projects.length && { projectId: In(projects) }),
				...(teams.length && { teams: { id: In(teams) } }),
				...(members.length && { members: { id: In(members) } }),
				...(modules.length && { modules: { id: In(modules) } }),
				...(sprints.length && { organizationSprintId: In(sprints) }),
				...(statusIds.length && { taskStatusId: In(statusIds) }),
				...(statuses.length && { status: In(statuses) }),
				...(priorityIds.length && { taskPriorityId: In(priorityIds) }),
				...(priorities.length && { priority: In(priorities) }),
				...(sizeIds.length && { taskSizeId: In(sizeIds) }),
				...(sizes.length && { size: In(sizes) }),
				...(tags.length && { tags: { id: In(tags) } }),
				...(types.length && { issueType: In(types) }),
				...(creators.length && { creatorId: In(creators) }),
				...(minStartDate && maxStartDate && { startDate: Between(minStartDate, maxStartDate) }),
				...(minDueDate && maxDueDate && { dueDate: Between(minDueDate, maxDueDate) }),
				organizationId: taskView.organizationId || organizationId,
				tenantId
			};

			// Define find options
			const findOptions: FindManyOptions<Task> = { where, ...(relations && { relations }) };

			// Retrieve tasks using base class method
			return await super.findAll(findOptions);
		} catch (error) {
			console.error(`Error while retrieve view tasks: ${error.message}`, error.message);
			throw new HttpException({ message: error?.message, error }, HttpStatus.BAD_REQUEST);
		}
	}
}
