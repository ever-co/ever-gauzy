import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { OrganizationEmploymentType } from './organization-employment-type.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class OrganizationEmploymentTypeService extends TenantAwareCrudService<OrganizationEmploymentType> {
	constructor(
		@InjectRepository(OrganizationEmploymentType)
		employmentTypesRepo: Repository<OrganizationEmploymentType>,
		@MikroInjectRepository(OrganizationEmploymentType)
		mikroEmploymentTypesRepo: EntityRepository<OrganizationEmploymentType>
	) {
		super(employmentTypesRepo, mikroEmploymentTypesRepo);
	}
}
