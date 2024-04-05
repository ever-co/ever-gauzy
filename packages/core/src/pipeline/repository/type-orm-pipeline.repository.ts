import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pipeline } from '../pipeline.entity';

@Injectable()
export class TypeOrmPipelineRepository extends Repository<Pipeline> {
    constructor(@InjectRepository(Pipeline) readonly repository: Repository<Pipeline>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
