import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Unit } from '../unit.entity';

@Injectable()
export class TypeOrmUnitRepository extends Repository<Unit> {
	constructor(@InjectRepository(Unit) readonly repository: Repository<Unit>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
