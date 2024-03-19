import { EntityRepository } from '@mikro-orm/knex';
import { OrganizationTeam } from '../organization-team.entity';

export class MikroOrmOrganizationTeamRepository extends EntityRepository<OrganizationTeam> { }
