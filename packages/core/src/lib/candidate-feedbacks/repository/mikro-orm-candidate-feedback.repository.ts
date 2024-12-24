import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { CandidateFeedback } from '../candidate-feedbacks.entity';

export class MikroOrmCandidateFeedbackRepository extends MikroOrmBaseEntityRepository<CandidateFeedback> { }
