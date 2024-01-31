import { EntityRepository } from '@mikro-orm/core';
import { OrganizationTeam } from '../organization-team.entity';

export class MikroOrmOrganizationTeamRepository extends EntityRepository<OrganizationTeam> { }