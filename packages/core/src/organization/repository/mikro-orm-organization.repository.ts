import { EntityRepository } from '@mikro-orm/knex';
import { Organization } from '../organization.entity';

export class MikroOrmOrganizationRepository extends EntityRepository<Organization> { }
