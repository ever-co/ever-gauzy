import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import * as moment from 'moment';
import { Timesheet } from './timesheet.entity';

@Injectable()
export class TimesheetService {
	constructor(
		@InjectRepository(Timesheet)
		private readonly timesheetRepository: Repository<Timesheet>
	) {}

	async createOrFindTimeSheet(employeeId, date: Date = new Date()) {
		const from_date = moment(date).startOf('week');
		const to_date = moment(date).endOf('week');

		let timesheet = await this.timesheetRepository.findOne({
			where: {
				startedAt: Between(from_date, to_date),
				employeeId: employeeId
			}
		});

		if (!timesheet) {
			timesheet = await this.timesheetRepository.save({
				employeeId: employeeId,
				startedAt: from_date.toISOString(),
				stoppedAt: from_date.toISOString()
			});
		}
		return timesheet;
	}
}
