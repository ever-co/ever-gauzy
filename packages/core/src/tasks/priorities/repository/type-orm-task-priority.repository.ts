import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskPriority } from '../priority.entity';

@Injectable()
export class TypeOrmTaskPriorityRepository extends Repository<TaskPriority> {
    constructor(@InjectRepository(TaskPriority) readonly repository: Repository<TaskPriority>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
