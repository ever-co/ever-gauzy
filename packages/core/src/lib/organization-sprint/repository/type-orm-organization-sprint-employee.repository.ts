import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationSprintEmployee } from '../organization-sprint-employee.entity';

@Injectable()
export class TypeOrmOrganizationSprintEmployeeRepository extends Repository<OrganizationSprintEmployee> {
	constructor(
		@InjectRepository(OrganizationSprintEmployee) readonly repository: Repository<OrganizationSprintEmployee>
	) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
