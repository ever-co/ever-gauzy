import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { Repository } from 'typeorm';
import { CrudService } from '../core';
import { EmployeeService } from '../employee/employee.service';
import { RoleService } from '../role/role.service';
import { RequestContext } from '../core/context';

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

	async getMyTasks(employeeId) {
		const total = await this.taskRepository
			.createQueryBuilder('task')
			.leftJoinAndSelect('task.project', 'project')
			.leftJoinAndSelect('task.tags', 'tags')
			.leftJoinAndSelect('task.members', 'members')
			.leftJoinAndSelect('members.user', 'users')
			.leftJoinAndSelect('task.teams', 'teams')
			.where('"task_members"."employeeId" = :employeeId', { employeeId })
			.getCount();
		const items = await this.taskRepository
			.createQueryBuilder('task')
			.leftJoinAndSelect('task.project', 'project')
			.leftJoinAndSelect('task.tags', 'tags')
			.leftJoinAndSelect('task.members', 'members')
			.leftJoinAndSelect('members.user', 'users')
			.leftJoinAndSelect('task.teams', 'teams')
			.where((qb) => {
				const subQuery = qb
					.subQuery()
					.select('"task_employee_sub"."taskId"')
					.from('task_employee', 'task_employee_sub')
					.where('"task_employee_sub"."employeeId" = :employeeId')
					.distinct(true)
					.getQuery();
				return '"task_members"."taskId" IN(' + subQuery + ')';
			})
			.setParameter('employeeId', employeeId)
			.getMany();
		return { items, total };
	}

	async getTeamTasks(employeeId?: string) {
		console.log('emp*********', employeeId);
		if (employeeId) {
			const items = await this.taskRepository
				.createQueryBuilder('task')
				.leftJoinAndSelect('task.project', 'project')
				.leftJoinAndSelect('task.tags', 'tags')
				.leftJoinAndSelect('task.members', 'members')
				.leftJoinAndSelect('task.teams', 'teams')
				.where((qb) => {
					const subQuery = qb
						.subQuery()
						.select('"task_team_sub"."taskId"')
						.from('task_team', 'task_team_sub')
						.innerJoin(
							'organization_team_employee',
							'organization_team_employee_sub',
							'"organization_team_employee_sub"."organizationTeamId" = "task_team_sub"."organizationTeamId"'
						)
						.where(
							'"organization_team_employee_sub"."employeeId" = :employeeId'
						)
						.distinct(true)
						.getQuery();
					return '"task_teams"."taskId" IN ' + subQuery;
				})
				.setParameter('employeeId', employeeId)
				.getMany();
			return { items, total: items.length };
		} else {
			const items = await this.taskRepository
				.createQueryBuilder('task')
				.leftJoinAndSelect('task.project', 'project')
				.leftJoinAndSelect('task.tags', 'tags')
				.leftJoinAndSelect('task.members', 'members')
				.leftJoinAndSelect('task.teams', 'teams')
				.where((qb) => {
					const subQuery = qb
						.subQuery()
						.select('"task_team_sub"."taskId"')
						.from('task_team', 'task_team_sub')
						.leftJoin(
							'organization_team_employee',
							'organization_team_employee_sub',
							'"organization_team_employee_sub"."organizationTeamId" = "task_team_sub"."organizationTeamId"'
						)
						.distinct(true)
						.getQuery();
					return '"task_teams"."taskId" IN ' + subQuery;
				})
				.getMany();
			return { items, total: items.length };
		}
	}

	async findTeamTasks(employeeId) {
		// If user is not an employee, then this will return 404
		let employee: any = { id: undefined };
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
			if (role.name === 'ADMIN' || role.name === 'SUPER_ADMIN') {
				return this.getTeamTasks(employeeId);
			} else if (employee.id === employeeId) {
				return this.getTeamTasks(employeeId);
			} else {
				throw new HttpException(
					'Unauthorized',
					HttpStatus.UNAUTHORIZED
				);
			}
		} else {
			if (role.name === 'ADMIN' || role.name === 'SUPER_ADMIN') {
				return this.getTeamTasks();
			} else {
				return this.getTeamTasks(employee.id);
			}
		}
	}
}
