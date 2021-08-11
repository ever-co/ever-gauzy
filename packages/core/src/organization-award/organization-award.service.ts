import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { OrganizationAward } from './organization-award.entity';

@Injectable()
export class OrganizationAwardService extends TenantAwareCrudService<OrganizationAward> {
	constructor(
		@InjectRepository(OrganizationAward)
		private readonly organizationAwardRepository: Repository<OrganizationAward>
	) {
		super(organizationAwardRepository);
	}
}
