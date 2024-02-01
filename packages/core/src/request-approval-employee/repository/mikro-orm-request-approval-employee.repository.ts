import { EntityRepository } from '@mikro-orm/core';
import { RequestApprovalEmployee } from '../request-approval-employee.entity';

export class MikroOrmRequestApprovalEmployeeRepository extends EntityRepository<RequestApprovalEmployee> { }