import { EntityRepository } from '@mikro-orm/core';
import { RequestApproval } from '../request-approval.entity';

export class MikroOrmRequestApprovalRepository extends EntityRepository<RequestApproval> { }