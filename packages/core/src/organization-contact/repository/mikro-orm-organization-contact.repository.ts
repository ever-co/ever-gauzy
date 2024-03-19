import { EntityRepository } from '@mikro-orm/knex';
import { OrganizationContact } from '../organization-contact.entity';

export class MikroOrmOrganizationContactRepository extends EntityRepository<OrganizationContact> { }
