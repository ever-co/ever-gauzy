import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationGithubRepositoryIssue } from '../github-repository-issue.entity';

export class TypeOrmOrganizationGithubRepositoryIssueRepository extends Repository<OrganizationGithubRepositoryIssue> {
    constructor(
        @InjectRepository(OrganizationGithubRepositoryIssue) readonly repository: Repository<OrganizationGithubRepositoryIssue>
    ) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
