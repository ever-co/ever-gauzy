import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateTechnologies } from '../candidate-technologies.entity';

@Injectable()
export class TypeOrmCandidateTechnologiesRepository extends Repository<CandidateTechnologies> {
    constructor(@InjectRepository(CandidateTechnologies) readonly repository: Repository<CandidateTechnologies>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
