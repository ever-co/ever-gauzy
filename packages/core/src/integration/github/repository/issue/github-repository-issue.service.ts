import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '../../../../core/crud';
import { OrganizationGithubRepositoryIssue } from './github-repository-issue.entity';
import { TypeOrmOrganizationGithubRepositoryIssueRepository } from './repository/type-orm-github-repository-issue.repository';
import { MikroOrmOrganizationGithubRepositoryIssueRepository } from './repository/mikro-orm-github-repository-issue.repository';

@Injectable()
export class GithubRepositoryIssueService extends TenantAwareCrudService<OrganizationGithubRepositoryIssue> {
	constructor(
		typeOrmOrganizationGithubRepositoryIssueRepository: TypeOrmOrganizationGithubRepositoryIssueRepository,
		mikroOrmOrganizationGithubRepositoryIssueRepository: MikroOrmOrganizationGithubRepositoryIssueRepository
	) {
		super(typeOrmOrganizationGithubRepositoryIssueRepository, mikroOrmOrganizationGithubRepositoryIssueRepository);
	}
}
