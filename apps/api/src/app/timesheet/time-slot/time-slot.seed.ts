import * as faker from 'faker';
import { TimeSlot } from '../time-slot.entity';
import { generateTimeSlots } from './utils';

export function createTimeSlots(start, end) {
	const timeSlots: TimeSlot[] = generateTimeSlots(start, end).map(
		(timeSlot) => {
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
		}
	);

	return timeSlots;
}
