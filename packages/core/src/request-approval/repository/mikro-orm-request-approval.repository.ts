import { EntityRepository } from '@mikro-orm/knex';
import { RequestApproval } from '../request-approval.entity';

export class MikroOrmRequestApprovalRepository extends EntityRepository<RequestApproval> { }
