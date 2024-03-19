import { EntityRepository } from '@mikro-orm/knex';
import { OrganizationDepartment } from '../organization-department.entity';

export class MikroOrmOrganizationDepartmentRepository extends EntityRepository<OrganizationDepartment> { }
