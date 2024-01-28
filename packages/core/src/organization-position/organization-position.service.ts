import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { OrganizationPosition } from './organization-position.entity';

@Injectable()
export class OrganizationPositionService extends TenantAwareCrudService<OrganizationPosition> {
	constructor(
		@InjectRepository(OrganizationPosition)
		organizationPositionRepository: Repository<OrganizationPosition>,
		@MikroInjectRepository(OrganizationPosition)
		mikroOrganizationPositionRepository: EntityRepository<OrganizationPosition>
	) {
		super(organizationPositionRepository, mikroOrganizationPositionRepository);
	}
}
