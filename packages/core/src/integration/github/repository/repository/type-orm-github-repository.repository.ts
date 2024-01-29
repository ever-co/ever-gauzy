import { Repository } from 'typeorm';
import { OrganizationGithubRepository } from '../github-repository.entity';

export class TypeOrmOrganizationGithubRepositoryRepository extends Repository<OrganizationGithubRepository> { }
