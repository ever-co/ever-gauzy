import * as moment from 'moment';

export function generateTimeSlots(start: Date, end: Date) {
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

		mStart.set('second', 0);
		mStart.set('second', 0);
		mEnd.set('millisecond', 0);
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
