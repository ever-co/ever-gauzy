import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationTeam } from '../organization-team.entity';

export class TypeOrmOrganizationTeamRepository extends Repository<OrganizationTeam> {

    constructor(
        @InjectRepository(OrganizationTeam) readonly repository: Repository<OrganizationTeam>
    ) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
