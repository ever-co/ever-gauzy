import { EntityRepository } from '@mikro-orm/core';
import { CandidateFeedback } from '../candidate-feedbacks.entity';

export class MikroOrmCandidateFeedbackRepository extends EntityRepository<CandidateFeedback> { }
