import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationSprintTask } from '../organization-sprint-task.entity';

@Injectable()
export class TypeOrmOrganizationSprintTaskRepository extends Repository<OrganizationSprintTask> {
	constructor(@InjectRepository(OrganizationSprintTask) readonly repository: Repository<OrganizationSprintTask>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
