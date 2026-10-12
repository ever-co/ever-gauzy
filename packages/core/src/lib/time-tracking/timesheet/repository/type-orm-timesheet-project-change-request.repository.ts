import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimesheetProjectChangeRequest } from '../timesheet-project-change-request.entity';

@Injectable()
export class TypeOrmTimesheetProjectChangeRequestRepository extends Repository<TimesheetProjectChangeRequest> {
	constructor(
		@InjectRepository(TimesheetProjectChangeRequest) readonly repository: Repository<TimesheetProjectChangeRequest>
	) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
