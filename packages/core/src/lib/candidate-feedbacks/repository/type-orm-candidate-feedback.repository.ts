import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateFeedback } from '../candidate-feedbacks.entity';

@Injectable()
export class TypeOrmCandidateFeedbackRepository extends Repository<CandidateFeedback> {
    constructor(@InjectRepository(CandidateFeedback) readonly repository: Repository<CandidateFeedback>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
