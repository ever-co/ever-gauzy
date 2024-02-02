import { Repository } from 'typeorm';
import { JobSearchCategory } from '../job-search-category.entity';

export class TypeOrmJobSearchCategoryRepository extends Repository<JobSearchCategory> { }
