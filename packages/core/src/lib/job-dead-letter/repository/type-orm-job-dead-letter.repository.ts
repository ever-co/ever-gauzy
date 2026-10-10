import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobDeadLetter } from '../job-dead-letter.entity';

@Injectable()
export class TypeOrmJobDeadLetterRepository extends Repository<JobDeadLetter> {
	constructor(@InjectRepository(JobDeadLetter) readonly repository: Repository<JobDeadLetter>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
