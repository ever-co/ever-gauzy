import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { OrganizationLanguage } from './organization-language.entity';

@Injectable()
export class OrganizationLanguageService extends TenantAwareCrudService<OrganizationLanguage> {
	constructor(
		@InjectRepository(OrganizationLanguage)
		organizationLanguageRepository: Repository<OrganizationLanguage>,
		@MikroInjectRepository(OrganizationLanguage)
		mikroOrganizationLanguageRepository: EntityRepository<OrganizationLanguage>
	) {
		super(organizationLanguageRepository, mikroOrganizationLanguageRepository);
	}
}
