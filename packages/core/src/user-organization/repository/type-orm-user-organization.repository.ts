import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserOrganization } from '../user-organization.entity';

export class TypeOrmUserOrganizationRepository extends Repository<UserOrganization> {
    constructor(
        @InjectRepository(UserOrganization) readonly repository: Repository<UserOrganization>
    ) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
