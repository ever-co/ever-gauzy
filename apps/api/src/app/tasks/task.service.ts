import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { Repository } from 'typeorm';
import { CrudService } from '../core';

@Injectable()
export class TaskService extends CrudService<Task> {
	constructor(
		@InjectRepository(Task)
		private readonly taskRepository: Repository<Task>
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
}
