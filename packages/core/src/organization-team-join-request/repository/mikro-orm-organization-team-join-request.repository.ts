import { EntityRepository } from '@mikro-orm/core';
import { OrganizationTeamJoinRequest } from '../organization-team-join-request.entity';

export class MikroOrmOrganizationTeamJoinRequestRepository extends EntityRepository<OrganizationTeamJoinRequest> { }