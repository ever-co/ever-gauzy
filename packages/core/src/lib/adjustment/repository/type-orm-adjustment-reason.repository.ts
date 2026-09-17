import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdjustmentReason } from '../adjustment-reason.entity';

@Injectable()
export class TypeOrmAdjustmentReasonRepository extends Repository<AdjustmentReason> {
	constructor(@InjectRepository(AdjustmentReason) readonly repository: Repository<AdjustmentReason>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
