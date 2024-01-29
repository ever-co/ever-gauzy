import { Repository } from 'typeorm';
import { TaskSize } from '../size.entity';

export class TypeOrmTaskSizeRepository extends Repository<TaskSize> { }
