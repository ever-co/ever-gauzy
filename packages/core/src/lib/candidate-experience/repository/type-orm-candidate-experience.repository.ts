import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateExperience } from '../candidate-experience.entity';

@Injectable()
export class TypeOrmCandidateExperienceRepository extends Repository<CandidateExperience> {
    constructor(@InjectRepository(CandidateExperience) readonly repository: Repository<CandidateExperience>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
