import { EntityRepository } from '@mikro-orm/knex';
import { OrganizationSprint } from '../organization-sprint.entity';

export class MikroOrmOrganizationSprintRepository extends EntityRepository<OrganizationSprint> { }
