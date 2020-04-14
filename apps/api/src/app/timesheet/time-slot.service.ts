import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { TimeSlot } from './time-slot.entity';
import * as moment from 'moment';

@Injectable()
export class TimeSlotService extends CrudService<TimeSlot> {
	constructor(
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>
	) {
		super(timeSlotRepository);
	}

	bulkCreateOrUpdate(slots) {
		return this.timeSlotRepository
			.createQueryBuilder()
			.insert()
			.values(slots)
			.onConflict(
				'("employeeId", "startedAt") DO UPDATE SET "keyboard" = EXCLUDED.keyboard, "mouse" = EXCLUDED.mouse, "overall" = EXCLUDED.overall'
			)
			.returning('*')
			.execute();
	}

	bulkCreate(slots) {
		return this.timeSlotRepository
			.createQueryBuilder()
			.insert()
			.values(slots)
			.onConflict('("employeeId", "startedAt") DO NOTHING')
			.returning('*')
			.execute();
	}

	generateTimeSlots(start: Date, end: Date) {
		let mStart = moment(start);
		let mEnd = moment(end);
		const slots = [];
		while (mStart.isBefore(mEnd)) {
			let tempEnd: moment.Moment;
			let duration = 0;

			/* Check start time is Rounded 10 minutes slot I.E 10:20, false if 10:14 */
			if (mStart.get('minute') % 10 == 0) {
				tempEnd = mStart.clone().add(10, 'minute');
				duration = mStart.diff(tempEnd, 'seconds');
			} else {
				/* Calculate duearion for without round time IE. 10:14-10:20 */
				const tempStart = mStart
					.clone()
					.set(
						'minute',
						mStart.get('minute') - (mStart.minutes() % 10)
					);
				duration = tempStart.diff(start, 'seconds');
				mStart = tempStart;
				/* Added 10 min for next slot */
				tempEnd = mStart.clone().add(10, 'minute');
			}

			if (mEnd.isBefore(tempEnd)) {
				/* Calculate duearion for end time without round time IE. 10:20-10:28 */
				duration = mStart.diff(mEnd, 'seconds');
			}

			slots.push({
				startedAt: mStart.toDate(),
				stoppedAt: tempEnd.toDate(),
				duration: Math.abs(duration)
			});

			mStart = tempEnd.clone();
		}
		return slots;
	}
}
