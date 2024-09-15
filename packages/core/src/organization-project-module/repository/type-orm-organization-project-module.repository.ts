import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationProjectModule } from '../organization-project-module.entity';

@Injectable()
export class TypeOrmOrganizationProjectModuleRepository extends Repository<OrganizationProjectModule> {
	constructor(
		@InjectRepository(OrganizationProjectModule) readonly repository: Repository<OrganizationProjectModule>
	) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
