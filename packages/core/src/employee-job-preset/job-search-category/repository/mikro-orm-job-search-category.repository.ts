import { EntityRepository } from '@mikro-orm/core';
import { JobSearchCategory } from '../job-search-category.entity';

export class MikroOrmJobSearchCategoryRepository extends EntityRepository<JobSearchCategory> { }
