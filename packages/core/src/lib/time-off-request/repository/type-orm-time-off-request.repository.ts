import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeOffRequest } from '../time-off-request.entity';

@Injectable()
export class TypeOrmTimeOffRequestRepository extends Repository<TimeOffRequest> {
	constructor(@InjectRepository(TimeOffRequest) readonly repository: Repository<TimeOffRequest>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
