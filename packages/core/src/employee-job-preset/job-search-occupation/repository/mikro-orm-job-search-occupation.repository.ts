import { EntityRepository } from '@mikro-orm/core';
import { JobSearchOccupation } from '../job-search-occupation.entity';

export class MikroOrmJobSearchOccupationRepository extends EntityRepository<JobSearchOccupation> { }
