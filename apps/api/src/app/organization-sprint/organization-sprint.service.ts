import { Repository } from 'typeorm';
import { OrganizationSprint } from './organization-sprint.entity';
import { CrudService } from '../core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class OrganizationSprintService extends CrudService<OrganizationSprint> {
	constructor(
		@InjectRepository(OrganizationSprint)
		private readonly sprintRepository: Repository<OrganizationSprint>
	) {
		super(sprintRepository);
	}
}
