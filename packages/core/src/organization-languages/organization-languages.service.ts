import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { OrganizationLanguages } from './organization-languages.entity';

@Injectable()
export class OrganizationLanguagesService extends TenantAwareCrudService<OrganizationLanguages> {
	constructor(
		@InjectRepository(OrganizationLanguages)
		private readonly organizationLanguagesRepository: Repository<OrganizationLanguages>
	) {
		super(organizationLanguagesRepository);
	}
}
