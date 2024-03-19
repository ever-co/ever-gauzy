import { EntityRepository } from '@mikro-orm/knex';
import { OrganizationGithubRepositoryIssue } from '../github-repository-issue.entity';

export class MikroOrmOrganizationGithubRepositoryIssueRepository extends EntityRepository<OrganizationGithubRepositoryIssue> { }
