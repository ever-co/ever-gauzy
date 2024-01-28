import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from 'core/crud';
import { OrganizationGithubRepositoryIssue } from './github-repository-issue.entity';

@Injectable()
export class GithubRepositoryIssueService extends TenantAwareCrudService<OrganizationGithubRepositoryIssue> {
	constructor(
		@InjectRepository(OrganizationGithubRepositoryIssue)
		organizationGithubRepositoryIssue: Repository<OrganizationGithubRepositoryIssue>,
		@MikroInjectRepository(OrganizationGithubRepositoryIssue)
		mikroOrganizationGithubRepositoryIssue: EntityRepository<OrganizationGithubRepositoryIssue>
	) {
		super(organizationGithubRepositoryIssue, mikroOrganizationGithubRepositoryIssue);
	}
}
