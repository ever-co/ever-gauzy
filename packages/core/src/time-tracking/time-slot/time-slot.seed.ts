import { faker } from '@faker-js/faker';
import { generateTimeSlots } from './utils';
import { TimeSlot } from './time-slot.entity';

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
export function createTimeSlots(start: Date, end: Date): TimeSlot[] {
	return generateTimeSlots(start, end).map(({ duration, startedAt, stoppedAt }) => {
		const keyboard = faker.number.int(duration); // Randomly generate keyboard activity based on duration
		const mouse = faker.number.int(duration); // Randomly generate mouse activity based on duration
		const overall = Math.ceil((keyboard + mouse) / 2); // Calculate the average activity

		const slot = new TimeSlot();
		slot.startedAt = startedAt; // Set the start time of the time slot
		slot.stoppedAt = stoppedAt; // Set the end time of the time slot
		slot.duration = duration; // Set the duration of the time slot
		slot.screenshots = []; // Initialize an empty array for screenshots
		slot.timeSlotMinutes = []; // Initialize an empty array for time slot minutes
		slot.keyboard = keyboard; // Set the keyboard activity
		slot.mouse = mouse; // Set the mouse activity
		slot.overall = overall; // Set the overall activity (rounded)

		return slot; // Return the constructed TimeSlot object
	});
}
