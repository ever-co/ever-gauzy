import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidatePersonalQualities } from '../candidate-personal-qualities.entity';

@Injectable()
export class TypeOrmCandidatePersonalQualitiesRepository extends Repository<CandidatePersonalQualities> {
    constructor(@InjectRepository(CandidatePersonalQualities) readonly repository: Repository<CandidatePersonalQualities>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
