import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateEducation } from '../candidate-education.entity';

@Injectable()
export class TypeOrmCandidateEducationRepository extends Repository<CandidateEducation> {
    constructor(@InjectRepository(CandidateEducation) readonly repository: Repository<CandidateEducation>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
