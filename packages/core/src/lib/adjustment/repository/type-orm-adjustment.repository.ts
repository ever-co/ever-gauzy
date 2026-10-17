import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Adjustment } from '../adjustment.entity';

@Injectable()
export class TypeOrmAdjustmentRepository extends Repository<Adjustment> {
	constructor(@InjectRepository(Adjustment) readonly repository: Repository<Adjustment>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
