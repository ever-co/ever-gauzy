import { Repository } from 'typeorm';
import { JobSearchOccupation } from '../job-search-occupation.entity';

export class TypeOrmJobSearchOccupationRepository extends Repository<JobSearchOccupation> { }
