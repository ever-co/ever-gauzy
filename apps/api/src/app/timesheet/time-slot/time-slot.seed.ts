import * as faker from 'faker';
import * as moment from 'moment';
import { TimeSlot } from '../time-slot.entity';

export function createTimeSlots(start, end) {
	const timeSlots: TimeSlot[] = generateRange(start, end).map((timeSlot) => {
		const keyboard = faker.random.number(100);
		const mouse = faker.random.number(100);
		const overall = (keyboard + mouse) / 2;

		const slot = new TimeSlot();
		slot.startedAt = timeSlot.startedAt;
		slot.stoppedAt = timeSlot.stoppedAt;
		slot.duration = timeSlot.duration;
		slot.screenshots = [];
		slot.timeSlotMinutes = [];
		slot.keyboard = keyboard;
		slot.mouse = mouse;
		slot.overall = Math.ceil(overall);
		return slot;
	});

	return timeSlots;
}

function generateRange(start: Date, end: Date) {
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
				.set('minute', mStart.get('minute') - (mStart.minutes() % 10));

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
