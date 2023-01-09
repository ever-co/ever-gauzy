import {
	Injectable,
	HttpException,
	HttpStatus,
	UnauthorizedException,
	BadRequestException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, SelectQueryBuilder, Brackets, WhereExpressionBuilder, Raw } from 'typeorm';
import { IEmployee, IGetTaskByEmployeeOptions, IGetTaskOptions, IPagination, IRole, ITask, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { isUUID } from 'class-validator';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { Task } from './task.entity';
import { EmployeeService } from '../employee/employee.service';
import { RoleService } from '../role/role.service';

@Injectable()
export class TaskService extends TenantAwareCrudService<Task> {
	constructor(
		@InjectRepository(Task)
		private readonly taskRepository: Repository<Task>,

		private readonly employeeService: EmployeeService,
		private readonly roleService: RoleService
	) {
		super(taskRepository);
	}

	async getMyTasks(filter: any) {
		const {
			where: { employeeId }
		} = filter;

		//If user is not an employee, then this will return 404
		const employee = await this.employeeService.findOneByOptions({
			where: {
				user: { id: RequestContext.currentUserId() }
			}
		});

		if (!employee || employee.id !== employeeId) {
			throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
		}

		return this.getEmployeeTasks(filter);
	}

	async getEmployeeTasks(filter: any) {
		const {
			where: {
				organizationId,
				employeeId,
				projectId,
				status,
				title,
				organizationSprintId = null
			}
		} = filter;
		const query = this.taskRepository.createQueryBuilder('task');
		if (filter.page && filter.limit) {
			query.skip(filter.limit * (filter.page - 1));
			query.take(filter.limit);
		}

		query.skip(filter.skip ? filter.take * (filter.skip - 1) : 0);
		query.take(filter.take ? filter.take : 10);

		const [items, total] = await query
			.leftJoinAndSelect(`${query.alias}.project`, 'project')
			.leftJoinAndSelect(`${query.alias}.tags`, 'tags')
			.leftJoinAndSelect(`${query.alias}.organizationSprint`, 'sprint')
			.leftJoinAndSelect(`${query.alias}.teams`, 'teams')
			.leftJoinAndSelect(`${query.alias}.creator`, 'creator')
			.leftJoinAndSelect(`${query.alias}.members`, 'members')
			.leftJoinAndSelect('members.user', 'user')
			.where((qb: SelectQueryBuilder<Task>) => {
				qb.andWhere((cb) => {
					const subQuery = cb
						.subQuery()
						.select('"task_employee"."taskId"')
						.from('task_employee', 'task_employee');
					if (employeeId) {
						subQuery.andWhere(
							'"task_employee"."employeeId" = :employeeId',
							{
								employeeId
							}
						);
					}
					return (
						'"task_members"."taskId" IN ' +
						subQuery.distinct(true).getQuery()
					);
				})
					.andWhere(
						`"${qb.alias}"."organizationId" = :organizationId`,
						{ organizationId }
					)
					.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, {
						tenantId: RequestContext.currentTenantId()
					});

				if (projectId) {
					query.andWhere(`"${qb.alias}"."projectId" = :projectId`, {
						projectId
					});
				}
				if (status) {
					query.andWhere(`"${qb.alias}"."status" = :status`, {
						status
					});
				}
				if (title) {
					query.andWhere(`"${qb.alias}"."title" LIKE :title`, {
						title: `%${title}%`
					});
				}
				if (organizationSprintId) {
					query.andWhere(
						`"${qb.alias}"."organizationSprintId" IS NULL`
					);
				}
			})
			.getManyAndCount();
		return { items, total };
	}

	async getAllTasksByEmployee(
		employeeId: string,
		filter: IGetTaskByEmployeeOptions
	) {
		const query = await this.taskRepository
			.createQueryBuilder('task')
			.leftJoin('task.members', 'members');
		if (filter && filter.where) {
			query.where({
				where: filter.where
			});
		}
		return await query
			.andWhere((qb) => {
				const subQuery = qb
					.subQuery()
					.select('"task_employee_sub"."taskId"')
					.from('task_employee', 'task_employee_sub')
					.where('"task_employee_sub"."employeeId" = :employeeId', {
						employeeId
					})
					.distinct(true)
					.getQuery();
				return '"task_members"."taskId" IN(' + subQuery + ')';
			})
			.getMany();
	}

	/**
	 * GET team tasks
	 *
	 * @param options
	 * @returns
	 */
	async findTeamTasks(
		options: PaginationParams<ITask>
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
