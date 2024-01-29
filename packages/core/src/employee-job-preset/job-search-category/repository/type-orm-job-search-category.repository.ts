import { Repository } from 'typeorm';
import { JobSearchCategory } from '../job-search-category.entity';

export class TypeOrmJobPresetRepository extends Repository<JobSearchCategory> { }
