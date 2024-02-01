import { Repository } from 'typeorm';
import { TaskEstimation } from '../task-estimation.entity';

export class TypeOrmTaskEstimationRepository extends Repository<TaskEstimation> { }
