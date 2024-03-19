import { EntityRepository } from '@mikro-orm/knex';
import { OrganizationLanguage } from '../organization-language.entity';

export class MikroOrmOrganizationLanguageRepository extends EntityRepository<OrganizationLanguage> { }
