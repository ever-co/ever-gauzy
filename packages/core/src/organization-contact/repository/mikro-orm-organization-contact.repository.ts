import { EntityRepository } from '@mikro-orm/core';
import { OrganizationContact } from '../organization-contact.entity';

export class MikroOrmOrganizationContactRepository extends EntityRepository<OrganizationContact> { }