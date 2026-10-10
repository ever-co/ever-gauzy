import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Operation } from '../operation.entity';

@Injectable()
export class TypeOrmOperationRepository extends Repository<Operation> {
	constructor(@InjectRepository(Operation) readonly repository: Repository<Operation>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
