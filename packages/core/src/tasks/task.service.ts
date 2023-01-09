import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, SelectQueryBuilder, Brackets, WhereExpressionBuilder, Raw } from 'typeorm';
import { IEmployee, IGetTaskOptions, IPagination, ITask, PermissionsEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { isUUID } from 'class-validator';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { Task } from './task.entity';

@Injectable()
export class TaskService extends TenantAwareCrudService<Task> {
	constructor(
		@InjectRepository(Task)
		private readonly taskRepository: Repository<Task>
	) {
		super(taskRepository);
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

			const query = this.taskRepository.createQueryBuilder(this.alias);
			query.innerJoin(`${query.alias}.members`, 'members');
			/**
			 * If find options
			 */
			if (isNotEmpty(options)) {
				query.setFindOptions({
					skip: options.skip ? (options.take * (options.skip - 1)) : 0,
					take: options.take ? (options.take) : 10
				});
				query.setFindOptions({
					...(
						(options.relations) ? { relations: options.relations } : {}
					)
				});
				query.andWhere((qb: SelectQueryBuilder<Task>) => {
					const subQuery = qb.subQuery();
					subQuery.select('"task_employee"."taskId"').from('task_employee', 'task_employee');

					// If user have permission to change employee
					if (RequestContext.hasPermission(
						PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
					)) {
						if (isNotEmpty(members) && isNotEmpty(members['id'])) {
							const employeeId = members['id'];
							subQuery.andWhere('"task_employee"."employeeId" = :employeeId', { employeeId });
						}
					} else {
						// If employee has login and don't have permission to change employee
						const employeeId = RequestContext.currentEmployeeId();
						if (isNotEmpty(employeeId)) {
							subQuery.andWhere('"task_employee"."employeeId" = :employeeId', { employeeId });
						}
					}
					return ('"task_members"."taskId" IN ' + subQuery.distinct(true).getQuery());
				});
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						const tenantId = RequestContext.currentTenantId();
						qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
						qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
					})
				);
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						if (isNotEmpty(projectId)) {
							qb.andWhere(`"${query.alias}"."projectId" = :projectId`, { projectId });
						}
						if (isNotEmpty(status)) {
							qb.andWhere(`"${query.alias}"."status" = :status`, { status });
						}
						if (isNotEmpty(title)) {
							qb.andWhere(`"${query.alias}"."title" ILIKE :title`, { title: `%${title}%` });
						}
						if (isNotEmpty(title)) {
							qb.andWhere(`"${query.alias}"."prefix" ILIKE :prefix`, { prefix: `%${prefix}%` });
						}
						if (isNotEmpty(organizationSprintId) && !isUUID(organizationSprintId)) {
							qb.andWhere(`"${query.alias}"."organizationSprintId" IS NULL`);
						}
					})
				);
				const [ items, total ] = await query.getManyAndCount();
				return { items, total };
			}
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
	async getAllTasksByEmployee(
		employeeId: IEmployee['id'],
		options: PaginationParams<Task>
	) {
		try {
			const query = this.taskRepository.createQueryBuilder(this.alias);
			query.innerJoin(`${query.alias}.members`, 'members');
			/**
			 * If additional options found
			 */
			query.setFindOptions({
				...(
					(isNotEmpty(options) && isNotEmpty(options.where)) ? {
						where: options.where
					} : {}
				)
			});
			query.andWhere((qb: SelectQueryBuilder<Task>) => {
				const subQuery = qb.subQuery();
				subQuery.select('"task_employee_sub"."taskId"').from('task_employee', 'task_employee_sub');
				subQuery.andWhere('"task_employee_sub"."employeeId" = :employeeId', { employeeId });
				return ('"task_members"."taskId" IN ' + subQuery.distinct(true).getQuery());
			});
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					const tenantId = RequestContext.currentTenantId();
					qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
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
	async findTeamTasks(
		options: PaginationParams<Task>
	): Promise<IPagination<ITask>>  {
		try {
			const { where } = options;
			const { status, teams = [], title, prefix, organizationSprintId = null } = where;
			const { organizationId, projectId, members } = where;

			const query = this.taskRepository.createQueryBuilder(this.alias);
			query.innerJoin(`${query.alias}.teams`, 'teams');
			/**
			 * If find options
			 */
			if (isNotEmpty(options)) {
				query.setFindOptions({
					skip: options.skip ? (options.take * (options.skip - 1)) : 0,
					take: options.take ? (options.take) : 10
				});
				query.setFindOptions({
					...(
						(options.select) ? { select: options.select } : {}
					),
					...(
						(options.relations) ? { relations: options.relations } : {}
					),
					...(
						(options.order) ? { order: options.order } : {}
					)
				});
			}
			query.andWhere((qb: SelectQueryBuilder<Task>) => {
				const subQuery = qb.subQuery();
				subQuery.select('"task_team"."taskId"').from('task_team', 'task_team');
				subQuery.leftJoin(
					'organization_team_employee',
					'organization_team_employee',
					'"organization_team_employee"."organizationTeamId" = "task_team"."organizationTeamId"'
				);
				// If user have permission to change employee
				if (RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				)) {
					if (isNotEmpty(members) && isNotEmpty(members['id'])) {
						const employeeId = members['id'];
						subQuery.andWhere('"organization_team_employee"."employeeId" = :employeeId', { employeeId });
					}
				} else {
					// If employee has login and don't have permission to change employee
					const employeeId = RequestContext.currentEmployeeId();
					if (isNotEmpty(employeeId)) {
						subQuery.andWhere('"organization_team_employee"."employeeId" = :employeeId', { employeeId });
					}
				}
				if (isNotEmpty(teams)) {
					subQuery.andWhere(`"${subQuery.alias}"."organizationTeamId" IN (:...teams)`, {
						teams
					});
				}
				return `"task_teams"."taskId" IN ` + subQuery.distinct(true).getQuery();
			});
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					const tenantId = RequestContext.currentTenantId();
					qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
					qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
				})
			);
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (isNotEmpty(projectId)) {
						qb.andWhere(`"${query.alias}"."projectId" = :projectId`, { projectId });
					}
					if (isNotEmpty(status)) {
						qb.andWhere(`"${query.alias}"."status" = :status`, { status });
					}
					if (isNotEmpty(title)) {
						qb.andWhere(`"${query.alias}"."title" ILIKE :title`, { title: `%${title}%` });
					}
					if (isNotEmpty(title)) {
						qb.andWhere(`"${query.alias}"."prefix" ILIKE :prefix`, { prefix: `%${prefix}%` });
					}
					if (isNotEmpty(organizationSprintId) && !isUUID(organizationSprintId)) {
						qb.andWhere(`"${query.alias}"."organizationSprintId" IS NULL`);
					}
				})
			);
			const [ items, total ] = await query.getManyAndCount();
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
	public async pagination(
		options: PaginationParams<Task>
	): Promise<IPagination<ITask>> {
		if ('where' in options) {
			const { where } = options;
			if ('title' in where) {
				const { title } = where;
				options['where']['title'] = Raw((alias) => `${alias} ILIKE '%${title}%'`);
			}
			if ('prefix' in where) {
				const { prefix } = where;
				options['where']['prefix'] = Raw((alias) => `${alias} ILIKE '%${prefix}%'`);
			}
			if ('organizationSprintId' in where) {
				const { organizationSprintId } = where;
				if (!isUUID(organizationSprintId)) {
					options['where']['organizationSprintId'] = IsNull();
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
		const tenantId = RequestContext.currentTenantId();
		const { organizationId, projectId } = options;
		/**
		 * GET maximum task number by project
		 */
		const query = this.taskRepository.createQueryBuilder('task');
		query.select(`COALESCE(MAX("${query.alias}"."number"), 0)`, "maxTaskNumber");
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(`"${query.alias}"."organizationId" =:organizationId`, { organizationId });
				qb.andWhere(`"${query.alias}"."tenantId" =:tenantId`, { tenantId });
				if (isNotEmpty(projectId)) {
					qb.andWhere(`"${query.alias}"."projectId" = :projectId`, { projectId });
				} else {
					qb.andWhere(`"${query.alias}"."projectId" IS NULL`);
				}
			})
		);
		const { maxTaskNumber } = await query.getRawOne();
		return maxTaskNumber;
	}
}
