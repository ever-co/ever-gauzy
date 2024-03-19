import { EntityRepository } from '@mikro-orm/knex';
import { OrganizationAward } from '../organization-award.entity';

export class MikroOrmOrganizationAwardRepository extends EntityRepository<OrganizationAward> { }
