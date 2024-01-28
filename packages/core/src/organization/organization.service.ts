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
		organizationRepository: Repository<Organization>,
		@MikroInjectRepository(Organization)
		mikroOrganizationRepository: EntityRepository<Organization>
	) {
		super(organizationRepository, mikroOrganizationRepository);
	}
}
