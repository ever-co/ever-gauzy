import { Injectable, BadRequestException, HttpStatus, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, SelectQueryBuilder, Brackets, WhereExpressionBuilder, Raw, In } from 'typeorm';
import { isUUID } from 'class-validator';
import { IEmployee, IGetTaskOptions, IPagination, ITask, PermissionsEnum } from '@gauzy/contracts';
import { isEmpty, isNotEmpty } from '@gauzy/common';
import { isPostgres } from '@gauzy/config';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { Task } from './task.entity';
import { GetTaskByIdDTO } from './dto';
import { prepareSQLQuery as p } from './../database/database.helper';
import { TypeOrmTaskRepository } from './repository/type-orm-task.repository';
import { MikroOrmTaskRepository } from './repository/mikro-orm-task.repository';

@Injectable()
export class TaskService extends TenantAwareCrudService<Task> {
	constructor(
		@InjectRepository(Task)
		typeOrmTaskRepository: TypeOrmTaskRepository,

		mikroOrmTaskRepository: MikroOrmTaskRepository
	) {
		super(typeOrmTaskRepository, mikroOrmTaskRepository);
	}

	/**
	 *
	 * @param id
	 * @param relations
	 * @returns
	 */
	async findById(id: ITask['id'], params: GetTaskByIdDTO): Promise<ITask> {
		const task = await this.findOneByIdString(id, params);

		if (params.includeRootEpic) {
			task.rootEpic = await this.findParentUntilEpic(task.id);
		}

		return task;
	}

	async findParentUntilEpic(issueId: string): Promise<Task> {
		// Define the recursive SQL query
		const query = p(`
			WITH RECURSIVE IssueHierarchy AS (SELECT *
				FROM task
				WHERE id = $1
			UNION ALL
				SELECT i.*
				FROM task i
						INNER JOIN IssueHierarchy ih ON i.id = ih."parentId")
			SELECT *
				FROM IssueHierarchy
				WHERE "issueType" = 'Epic'
			LIMIT 1;
		`);

		// Execute the raw SQL query with the issueId parameter
		const result = await this.repository.query(query, [issueId]);

		// Check if any epic was found and return it, or return null
		if (result.length > 0) {
			return result[0];
		} else {
			return null;
		}
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
			const { status, title, prefix, organizationSprintId = null } = where;
			const { organizationId, projectId, members } = where;
			const likeOperator = isPostgres() ? 'ILIKE' : 'LIKE';


			const query = this.createQueryBuilder();

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

			console.log('query.getSql', query.getSql())
			const [items, total] = await query.getManyAndCount();
			return { items, total };
		} catch (error) {
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
			const query = this.repository.createQueryBuilder(this.tableName);
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
						return p('"task_members"."taskId" IN ') + subQuery.distinct(true).getQuery();
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
						return p('"task_teams"."taskId" IN ') + subQuery.distinct(true).getQuery();
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

			const { status, teams = [], title, prefix, organizationSprintId = null } = where;
			const { organizationId, projectId, members } = where;
			const likeOperator = isPostgres() ? 'ILIKE' : 'LIKE';

			const query = this.repository.createQueryBuilder(this.tableName);
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
	 * GET tasks by pagination
	 *
	 * @param options
	 * @returns
	 */
	public async pagination(options: PaginationParams<Task>): Promise<IPagination<ITask>> {
		if ('where' in options) {
			const { where } = options;
			const likeOperator = isPostgres() ? 'ILIKE' : 'LIKE'
			if ('title' in where) {
				const { title } = where;
				options['where']['title'] = Raw((alias) => `${alias} ${likeOperator} '%${title}%'`);
			}
			if ('prefix' in where) {
				const { prefix } = where;
				options['where']['prefix'] = Raw((alias) => `${alias} ${likeOperator} '%${prefix}%'`);
			}
			if ('organizationSprintId' in where) {
				const { organizationSprintId } = where;
				if (!isUUID(organizationSprintId)) {
					options['where']['organizationSprintId'] = IsNull();
				}
			}
			if ('teams' in where) {
				const { teams } = where;
				options.where.teams = {
					id: In(teams as string[])
				}
			}
		}
		return await super.paginate(options);
	}

	/**
	 * GET maximum task number by project filter
	 *
	 * @param options
	 */
	public async getMaxTaskNumberByProject(options: IGetTaskOptions) {
		try {
			// Extract necessary options
			const tenantId = RequestContext.currentTenantId() || options.tenantId;
			const { organizationId, projectId } = options;

			const query = this.repository.createQueryBuilder(this.tableName);

			// Build the query to get the maximum task number
			query.select(p(`COALESCE(MAX("${query.alias}"."number"), 0)`), 'maxTaskNumber');

			// Filter by organization and tenant
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), {
						organizationId
					});
					qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), {
						tenantId
					});
				})
			);

			// Filter by project (if provided)
			if (isNotEmpty(projectId)) {
				query.andWhere(p(`"${query.alias}"."projectId" = :projectId`), {
					projectId
				});
			} else {
				query.andWhere(p(`"${query.alias}"."projectId" IS NULL`));
			}

			// Execute the query and get the maximum task number
			const { maxTaskNumber } = await query.getRawOne();
			return maxTaskNumber;
		} catch (error) {
			throw new HttpException({ message: error?.message, error }, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Unassign employee from team task
	 * @param employeeId
	 * @param organizationTeamId
	 */
	public async unassignEmployeeFromTeamTasks(employeeId: string, organizationTeamId: string) {
		try {
			const query = this.repository.createQueryBuilder(this.tableName);
			query.leftJoinAndSelect(`${query.alias}.members`, 'members');
			if (organizationTeamId) {
				query.leftJoinAndSelect(`${query.alias}.teams`, 'teams', 'teams.id = :organizationTeamId', {
					organizationTeamId
				});
			} else {
				query.leftJoinAndSelect(`${query.alias}.teams`, 'teams');
			}

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
						return p('"task_members"."taskId" IN ') + subQuery.distinct(true).getQuery();
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
								employeeId
							});
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
			await this.repository.save(tasks);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
