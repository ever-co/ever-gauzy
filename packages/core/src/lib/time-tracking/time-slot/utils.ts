import * as moment from 'moment';
import { ID, IDateRange, ITimeLog, ITimeSlot } from '@gauzy/contracts';

/** A time slot covers the ten minutes from its start, as `TimeSlotSubscriber` sets its `stoppedAt`. */
const TIME_SLOT_MINUTES = 10;

/**
 * The end of the ten minutes a time slot covers.
 *
 * @param timeSlot - The time slot.
 */
export function timeSlotEnd(timeSlot: ITimeSlot): Date {
	const slotEnd = moment(timeSlot.startedAt).add(TIME_SLOT_MINUTES, 'minutes');
	return slotEnd.toDate();
}

/**
 * Whether time from `from` to `to` reaches into the ten minutes of a time slot.
 *
 * @param timeSlot - The time slot.
 * @param from - The start of the time.
 * @param to - The end of the time.
 */
export function reachesTimeSlot(timeSlot: ITimeSlot, from: Date, to: Date): boolean {
	const startsBeforeSlotEnds = moment(from).isBefore(timeSlotEnd(timeSlot));
	const endsAfterSlotStarts = moment(to).isAfter(timeSlot.startedAt);
	return startsBeforeSlotEnds && endsAfterSlotStarts;
}

/**
 * The milliseconds of the time from `from` to `to` that lie inside the ten minutes of a time slot.
 *
 * @param timeSlot - The time slot.
 * @param from - The start of the time.
 * @param to - The end of the time.
 */
export function timeInTimeSlot(timeSlot: ITimeSlot, from: Date, to: Date): number {
	const timeStart = moment.max(moment(timeSlot.startedAt), moment(from));
	const timeEnd = moment.min(moment(timeSlotEnd(timeSlot)), moment(to));
	const milliseconds = timeEnd.diff(timeStart);
	return Math.max(milliseconds, 0);
}

/**
 * The ids of the time slots the logs hold whose ten minutes the span reaches, each once.
 *
 * @param span - The span.
 * @param timeLogs - The logs, with their time slots.
 */
export function timeSlotIdsReachedBy(span: IDateRange, timeLogs: ITimeLog[] = []): ID[] {
	const timeSlots = timeLogs.flatMap((timeLog) => timeLog.timeSlots ?? []);
	const reached = timeSlots.filter((timeSlot) => reachesTimeSlot(timeSlot, span.start, span.end));
	const ids = reached.map((timeSlot) => timeSlot.id);
	return [...new Set(ids)];
}

/**
 * Generates time slots in 10-minute intervals between a start and end time.
 *
 * - If the start time is aligned with a 10-minute boundary (e.g., 10:20), a full 10-minute slot is created.
 * - If not, it adjusts the current slot to end at the next 10-minute boundary.
 * - The function handles partial slots if the end time falls within a slot.
 *
 * @param start The start time of the range
 * @param end The end time of the range
 * @returns An array of time slots with { startedAt, stoppedAt, duration }
 */
export function generateTimeSlots(start: Date, end: Date) {
	let mStart = moment(start);
	const mEnd = moment(end);

	const slots = [];
	while (mStart.isBefore(mEnd)) {
		let tempEnd: moment.Moment;
		let duration = 0;

		// Check if start time is aligned to a 10-minute boundary (e.g., 10:20)
		if (mStart.get('minute') % 10 === 0) {
			tempEnd = mStart.clone().add(10, 'minute');
			duration = tempEnd.isBefore(mEnd) ? tempEnd.diff(mStart, 'seconds') : mEnd.diff(mStart, 'seconds');
		} else {
			// Align to previous 10-minute boundary
			const tempStart = mStart.clone().set('minute', mStart.get('minute') - (mStart.minutes() % 10));
			tempEnd = tempStart.clone().add(10, 'minute');

			duration = mEnd.isBefore(tempEnd) ? mEnd.diff(mStart, 'seconds') : tempEnd.diff(mStart, 'seconds');

			mStart = tempStart;
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
