import { EntityRepository } from '@mikro-orm/knex';
import { UserOrganization } from '../user-organization.entity';

export class MikroOrmUserOrganizationRepository extends EntityRepository<UserOrganization> { }
