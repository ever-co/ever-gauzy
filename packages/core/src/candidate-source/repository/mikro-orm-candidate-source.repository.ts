import { EntityRepository } from '@mikro-orm/knex';
import { CandidateSource } from '../candidate-source.entity';

export class MikroOrmCandidateSourceRepository extends EntityRepository<CandidateSource> { }
