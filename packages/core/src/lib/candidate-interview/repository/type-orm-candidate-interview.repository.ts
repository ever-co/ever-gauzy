import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateInterview } from '../candidate-interview.entity';

@Injectable()
export class TypeOrmCandidateInterviewRepository extends Repository<CandidateInterview> {
    constructor(@InjectRepository(CandidateInterview) readonly repository: Repository<CandidateInterview>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
