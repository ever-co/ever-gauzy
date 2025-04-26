import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskProjectSequence } from '../project-sequence.entity';

@Injectable()
export class TypeOrmTaskProjectSequenceRepository extends Repository<TaskProjectSequence> {
	constructor(@InjectRepository(TaskProjectSequence) readonly repository: Repository<TaskProjectSequence>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
