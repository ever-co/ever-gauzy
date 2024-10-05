import { faker } from '@faker-js/faker';
import { TimeSlot } from './time-slot.entity';
import { generateTimeSlots } from './utils';

/**
 * Generates an array of time slots between the provided start and end times.
 *
 * This function generates time slots using the `generateTimeSlots` function,
 * which creates slot data with a duration, start time, and end time. For each
 * time slot, the function randomly generates keyboard and mouse activity
 * using Faker, calculates the overall activity, and constructs a `TimeSlot` object.
 *
 * @param start - The starting time of the time slots (as a Date object).
 * @param end - The ending time of the time slots (as a Date object).
 * @returns An array of `TimeSlot` objects containing the generated time slots.
 */
export function createTimeSlots(start, end) {
	const timeSlots: TimeSlot[] = generateTimeSlots(start, end).map(({ duration, startedAt, stoppedAt }) => {
		const keyboard = faker.number.int(duration);
		const mouse = faker.number.int(duration);
		const overall = (keyboard + mouse) / 2;

		const slot = new TimeSlot();
		slot.startedAt = startedAt;
		slot.stoppedAt = stoppedAt;
		slot.duration = duration;
		slot.screenshots = [];
		slot.timeSlotMinutes = [];
		slot.keyboard = keyboard;
		slot.mouse = mouse;
		slot.overall = Math.ceil(overall);
		return slot;
	});

	return timeSlots;
}
