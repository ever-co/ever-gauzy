import { EntityRepository } from '@mikro-orm/knex';
import { OrganizationTeamJoinRequest } from '../organization-team-join-request.entity';

export class MikroOrmOrganizationTeamJoinRequestRepository extends EntityRepository<OrganizationTeamJoinRequest> { }
