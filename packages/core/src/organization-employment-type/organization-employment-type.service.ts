import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { OrganizationEmploymentType } from './organization-employment-type.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class OrganizationEmploymentTypeService extends TenantAwareCrudService<OrganizationEmploymentType> {
	constructor(
		@InjectRepository(OrganizationEmploymentType)
		private readonly employmentTypesRepo: Repository<OrganizationEmploymentType>
	) {
		super(employmentTypesRepo);
	}
}
