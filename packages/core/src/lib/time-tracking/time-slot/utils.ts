import * as moment from 'moment';

/**
 * Generates time slots in 10-minute intervals between a start and end time.
 *
 * - Every slot starts and ends on a 10-minute boundary (e.g., 10:20:00.000 to 10:30:00.000), whatever seconds or
 *   milliseconds the range starts at. Slots are matched by their exact start (input slots are merged into the
 *   generated ones, and existing slots are looked up by it), so a start that kept the range's milliseconds
 *   never matched the slot a client sent for the same ten minutes.
 * - `duration` is the part of the range inside the slot, in whole seconds, so the first and last slots can be partial.
 *
 * @param start The start time of the range
 * @param end The end time of the range
 * @returns An array of time slots with { startedAt, stoppedAt, duration }
 */
export function generateTimeSlots(start: Date, end: Date) {
	const mEnd = moment(end);
	let cursor = moment(start);

	const slots = [];
	while (cursor.isBefore(mEnd)) {
		// The 10-minute boundary at or before the cursor
		const slotStart = cursor.clone().startOf('minute');
		slotStart.set('minute', slotStart.get('minute') - (slotStart.get('minute') % 10));
		const slotEnd = slotStart.clone().add(10, 'minute');

		const countedTo = mEnd.isBefore(slotEnd) ? mEnd : slotEnd;

		slots.push({
			startedAt: slotStart.toDate(),
			stoppedAt: slotEnd.toDate(),
			duration: countedTo.diff(cursor, 'seconds')
		});

		cursor = slotEnd;
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
	start: string | Date;
	end: string | Date;
} {
	let startMinute = moment(start).utc().get('minute');
	startMinute = startMinute - (startMinute % 10);

	const startDate: any = moment(start).utc().set('minute', startMinute).set('second', 0).set('millisecond', 0);

	let endMinute = moment(end).utc().get('minute');
	endMinute = endMinute - (endMinute % 10);

	let endDate: any = moment(end)
		.utc()
		.set('minute', endMinute + 10)
		.set('second', 0)
		.set('millisecond', 0);

	return {
		start: startDate,
		end: endDate
	};
}
