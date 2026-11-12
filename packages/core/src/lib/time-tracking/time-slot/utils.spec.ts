import { generateTimeSlots } from './utils';

const iso = (date: Date) => date.toISOString();
const rows = (start: string, end: string) =>
	generateTimeSlots(new Date(start), new Date(end)).map((slot) => [
		iso(slot.startedAt),
		iso(slot.stoppedAt),
		slot.duration
	]);

describe('generateTimeSlots', () => {
	describe('inputs that keep their result', () => {
		it('splits an aligned range into whole 10-minute slots', () => {
			expect(rows('2026-01-05T10:20:00.000Z', '2026-01-05T10:40:00.000Z')).toEqual([
				['2026-01-05T10:20:00.000Z', '2026-01-05T10:30:00.000Z', 600],
				['2026-01-05T10:30:00.000Z', '2026-01-05T10:40:00.000Z', 600]
			]);
		});

		it('makes the first slot partial when the range starts inside it', () => {
			expect(rows('2026-01-05T10:25:00.000Z', '2026-01-05T10:40:00.000Z')).toEqual([
				['2026-01-05T10:20:00.000Z', '2026-01-05T10:30:00.000Z', 300],
				['2026-01-05T10:30:00.000Z', '2026-01-05T10:40:00.000Z', 600]
			]);
		});

		it('makes the last slot partial when the range ends inside it', () => {
			expect(rows('2026-01-05T10:20:00.000Z', '2026-01-05T10:34:00.000Z')).toEqual([
				['2026-01-05T10:20:00.000Z', '2026-01-05T10:30:00.000Z', 600],
				['2026-01-05T10:30:00.000Z', '2026-01-05T10:40:00.000Z', 240]
			]);
		});

		it('gives one slot for a range inside a single slot', () => {
			expect(rows('2026-01-05T10:22:00.000Z', '2026-01-05T10:27:00.000Z')).toEqual([
				['2026-01-05T10:20:00.000Z', '2026-01-05T10:30:00.000Z', 300]
			]);
		});

		it('gives no slot for an empty or reversed range', () => {
			expect(rows('2026-01-05T10:20:00.000Z', '2026-01-05T10:20:00.000Z')).toEqual([]);
			expect(rows('2026-01-05T10:30:00.000Z', '2026-01-05T10:20:00.000Z')).toEqual([]);
		});
	});

	describe('a range that starts or ends between whole seconds', () => {
		it('starts every slot on the minute, with no milliseconds left over', () => {
			const slots = generateTimeSlots(new Date('2026-01-05T10:25:30.512Z'), new Date('2026-01-05T10:48:10.250Z'));

			expect(slots.map((slot) => iso(slot.startedAt))).toEqual([
				'2026-01-05T10:20:00.000Z',
				'2026-01-05T10:30:00.000Z',
				'2026-01-05T10:40:00.000Z'
			]);
		});

		it('ends every slot on a 10-minute boundary, not on the range start seconds', () => {
			const slots = generateTimeSlots(new Date('2026-01-05T10:25:30.000Z'), new Date('2026-01-05T10:48:00.000Z'));

			expect(slots.map((slot) => iso(slot.stoppedAt))).toEqual([
				'2026-01-05T10:30:00.000Z',
				'2026-01-05T10:40:00.000Z',
				'2026-01-05T10:50:00.000Z'
			]);
		});

		it('never gives a slot more than 10 minutes, and keeps the range total', () => {
			const slots = generateTimeSlots(new Date('2026-01-05T10:30:30.000Z'), new Date('2026-01-05T10:45:00.000Z'));

			expect(slots.map((slot) => slot.duration)).toEqual([570, 300]);
			expect(slots.reduce((sum, slot) => sum + slot.duration, 0)).toBe(870);
		});

		it('lines the slot start up with the one a client sends for the same ten minutes', () => {
			const [slot] = generateTimeSlots(new Date('2026-01-05T10:25:30.512Z'), new Date('2026-01-05T10:28:00.000Z'));

			expect(slot.startedAt.getTime()).toBe(new Date('2026-01-05T10:20:00.000Z').getTime());
		});
	});
});
