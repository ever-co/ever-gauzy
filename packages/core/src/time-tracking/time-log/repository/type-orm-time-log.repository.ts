import { Repository } from 'typeorm';
import { TimeLog } from '../time-log.entity';

export class TypeOrmTimeLogRepository extends Repository<TimeLog> { }