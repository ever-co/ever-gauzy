import { Repository } from 'typeorm';
import { CandidateFeedback } from '../candidate-feedbacks.entity';

export class TypeOrmCandidateFeedbacksRepository extends Repository<CandidateFeedback> { }
