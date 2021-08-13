import { Repository } from 'typeorm';
import { OrganizationSprint } from './organization-sprint.entity';
import { TenantAwareCrudService } from './../core/crud';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class OrganizationSprintService extends TenantAwareCrudService<OrganizationSprint> {
	constructor(
		@InjectRepository(OrganizationSprint)
		private readonly sprintRepository: Repository<OrganizationSprint>
	) {
		super(sprintRepository);
	}
}
