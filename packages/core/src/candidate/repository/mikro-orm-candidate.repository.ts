import { EntityRepository } from '@mikro-orm/knex';
import { Candidate } from '../candidate.entity';

export class MikroOrmCandidateRepository extends EntityRepository<Candidate> { }
