import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OrganizationSprint } from './organization-sprint.entity';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmOrganizationSprintRepository } from './repository/type-orm-organization-sprint.repository';
import { MikroOrmOrganizationSprintRepository } from './repository/mikro-orm-organization-sprint.repository';

@Injectable()
export class OrganizationSprintService extends TenantAwareCrudService<OrganizationSprint> {
	constructor(
		@InjectRepository(OrganizationSprint)
		typeOrmOrganizationSprintRepository: TypeOrmOrganizationSprintRepository,

		mikroOrmOrganizationSprintRepository: MikroOrmOrganizationSprintRepository
	) {
		super(typeOrmOrganizationSprintRepository, mikroOrmOrganizationSprintRepository);
	}
}
