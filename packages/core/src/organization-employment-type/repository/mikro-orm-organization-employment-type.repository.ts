import { EntityRepository } from '@mikro-orm/knex';
import { OrganizationEmploymentType } from '../organization-employment-type.entity';

export class MikroOrmOrganizationEmploymentTypeRepository extends EntityRepository<OrganizationEmploymentType> { }
