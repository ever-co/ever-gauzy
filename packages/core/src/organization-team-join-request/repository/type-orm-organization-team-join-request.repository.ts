import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationTeamJoinRequest } from '../organization-team-join-request.entity';

@Injectable()
export class TypeOrmOrganizationTeamJoinRequestRepository extends Repository<OrganizationTeamJoinRequest> {
    constructor(@InjectRepository(OrganizationTeamJoinRequest) readonly repository: Repository<OrganizationTeamJoinRequest>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
