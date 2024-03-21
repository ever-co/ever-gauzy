import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationGithubRepository } from '../github-repository.entity';

export class TypeOrmOrganizationGithubRepositoryRepository extends Repository<OrganizationGithubRepository> {
    constructor(
        @InjectRepository(OrganizationGithubRepository) readonly repository: Repository<OrganizationGithubRepository>
    ) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
