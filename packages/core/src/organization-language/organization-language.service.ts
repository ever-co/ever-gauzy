import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { OrganizationLanguage } from './organization-language.entity';
import { TypeOrmOrganizationLanguageRepository } from './repository/type-orm-organization-language.repository';
import { MikroOrmOrganizationLanguageRepository } from './repository/mikro-orm-organization-language.repository';

@Injectable()
export class OrganizationLanguageService extends TenantAwareCrudService<OrganizationLanguage> {
	constructor(
		@InjectRepository(OrganizationLanguage)
		typeOrmOrganizationLanguageRepository: TypeOrmOrganizationLanguageRepository,

		mikroOrmOrganizationLanguageRepository: MikroOrmOrganizationLanguageRepository
	) {
		super(typeOrmOrganizationLanguageRepository, mikroOrmOrganizationLanguageRepository);
	}
}
