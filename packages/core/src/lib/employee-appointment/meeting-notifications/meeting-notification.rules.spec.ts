import { EmployeeAppointmentStatus } from '@gauzy/contracts';
import {
	DEFAULT_MEETING_REMINDER_MINUTES,
	isMeetingChangeWorthTelling,
	isMeetingScheduled,
	knownTimeZoneOf,
	meetingNotice,
	meetingReminderLevelAt,
	meetingReminderMinutesOf,
	meetingWhenText,
	quotedAgendaOf
} from './meeting-notification.rules';

const MINUTE = 60 * 1000;
const START = Date.parse('2026-11-12T13:00:00.000Z');
const END = Date.parse('2026-11-12T13:45:00.000Z');

describe('meeting notification rules', () => {
	describe('meetingReminderMinutesOf', () => {
		it('reads 15 minutes when the employee chose nothing', () => {
			expect(meetingReminderMinutesOf(undefined)).toBe(DEFAULT_MEETING_REMINDER_MINUTES);
			expect(meetingReminderMinutesOf({})).toBe(15);
			expect(meetingReminderMinutesOf('')).toBe(15);
		});

		it('reads the lead the employee chose, from the object or its JSON', () => {
			expect(meetingReminderMinutesOf({ meetingReminderMinutes: 30 })).toBe(30);
			expect(meetingReminderMinutesOf(JSON.stringify({ meetingReminderMinutes: 5 }))).toBe(5);
			expect(meetingReminderMinutesOf({ meetingReminderMinutes: 1440 })).toBe(1440);
		});

		it('reads null or 0 as no reminder before the meeting', () => {
			expect(meetingReminderMinutesOf({ meetingReminderMinutes: null })).toBeNull();
			expect(meetingReminderMinutesOf({ meetingReminderMinutes: 0 })).toBeNull();
		});

		it('reads a lead that is no whole number of minutes in (0, 1440] as the default', () => {
			for (const minutes of [-5, 1441, 2.5, Number.NaN, '10', true]) {
				expect(meetingReminderMinutesOf({ meetingReminderMinutes: minutes })).toBe(15);
			}
		});
	});

	describe('meetingReminderLevelAt', () => {
		it('is due nothing before the lead', () => {
			expect(meetingReminderLevelAt(START - 16 * MINUTE, START, 15)).toBe(0);
		});

		it('is due the reminder from the lead to the minute before the start', () => {
			expect(meetingReminderLevelAt(START - 15 * MINUTE, START, 15)).toBe(1);
			expect(meetingReminderLevelAt(START - 2 * MINUTE, START, 15)).toBe(1);
			expect(meetingReminderLevelAt(START - MINUTE - 1, START, 15)).toBe(1);
		});

		it('is due the notice that it starts from a minute before the start to five minutes after it', () => {
			expect(meetingReminderLevelAt(START - MINUTE, START, 15)).toBe(2);
			expect(meetingReminderLevelAt(START, START, 15)).toBe(2);
			expect(meetingReminderLevelAt(START + 5 * MINUTE - 1, START, 15)).toBe(2);
			expect(meetingReminderLevelAt(START + 5 * MINUTE, START, 15)).toBe(0);
		});

		it('leaves only the notice at the start to someone who wants no reminder before', () => {
			expect(meetingReminderLevelAt(START - 10 * MINUTE, START, null)).toBe(0);
			expect(meetingReminderLevelAt(START - MINUTE, START, null)).toBe(2);
		});

		it('is due nothing for a time it cannot read', () => {
			expect(meetingReminderLevelAt(Number.NaN, START, 15)).toBe(0);
			expect(meetingReminderLevelAt(START, Number.NaN, 15)).toBe(0);
		});
	});

	describe('meetingWhenText', () => {
		it("says when the meeting runs in the receiver's time zone, and names the zone", () => {
			expect(meetingWhenText(new Date(START), new Date(END), 'Europe/Paris')).toBe(
				'Thursday, November 12, 2026, 2:00 – 2:45 PM (Europe/Paris)'
			);
			expect(meetingWhenText(new Date(START), new Date(END), 'America/New_York')).toBe(
				'Thursday, November 12, 2026, 8:00 – 8:45 AM (America/New_York)'
			);
		});

		it('reads a time stored without its zone (SQLite) as UTC, and an unknown zone as UTC', () => {
			expect(meetingWhenText('2026-11-12 13:00:00.000', '2026-11-12 13:45:00.000', 'Nowhere/Else')).toBe(
				'Thursday, November 12, 2026, 1:00 – 1:45 PM (UTC)'
			);
			expect(knownTimeZoneOf(null)).toBe('UTC');
		});

		it('names the start alone when the end is missing or not after it', () => {
			expect(meetingWhenText(new Date(START), null, 'UTC')).toBe('Thursday, November 12, 2026 at 1:00 PM (UTC)');
			expect(meetingWhenText(new Date(START), new Date(START), 'UTC')).toBe(
				'Thursday, November 12, 2026 at 1:00 PM (UTC)'
			);
		});
	});

	describe('meetingNotice', () => {
		const meeting = { agenda: 'Sprint review', startDateTime: new Date(START), endDateTime: new Date(END), timeZone: 'UTC' };

		// The titles Ever Teams reads back (`meetingNoticeOf` there), word for word: change both sides, or neither
		it('files the titles Ever Teams reads back', () => {
			expect(meetingNotice('invited', meeting).title).toBe('You are invited to "Sprint review"');
			expect(meetingNotice('removed', meeting).title).toBe('You are no longer invited to "Sprint review"');
			expect(meetingNotice('changed', meeting).title).toBe('"Sprint review" was changed');
			expect(meetingNotice('cancelled', meeting).title).toBe('"Sprint review" was cancelled');
			expect(meetingNotice('reminder', { ...meeting, now: START - 15 * MINUTE }).title).toBe(
				'"Sprint review" starts in 15 minutes'
			);
			expect(meetingNotice('starting', meeting).title).toBe('"Sprint review" is starting');
		});

		it('says how long until the start from the moment it is filed', () => {
			expect(meetingNotice('reminder', { ...meeting, now: START - 2 * MINUTE }).title).toBe(
				'"Sprint review" starts in 2 minutes'
			);
			expect(meetingNotice('reminder', { ...meeting, now: START - 90 * MINUTE }).title).toBe(
				'"Sprint review" starts in 1 hour 30 minutes'
			);
			expect(meetingNotice('reminder', { ...meeting, now: START - 120 * MINUTE }).title).toBe(
				'"Sprint review" starts in 2 hours'
			);
			expect(meetingNotice('reminder', { ...meeting, now: START - 61 * 1000 }).title).toBe(
				'"Sprint review" starts in 1 minute'
			);
		});

		it('says in its message when the meeting runs', () => {
			expect(meetingNotice('invited', meeting).message).toBe('Thursday, November 12, 2026, 1:00 – 1:45 PM (UTC)');
		});

		it('quotes the title on one line, cut to 120 characters, and a blank one as Meeting', () => {
			expect(quotedAgendaOf('  Sprint\n review  ')).toBe('Sprint review');
			expect(quotedAgendaOf('   ')).toBe('Meeting');
			const long = quotedAgendaOf('x'.repeat(300));
			expect(long).toHaveLength(120);
			expect(long.endsWith('…')).toBe(true);
		});
	});

	describe('isMeetingScheduled', () => {
		it('holds for a meeting neither cancelled nor completed', () => {
			expect(isMeetingScheduled(undefined)).toBe(true);
			expect(isMeetingScheduled(EmployeeAppointmentStatus.SCHEDULED)).toBe(true);
			expect(isMeetingScheduled(EmployeeAppointmentStatus.CANCELLED)).toBe(false);
			expect(isMeetingScheduled(EmployeeAppointmentStatus.COMPLETED)).toBe(false);
		});
	});

	describe('isMeetingChangeWorthTelling', () => {
		const before = {
			agenda: 'Sprint review',
			description: 'Demo',
			location: 'https://app.ever.team/meet/jitsi?room=abc',
			startDateTime: new Date(START),
			endDateTime: new Date(END)
		};

		it('tells a new time, place, title or description', () => {
			expect(isMeetingChangeWorthTelling(before, { ...before, startDateTime: new Date(START + MINUTE) })).toBe(true);
			expect(isMeetingChangeWorthTelling(before, { ...before, endDateTime: new Date(END + MINUTE) })).toBe(true);
			expect(isMeetingChangeWorthTelling(before, { ...before, location: 'Room 4' })).toBe(true);
			expect(isMeetingChangeWorthTelling(before, { ...before, agenda: 'Sprint demo' })).toBe(true);
			expect(isMeetingChangeWorthTelling(before, { ...before, description: '' })).toBe(true);
		});

		it('tells nothing for the same meeting, its times written another way included', () => {
			expect(isMeetingChangeWorthTelling(before, { ...before })).toBe(false);
			expect(
				isMeetingChangeWorthTelling(before, {
					...before,
					agenda: ' Sprint review ',
					startDateTime: '2026-11-12T13:00:00.000Z',
					endDateTime: '2026-11-12 13:45:00.000'
				})
			).toBe(false);
		});
	});
});
