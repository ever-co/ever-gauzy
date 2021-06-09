import {
	Injectable,
	HttpException,
	HttpStatus
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CrudService } from '../core';
import { EmployeeService } from '../employee/employee.service';
import { RoleService } from '../role/role.service';
import { RequestContext } from '../core/context';
import { IEmployee, IGetTaskByEmployeeOptions, RolesEnum } from '@gauzy/contracts';

@Injectable()
export class TaskService extends CrudService<Task> {
	constructor(
		@InjectRepository(Task)
		private readonly taskRepository: Repository<Task>,
		private readonly employeeService: EmployeeService,
		private readonly roleService: RoleService
	) {
		super(taskRepository);
	}

	async getMyTasks(filter: any) {
		const { where : { organizationId, employeeId, projectId } } = filter;

		//If user is not an employee, then this will return 404
		const employee = await this.employeeService.findOne({
			where: {
				user: { id: RequestContext.currentUser().id }
			}
		});

		if (!employee || employee.id !== employeeId) {
			throw new HttpException(
				'Unauthorized',
				HttpStatus.UNAUTHORIZED
			);
		}

		const query = this.taskRepository.createQueryBuilder('task');
		if (filter.page && filter.limit) {
			query.skip(filter.limit * (filter.page - 1));
			query.take(filter.limit);
		}

		const [ items, total ] = await query
			.leftJoinAndSelect(`${query.alias}.project`, 'project')
			.leftJoinAndSelect(`${query.alias}.tags`, 'tags')
			.leftJoinAndSelect(`${query.alias}.organizationSprint`, 'sprint')
			.leftJoinAndSelect(`${query.alias}.members`, 'members')
			.leftJoinAndSelect(`${query.alias}.teams`, 'teams')
			.leftJoinAndSelect(`${query.alias}.creator`, 'creator')
			.leftJoinAndSelect('members.user', 'users')
			.where((qb: SelectQueryBuilder<Task>) => {
				qb
				.andWhere((cb) => {
					const subQuery = cb
						.subQuery()
						.select('"task_employee"."taskId"')
						.from('task_employee', 'task_employee');
					if (employeeId) {
						subQuery.andWhere('"task_employee"."employeeId" = :employeeId', {
							employeeId
						});
					}
					return '"task_members"."taskId" IN ' + subQuery.distinct(true).getQuery();
				})
				.andWhere(`"${qb.alias}"."organizationId" = :organizationId`, { organizationId })
				.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, { tenantId: RequestContext.currentTenantId() });

				if (projectId) {
					query.andWhere(`"${qb.alias}"."projectId" = :projectId`, { projectId });
				}
			})
			.getManyAndCount()
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

	async getTeamTasks(filter: any) {
		const { where : { organizationId, employeeId, projectId } } = filter;
		const query = this.taskRepository.createQueryBuilder('task');

		if (filter.page && filter.limit) {
			query.skip(filter.limit * (filter.page - 1));
			query.take(filter.limit);
		}
	
		const [ items, total ] = await query
			.leftJoinAndSelect(`${query.alias}.project`, 'project')
			.leftJoinAndSelect(`${query.alias}.tags`, 'tags')
			.leftJoinAndSelect(`${query.alias}.organizationSprint`, 'sprint')
			.leftJoinAndSelect(`${query.alias}.members`, 'members')
			.leftJoinAndSelect(`${query.alias}.teams`, 'teams')
			.leftJoinAndSelect(`${query.alias}.creator`, 'users')
			.where((qb: SelectQueryBuilder<Task>) => {
				qb.andWhere((cb) => {
					const subQuery = cb
						.subQuery()
						.select('"task_team_sub"."taskId"')
						.from('task_team', 'task_team_sub')
						.leftJoin(
							'organization_team_employee', 
							'organization_team_employee_sub', 
							'"organization_team_employee_sub"."organizationTeamId" = "task_team_sub"."organizationTeamId"'
						);
						
						if (employeeId) {
							subQuery.andWhere('"organization_team_employee_sub"."employeeId" = :employeeId', {
								employeeId
							});
						}
					return '"task_teams"."taskId" IN ' + subQuery.distinct(true).getQuery();
				})
				.andWhere(`"${qb.alias}"."organizationId" = :organizationId`, { organizationId })
				.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, { tenantId: RequestContext.currentTenantId() });

				if (projectId) {
					query.andWhere(`"${qb.alias}"."projectId" = :projectId`, { projectId });
				}
			})
			.getManyAndCount();
		return { items, total };
	}

	async findTeamTasks(filter: any) {
		const { where: { employeeId } } = filter;
		
		// If user is not an employee, then this will return 404
		let employee: IEmployee;
		let role;
		try {
			employee = await this.employeeService.findOne({
				where: {
					user: { id: RequestContext.currentUser().id }
				}
			});
		} catch (e) {}

		try {
			const roleId = RequestContext.currentUser().roleId;
			if (roleId) {
				role = await this.roleService.findOne(roleId);
			}
		} catch (e) {}
		
		// selected user not passed
		if (employeeId) {
			if (
				role.name === RolesEnum.ADMIN || 
				role.name === RolesEnum.SUPER_ADMIN || 
				employee.id === employeeId
			) {
				return this.getTeamTasks(filter);
			} else {
				throw new HttpException(
					'Unauthorized',
					HttpStatus.UNAUTHORIZED
				);
			}
		} else {
			return this.getTeamTasks(filter);
		}
	}
}
