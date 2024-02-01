import { Repository } from 'typeorm';
import { TimeOffRequest } from '../time-off-request.entity';

export class TypeOrmTimeOffRequestRepository extends Repository<TimeOffRequest> { }