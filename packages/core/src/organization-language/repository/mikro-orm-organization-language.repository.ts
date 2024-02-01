import { EntityRepository } from '@mikro-orm/core';
import { OrganizationLanguage } from '../organization-language.entity';

export class MikroOrmOrganizationLanguageRepository extends EntityRepository<OrganizationLanguage> { }