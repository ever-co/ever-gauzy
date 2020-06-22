import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
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
		if (slots.length === 0) {
			return null;
		}
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
		if (slots.length === 0) {
			return null;
		}
		return this.timeSlotRepository
			.createQueryBuilder()
			.insert()
			.values(slots)
			.onConflict('("employeeId", "startedAt") DO NOTHING')
			.returning('*')
			.execute();
	}

	rangeDelete(employeeId: string, start: Date, stop: Date) {
		return this.timeSlotRepository.delete({
			employeeId: employeeId,
			startedAt: Between(start, stop)
		});
	}

	generateTimeSlots(start: Date, end: Date) {
		let mStart = moment(start);
		const mEnd = moment(end);
		const slots = [];
		while (mStart.isBefore(mEnd)) {
			let tempEnd: moment.Moment;
			let duration = 0;

			/* Check start time is Rounded 10 minutes slot I.E 10:20, false if 10:14 */
			if (mStart.get('minute') % 10 === 0) {
				tempEnd = mStart.clone().add(10, 'minute');
				if (tempEnd.isBefore(mEnd)) {
					duration = tempEnd.diff(mStart, 'seconds');
				} else {
					duration = mEnd.diff(mStart, 'seconds');
				}
			} else {
				/* Calculate duearion for without round time IE. 10:14-10:20 */
				const tempStart = mStart
					.clone()
					.set(
						'minute',
						mStart.get('minute') - (mStart.minutes() % 10)
					);

				/* Added 10 min for next slot */
				tempEnd = tempStart.clone().add(10, 'minute');

				if (mEnd.isBefore(tempEnd)) {
					duration = mEnd.diff(mStart, 'seconds');
				} else {
					duration = tempEnd.diff(mStart, 'seconds');
				}
				mStart = tempStart;
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
