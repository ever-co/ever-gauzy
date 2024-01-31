import { Repository } from 'typeorm';
import { Task } from '../task.entity';

export class TypeOrmTaskRepository extends Repository<Task> { }
