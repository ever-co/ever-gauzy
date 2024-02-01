import { EntityRepository } from '@mikro-orm/core';
import { OrganizationProject } from '../organization-project.entity';

export class MikroOrmOrganizationProjectRepository extends EntityRepository<OrganizationProject> { }