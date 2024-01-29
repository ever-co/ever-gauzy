import { EntityRepository } from '@mikro-orm/core';
import { CandidateFeedback } from '../candidate-feedbacks.entity';

export class MikroOrmCandidateFeedbacksRepository extends EntityRepository<CandidateFeedback> { }
