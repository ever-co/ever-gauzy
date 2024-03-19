import { EntityRepository } from '@mikro-orm/knex';
import { OrganizationGithubRepository } from '../github-repository.entity';

export class MikroOrmOrganizationGithubRepositoryRepository extends EntityRepository<OrganizationGithubRepository> { }
