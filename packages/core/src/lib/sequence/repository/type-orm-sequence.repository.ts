import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sequence } from '../sequence.entity';

@Injectable()
export class TypeOrmSequenceRepository extends Repository<Sequence> {
	constructor(@InjectRepository(Sequence) readonly repository: Repository<Sequence>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
