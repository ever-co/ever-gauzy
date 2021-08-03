import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { OrganizationAwards } from './organization-awards.entity';

@Injectable()
export class OrganizationAwardsService extends TenantAwareCrudService<OrganizationAwards> {
	constructor(
		@InjectRepository(OrganizationAwards)
		private readonly organizationAwardsRepository: Repository<OrganizationAwards>
	) {
		super(organizationAwardsRepository);
	}
}
