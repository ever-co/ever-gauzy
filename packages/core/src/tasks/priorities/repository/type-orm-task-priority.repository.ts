import { Repository } from 'typeorm';
import { TaskPriority } from '../priority.entity';

export class TypeOrmTaskPriorityRepository extends Repository<TaskPriority> { }
