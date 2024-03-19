import { EntityRepository } from '@mikro-orm/knex';
import { CandidateFeedback } from '../candidate-feedbacks.entity';

export class MikroOrmCandidateFeedbackRepository extends EntityRepository<CandidateFeedback> { }
