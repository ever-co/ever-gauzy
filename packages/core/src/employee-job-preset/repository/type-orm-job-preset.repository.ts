import { Repository } from 'typeorm';
import { JobPreset } from '../job-preset.entity';

export class TypeOrmJobPresetRepository extends Repository<JobPreset> { }
