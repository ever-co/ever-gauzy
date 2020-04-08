import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { Timesheet } from './timesheet.entity';
import * as moment from 'moment';

@Injectable()
export class TimeSheetService extends CrudService<Timesheet> {
	constructor(
		@InjectRepository(Timesheet)
		private readonly timeSheetRepository: Repository<Timesheet>
	) {
		super(timeSheetRepository);
	}

	async createOrFindTimeSheet(employeeId, date: Date = new Date()) {
		const from_date = moment(date).startOf('week');
		const to_date = moment(date).endOf('week');

		let timesheet = await this.timeSheetRepository.findOne({
			where: {
				startedAt: Between(from_date, to_date),
				employeeId: employeeId
			}
		});

		if (!timesheet) {
			timesheet = await this.timeSheetRepository.save({
				employeeId: employeeId,
				startedAt: from_date.toISOString(),
				stoppedAt: from_date.toISOString()
			});
		}
		return timesheet;
	}
}
