import { EntityRepository } from '@mikro-orm/core';
import { OrganizationGithubRepository } from '../github-repository.entity';

export class MikroOrmOrganizationGithubRepositoryRepository extends EntityRepository<OrganizationGithubRepository> { }
