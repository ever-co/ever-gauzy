// cspell:ignore Kiritimati Pago
import {
	amountLeftToPay,
	earliestRemindedDueDate,
	INVOICE_REMINDER_GRACE_MS,
	invoiceReminderDueAt,
	latestRemindedDueDate
} from './invoice-reminder.rules';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/** The organization's time zone in most cases below: UTC+1 in November. */
const PARIS = 'Europe/Paris';
/** An invoice due on 20 November, saved as Paris midnight (the API's way); the forms save the end of the day. */
const DUE = new Date('2026-11-19T23:00:00.000Z');
/** Emailed to the client on 1 November. */
const EMAILED = new Date('2026-11-01T09:00:00.000Z');

const at = (offsetMs: number) => new Date(DUE.getTime() + offsetMs);
const dueAt = (dueDate: Date | string, emailedAt: Date | string, now: Date, timeZone = PARIS) =>
	invoiceReminderDueAt(dueDate, emailedAt, now, timeZone);

describe('invoiceReminderDueAt', () => {
	it('is due nothing before three days ahead of the due date', () => {
		expect(dueAt(DUE, EMAILED, at(-3 * DAY - HOUR))).toBeNull();
	});

	it.each([
		['three days before the due date', -3 * DAY, 1, false],
		['once the due day is over', DAY, 2, true],
		['seven days after it', 7 * DAY, 3, true],
		['fourteen days after it', 14 * DAY, 4, true]
	])('is due its reminder %s, and still an hour later', (_, offset, step, isOverdue) => {
		for (const now of [at(offset), at(offset + HOUR)]) {
			expect(dueAt(DUE, EMAILED, now)).toEqual({ step, at: DUE.getTime() + offset, isOverdue });
		}
	});

	it('is due no overdue reminder on the due day itself: the client still has the day to pay', () => {
		expect(dueAt(DUE, EMAILED, at(12 * HOUR))).toBeNull();
		expect(dueAt(DUE, EMAILED, at(DAY - 1))).toBeNull();
	});

	it('skips a reminder whose moment passed more than the grace ago, and nothing comes after the last one', () => {
		expect(dueAt(DUE, EMAILED, at(DAY + INVOICE_REMINDER_GRACE_MS))).not.toBeNull();
		expect(dueAt(DUE, EMAILED, at(DAY + INVOICE_REMINDER_GRACE_MS + 1))).toBeNull();
		expect(dueAt(DUE, EMAILED, at(14 * DAY + INVOICE_REMINDER_GRACE_MS + 1))).toBeNull();
		expect(dueAt(DUE, EMAILED, at(60 * DAY))).toBeNull();
	});

	it('is due only the latest step, never two at once', () => {
		// The reminders were turned on nine days after the due date: the second step's moment is long past
		expect(dueAt(DUE, EMAILED, at(9 * DAY))).toEqual(expect.objectContaining({ step: 3 }));
	});

	it('sends no reminder on the heels of the invoice: a step its email came less than a day before is skipped', () => {
		// Emailed two days before the due date: the reminder three days before it is skipped, the day after it goes
		const late = at(-2 * DAY);
		expect(dueAt(DUE, late, at(-2 * DAY + HOUR))).toBeNull();
		expect(dueAt(DUE, late, at(DAY))).toEqual(expect.objectContaining({ step: 2 }));
		// Emailed half a day before the due day was over: that step is skipped too, the next one goes
		const later = at(DAY - 12 * HOUR);
		expect(dueAt(DUE, later, at(DAY))).toBeNull();
		expect(dueAt(DUE, later, at(7 * DAY))).toEqual(expect.objectContaining({ step: 3 }));
	});

	it('reads the dates a driver hands back as text, a raw SQLite read as UTC without its zone', () => {
		expect(dueAt(DUE.toISOString(), EMAILED.toISOString(), at(DAY))).toEqual(
			expect.objectContaining({ step: 2, at: DUE.getTime() + DAY })
		);
		expect(dueAt('2026-11-19 23:00:00.000', '2026-11-01 09:00:00.000', at(DAY))).toEqual(
			expect.objectContaining({ step: 2, at: DUE.getTime() + DAY })
		);
	});

	it('is due nothing for a date it cannot read', () => {
		expect(dueAt('not a date', EMAILED, at(DAY))).toBeNull();
	});

	it('reads a due date the forms saved at the end of its day as that day, not the next one', () => {
		// 20 November 23:59:59.999 in Paris, as the add and edit forms save a picked 20 November
		const endOfDay = new Date('2026-11-20T22:59:59.999Z');

		expect(dueAt(endOfDay, EMAILED, at(-3 * DAY))).toEqual({
			step: 1,
			at: DUE.getTime() - 3 * DAY,
			isOverdue: false
		});
		// The due day is over: 21 November, 00:00 in Paris
		expect(dueAt(endOfDay, EMAILED, at(DAY))).toEqual({ step: 2, at: DUE.getTime() + DAY, isOverdue: true });
		expect(dueAt(endOfDay, EMAILED, at(DAY - 1))).toBeNull();
	});

	it.each([
		// zone, the end of 20 November there, 21 November's midnight there
		['America/New_York', '2026-11-21T04:59:59.999Z', '2026-11-21T05:00:00.000Z'],
		['Asia/Tokyo', '2026-11-20T14:59:59.999Z', '2026-11-20T15:00:00.000Z'],
		['UTC', '2026-11-20T23:59:59.999Z', '2026-11-21T00:00:00.000Z']
	])('sends the overdue reminder once the due day is over in the organization zone, %s', (zone, saved, over) => {
		const dayOver = new Date(over);

		expect(dueAt(saved, EMAILED, new Date(dayOver.getTime() - 1), zone)).toBeNull();
		expect(dueAt(saved, EMAILED, dayOver, zone)).toEqual({ step: 2, at: dayOver.getTime(), isOverdue: true });
	});

	it('counts the steps in calendar days across a clock change', () => {
		// Due on 27 March 2026 in Paris; the clocks go forward on the 29th, so 3 April starts at 22:00 UTC, not 23:00
		const due = new Date('2026-03-27T22:59:59.999Z');
		const april3 = new Date('2026-04-02T22:00:00.000Z');

		expect(dueAt(due, '2026-03-01T09:00:00.000Z', april3)).toEqual({
			step: 3,
			at: april3.getTime(),
			isOverdue: true
		});
	});
});

