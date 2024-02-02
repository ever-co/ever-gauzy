import { Repository } from 'typeorm';
import { OrganizationTeamJoinRequest } from '../organization-team-join-request.entity';

export class TypeOrmOrganizationTeamJoinRequestRepository extends Repository<OrganizationTeamJoinRequest> { }