import { EntityRepository } from '@mikro-orm/core';
import { OrganizationTeamEmployee } from '../organization-team-employee.entity';

export class MikroOrmOrganizationTeamEmployeeRepository extends EntityRepository<OrganizationTeamEmployee> { }