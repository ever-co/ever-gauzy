import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateSource } from '../candidate-source.entity';

@Injectable()
export class TypeOrmCandidateSourceRepository extends Repository<CandidateSource> {
    constructor(@InjectRepository(CandidateSource) readonly repository: Repository<CandidateSource>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
