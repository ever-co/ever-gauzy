import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationSprintTaskHistory } from '../organization-sprint-task-history.entity';

@Injectable()
export class TypeOrmOrganizationSprintTaskHistoryRepository extends Repository<OrganizationSprintTaskHistory> {
	constructor(
		@InjectRepository(OrganizationSprintTaskHistory) readonly repository: Repository<OrganizationSprintTaskHistory>
	) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
