import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Skill } from '../skill.entity';

@Injectable()
export class TypeOrmSkillRepository extends Repository<Skill> {
    constructor(@InjectRepository(Skill) readonly repository: Repository<Skill>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
