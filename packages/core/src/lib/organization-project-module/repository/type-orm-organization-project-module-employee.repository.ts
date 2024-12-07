import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OrganizationProjectModuleEmployee } from '../organization-project-module-employee.entity';
import { Repository } from 'typeorm';

@Injectable()
export class TypeOrmOrganizationProjectModuleEmployeeRepository extends Repository<OrganizationProjectModuleEmployee> {
	constructor(
		@InjectRepository(OrganizationProjectModuleEmployee)
		readonly repository: Repository<OrganizationProjectModuleEmployee>
	) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
