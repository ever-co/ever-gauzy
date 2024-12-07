import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Candidate } from '../candidate.entity';

export class MikroOrmCandidateRepository extends MikroOrmBaseEntityRepository<Candidate> { }
