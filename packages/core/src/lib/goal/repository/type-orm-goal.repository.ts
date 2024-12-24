import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Goal } from '../goal.entity';

@Injectable()
export class TypeOrmGoalRepository extends Repository<Goal> {
    constructor(@InjectRepository(Goal) readonly repository: Repository<Goal>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
