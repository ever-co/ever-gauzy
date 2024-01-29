import { Repository } from 'typeorm';
import { CandidateFeedback } from '../candidate-feedbacks.entity';

export class TypeOrmCandidateFeedbackRepository extends Repository<CandidateFeedback> { }
