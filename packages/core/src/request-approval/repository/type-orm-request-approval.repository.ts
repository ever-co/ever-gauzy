import { Repository } from 'typeorm';
import { RequestApproval } from '../request-approval.entity';

export class TypeOrmRequestApprovalRepository extends Repository<RequestApproval> { }