describe('the due dates a sweep reads', () => {
	it.each([
		['the start of December', new Date('2026-12-01T10:00:00.000Z')],
		['a week of clock changes', new Date('2026-03-31T10:00:00.000Z')],
		['the European autumn clock change', new Date('2026-10-26T00:30:00.000Z')]
	])('cover every invoice that may be due a reminder, in any time zone, around %s', (_, now) => {
		const earliest = earliestRemindedDueDate(now).getTime();
		const latest = latestRemindedDueDate(now).getTime();
		const emailed = new Date(now.getTime() - 60 * DAY);

		for (const zone of [
			'UTC',
			PARIS,
			'America/New_York',
			'Asia/Tokyo',
			'Pacific/Kiritimati',
			'Pacific/Pago_Pago'
		]) {
			for (let due = now.getTime() - 20 * DAY; due <= now.getTime() + 7 * DAY; due += 30 * 60 * 1000) {
				if (dueAt(new Date(due), emailed, now, zone)) {
					expect([zone, due >= earliest && due <= latest]).toEqual([zone, true]);
				}
			}
		}
		// And they stay close to the steps: the last one's grace, and the first one's whole day
		expect(now.getTime() - earliest).toBeLessThanOrEqual(16 * DAY + HOUR);
		expect(latest - now.getTime()).toBeLessThanOrEqual(4 * DAY + 2 * HOUR);
	});
});

describe('amountLeftToPay', () => {
	it.each([
		[1250, 0, 1250],
		['1250.00', '250.5', 999.5],
		[100.1, null, 100.1],
		[0.3, 0.1, 0.2]
	])('leaves %p less %p: %p', (total, paid, left) => {
		expect(amountLeftToPay(total, paid)).toBe(left);
	});

	it.each([
		[100, 100],
		[100, 120],
		[null, 0],
		[undefined, 0],
		['abc', 0]
	])('leaves nothing to pay of %p after %p', (total, paid) => {
		expect(amountLeftToPay(total as never, paid)).toBeNull();
	});
});
