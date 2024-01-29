import { Repository } from 'typeorm';
import { JobPreset } from '../job-preset.entity';

export class TypeOrmEmployeeJobPresetRepository extends Repository<JobPreset> { }
