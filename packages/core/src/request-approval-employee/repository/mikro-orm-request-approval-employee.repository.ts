import { EntityRepository } from '@mikro-orm/knex';
import { RequestApprovalEmployee } from '../request-approval-employee.entity';

export class MikroOrmRequestApprovalEmployeeRepository extends EntityRepository<RequestApprovalEmployee> { }
