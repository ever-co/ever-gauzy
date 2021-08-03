import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { OrganizationPositions } from './organization-positions.entity';

@Injectable()
export class OrganizationPositionsService extends TenantAwareCrudService<OrganizationPositions> {
	constructor(
		@InjectRepository(OrganizationPositions)
		private readonly organizationPositionsRepository: Repository<OrganizationPositions>
	) {
		super(organizationPositionsRepository);
	}
}
