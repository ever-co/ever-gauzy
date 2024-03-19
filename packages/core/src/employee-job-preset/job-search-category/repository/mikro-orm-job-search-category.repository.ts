import { EntityRepository } from '@mikro-orm/knex';
import { JobSearchCategory } from '../job-search-category.entity';

export class MikroOrmJobSearchCategoryRepository extends EntityRepository<JobSearchCategory> { }
