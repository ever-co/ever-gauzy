import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Candidate } from '../candidate.entity';

@Injectable()
export class TypeOrmCandidateRepository extends Repository<Candidate> {
    constructor(@InjectRepository(Candidate) readonly repository: Repository<Candidate>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
