import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { OrganizationGithubRepository } from '../github-repository.entity';

export class MikroOrmOrganizationGithubRepositoryRepository extends MikroOrmBaseEntityRepository<OrganizationGithubRepository> {}
