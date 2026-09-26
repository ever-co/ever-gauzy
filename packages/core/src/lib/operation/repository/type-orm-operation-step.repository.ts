import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperationStep } from '../operation-step.entity';

@Injectable()
export class TypeOrmOperationStepRepository extends Repository<OperationStep> {
	constructor(@InjectRepository(OperationStep) readonly repository: Repository<OperationStep>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
