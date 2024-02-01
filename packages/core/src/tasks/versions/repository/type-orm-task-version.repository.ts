import { Repository } from 'typeorm';
import { TaskVersion } from '../version.entity';

export class TypeOrmTaskVersionRepository extends Repository<TaskVersion> { }
