import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoalTemplate } from '../goal-template.entity';

@Injectable()
export class TypeOrmGoalTemplateRepository extends Repository<GoalTemplate> {
    constructor(@InjectRepository(GoalTemplate) readonly repository: Repository<GoalTemplate>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
