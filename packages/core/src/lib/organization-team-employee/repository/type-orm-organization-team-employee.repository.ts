import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationTeamEmployee } from '../organization-team-employee.entity';

@Injectable()
export class TypeOrmOrganizationTeamEmployeeRepository extends Repository<OrganizationTeamEmployee> {
	constructor(@InjectRepository(OrganizationTeamEmployee) readonly repository: Repository<OrganizationTeamEmployee>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
