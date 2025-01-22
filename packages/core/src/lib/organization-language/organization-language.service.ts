import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { OrganizationLanguage } from './organization-language.entity';
import { TypeOrmOrganizationLanguageRepository } from './repository/type-orm-organization-language.repository';
import { MikroOrmOrganizationLanguageRepository } from './repository/mikro-orm-organization-language.repository';

@Injectable()
export class OrganizationLanguageService extends TenantAwareCrudService<OrganizationLanguage> {
	constructor(
		typeOrmOrganizationLanguageRepository: TypeOrmOrganizationLanguageRepository,
		mikroOrmOrganizationLanguageRepository: MikroOrmOrganizationLanguageRepository
	) {
		super(typeOrmOrganizationLanguageRepository, mikroOrmOrganizationLanguageRepository);
	}
}
