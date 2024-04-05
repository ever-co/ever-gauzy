import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateInterviewers } from '../candidate-interviewers.entity';

@Injectable()
export class TypeOrmCandidateInterviewersRepository extends Repository<CandidateInterviewers> {
    constructor(@InjectRepository(CandidateInterviewers) readonly repository: Repository<CandidateInterviewers>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
