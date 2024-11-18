import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationProjectEmployee } from '../organization-project-employee.entity';

@Injectable()
export class TypeOrmOrganizationProjectEmployeeRepository extends Repository<OrganizationProjectEmployee> {
	constructor(
		@InjectRepository(OrganizationProjectEmployee) readonly repository: Repository<OrganizationProjectEmployee>
	) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
