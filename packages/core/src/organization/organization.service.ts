import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { Organization } from './organization.entity';

@Injectable()
export class OrganizationService extends TenantAwareCrudService<Organization> {
	constructor(
		@InjectRepository(Organization)
		private readonly organizationRepository: Repository<Organization>,
		@MikroInjectRepository(Organization)
		private readonly mikroOrganizationRepository: EntityRepository<Organization>
	) {
		super(organizationRepository, mikroOrganizationRepository);
	}
}
