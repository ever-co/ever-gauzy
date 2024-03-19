import { EntityRepository } from '@mikro-orm/knex';
import { OrganizationTeamEmployee } from '../organization-team-employee.entity';

export class MikroOrmOrganizationTeamEmployeeRepository extends EntityRepository<OrganizationTeamEmployee> { }
