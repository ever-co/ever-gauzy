import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoalKPITemplate } from '../goal-kpi-template.entity';

@Injectable()
export class TypeOrmGoalKPITemplateRepository extends Repository<GoalKPITemplate> {
    constructor(@InjectRepository(GoalKPITemplate) readonly repository: Repository<GoalKPITemplate>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
