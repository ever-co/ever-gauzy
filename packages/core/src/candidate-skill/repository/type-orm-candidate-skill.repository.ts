import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateSkill } from '../candidate-skill.entity';

@Injectable()
export class TypeOrmCandidateSkillRepository extends Repository<CandidateSkill> {
    constructor(@InjectRepository(CandidateSkill) readonly repository: Repository<CandidateSkill>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
