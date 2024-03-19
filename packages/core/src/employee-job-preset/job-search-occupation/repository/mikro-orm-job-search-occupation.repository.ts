import { EntityRepository } from '@mikro-orm/knex';
import { JobSearchOccupation } from '../job-search-occupation.entity';

export class MikroOrmJobSearchOccupationRepository extends EntityRepository<JobSearchOccupation> { }
