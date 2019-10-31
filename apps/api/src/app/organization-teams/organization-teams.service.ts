import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { OrganizationTeams } from './organization-teams.entity';

@Injectable()
export class OrganizationTeamsService extends CrudService<OrganizationTeams> {
	constructor(
		@InjectRepository(OrganizationTeams)
		private readonly organizationTeamsRepository: Repository<
			OrganizationTeams
		>
	) {
		super(organizationTeamsRepository);
	}
}
