import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PickListLine } from '../pick-list-line.entity';

@Injectable()
export class TypeOrmPickListLineRepository extends Repository<PickListLine> {
	constructor(@InjectRepository(PickListLine) readonly repository: Repository<PickListLine>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
