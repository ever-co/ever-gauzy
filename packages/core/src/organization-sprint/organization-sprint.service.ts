import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Repository } from 'typeorm';
import { OrganizationSprint } from './organization-sprint.entity';
import { TenantAwareCrudService } from './../core/crud';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class OrganizationSprintService extends TenantAwareCrudService<OrganizationSprint> {
	constructor(
		@InjectRepository(OrganizationSprint)
		sprintRepository: Repository<OrganizationSprint>,
		@MikroInjectRepository(OrganizationSprint)
		mikroSprintRepository: EntityRepository<OrganizationSprint>
	) {
		super(sprintRepository, mikroSprintRepository);
	}
}
