import { Repository } from 'typeorm';
import { Timesheet } from '../timesheet.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class TypeOrmTimesheetRepository extends Repository<Timesheet> {
	constructor(@InjectRepository(Timesheet) readonly repository: Repository<Timesheet>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
