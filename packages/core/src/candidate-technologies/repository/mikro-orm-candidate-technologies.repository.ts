import { EntityRepository } from '@mikro-orm/knex';
import { CandidateTechnologies } from '../candidate-technologies.entity';

export class MikroOrmCandidateTechnologiesRepository extends EntityRepository<CandidateTechnologies> { }
