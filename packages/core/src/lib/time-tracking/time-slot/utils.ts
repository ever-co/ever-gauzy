import * as moment from 'moment';

export function generateTimeSlots(start: Date, end: Date, previousTime = 0) {
	let remainFromPreviousTime = previousTime;
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
			/* Calculate duration for without round time IE. 10:14-10:20 */
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

		// Prevent adding the same previous saved time to the time slot again
		if (remainFromPreviousTime > 0) {
			if (duration >= remainFromPreviousTime) {
				duration = duration - remainFromPreviousTime;
				remainFromPreviousTime = 0;
			} else {
				remainFromPreviousTime = remainFromPreviousTime - duration;
				duration = 0;
			}
		}

		mStart.set('second', 0);
		mEnd.set('millisecond', 0);

		slots.push({
			startedAt: mStart.toDate(),
			stoppedAt: tempEnd.toDate(),
			duration: Math.abs(duration)
		});

		mStart = tempEnd.clone();
	}
	return slots;
}

/**
 * GET start and end point of 10 minutes interval
 *
 * @param start
 * @param end
 * @returns
 */
export function getStartEndIntervals(
	start: moment.Moment,
	end: moment.Moment
): {
	start: string | Date,
	end: string | Date
} {
	let startMinute = moment(start).utc().get('minute');
	startMinute = startMinute - (startMinute % 10);

	const startDate = moment(start)
		.utc()
		.set('minute', startMinute)
		.set('second', 0)
		.set('millisecond', 0);

	let endMinute = moment(end).utc().get('minute');
	endMinute = endMinute - (endMinute % 10);

	const endDate = moment(end)
		.utc()
		.set('minute', endMinute + 10)
		.set('second', 0)
		.set('millisecond', 0);

	return {
		start: startDate.toDate(),
		end: endDate.toDate()
	}
}
