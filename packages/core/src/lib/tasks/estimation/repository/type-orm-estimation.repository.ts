import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEstimation } from '../task-estimation.entity';

@Injectable()
export class TypeOrmTaskEstimationRepository extends Repository<TaskEstimation> {
    constructor(@InjectRepository(TaskEstimation) readonly repository: Repository<TaskEstimation>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
