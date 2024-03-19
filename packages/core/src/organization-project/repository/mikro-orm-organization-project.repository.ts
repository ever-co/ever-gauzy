import { EntityRepository } from '@mikro-orm/knex';
import { OrganizationProject } from '../organization-project.entity';

export class MikroOrmOrganizationProjectRepository extends EntityRepository<OrganizationProject> { }
