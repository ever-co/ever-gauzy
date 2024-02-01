import { EntityRepository } from '@mikro-orm/core';
import { OrganizationDepartment } from '../organization-department.entity';

export class MikroOrmOrganizationDepartmentRepository extends EntityRepository<OrganizationDepartment> { }