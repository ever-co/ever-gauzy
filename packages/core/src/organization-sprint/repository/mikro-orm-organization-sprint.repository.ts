import { EntityRepository } from '@mikro-orm/core';
import { OrganizationSprint } from '../organization-sprint.entity';

export class MikroOrmOrganizationSprintRepository extends EntityRepository<OrganizationSprint> { }