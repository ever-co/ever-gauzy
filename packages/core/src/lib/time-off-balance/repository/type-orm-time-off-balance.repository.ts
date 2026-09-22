import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeOffBalance } from '../time-off-balance.entity';

@Injectable()
export class TypeOrmTimeOffBalanceRepository extends Repository<TimeOffBalance> {
	constructor(@InjectRepository(TimeOffBalance) readonly repository: Repository<TimeOffBalance>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
