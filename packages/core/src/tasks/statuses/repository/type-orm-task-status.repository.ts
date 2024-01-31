import { Repository } from 'typeorm';
import { TaskStatus } from '../status.entity';

export class TypeOrmTaskStatusRepository extends Repository<TaskStatus> { }
