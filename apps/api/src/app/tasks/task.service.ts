import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { Repository, FindManyOptions } from 'typeorm';
import { CrudService } from '../core';
import { OrganizationProjects } from '../organization-projects';

@Injectable()
export class TaskService extends CrudService<Task> {
	constructor(
		@InjectRepository(Task)
		private readonly taskRepository: Repository<Task>,
		@InjectRepository(OrganizationProjects)
		private readonly projectsRepository: Repository<OrganizationProjects>
	) {
		super(taskRepository);
	}

	async getAllTasks() {
		const tasks = await this.repository.find();
		const total = await this.repository.count();
		const data = tasks.map(async (task) => {
			return {
				...task,
				project: await this.projectsRepository.findOne({
					id: task.projectId
				})
			};
		});
		const items = await Promise.all(data);

		return { items, total };
	}
}
