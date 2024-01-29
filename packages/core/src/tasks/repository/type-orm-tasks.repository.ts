import { Repository } from 'typeorm';
import { Task } from '../task.entity';

export class TypeOrmTasksRepository extends Repository<Task> { }
