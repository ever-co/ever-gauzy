import { EmployeeNotificationTypeEnum, InboxDeliveryModeEnum } from '@gauzy/contracts';
import {
	decideEmailDelivery,
	decidePushDelivery,
	emailModeOf,
	excerptOf,
	IDeliverySettingLike,
	inboxItemLinkOf,
	instantOfLocal,
	isSentOnlyWhileUnread,
	nextLocalDate,
	isWithinWindow,
	kindSwitchOf,
	localClockOf,
	minutesOfDay,
	nextDigestAt,
	preferencesOf,
	retryDelayMs,
	windowEndAfter,
	withoutTrailingSlashes
} from './inbox-delivery-rules';
import { INBOX_DELIVERY_TIMER_REMINDER_GRACE_MS } from './inbox-delivery.constants';

/** A Saturday at 12:30 UTC: 14:30 in Sofia (UTC+2 in November), 04:30 in Los Angeles (UTC−8). */
const NOW = new Date('2026-11-07T12:30:00.000Z');
/** When a timer reminder decided at NOW goes, unless it is read by then: 14:33 in Sofia. */
const AFTER_WAIT = new Date(NOW.getTime() + INBOX_DELIVERY_TIMER_REMINDER_GRACE_MS);

describe('the delivery clock', () => {
	it("reads the person's clock in their time zone, and UTC for none or an unknown one", () => {
		expect(localClockOf(NOW, 'Europe/Sofia')).toEqual({ date: '2026-11-07', hour: 14, minute: 30 });
		expect(localClockOf(NOW, 'America/Los_Angeles')).toEqual({ date: '2026-11-07', hour: 4, minute: 30 });
		expect(localClockOf(NOW, 'Not/AZone')).toEqual({ date: '2026-11-07', hour: 12, minute: 30 });
		expect(localClockOf(NOW, null)).toEqual({ date: '2026-11-07', hour: 12, minute: 30 });
	});

	it('turns a local time back into an instant, across the date line too', () => {
		expect(instantOfLocal('2026-11-07', 8, 0, 'Europe/Sofia').toISOString()).toBe('2026-11-07T06:00:00.000Z');
		expect(instantOfLocal('2026-11-07', 8, 0, 'America/Los_Angeles').toISOString()).toBe('2026-11-07T16:00:00.000Z');
		expect(instantOfLocal('2026-11-07', 23, 30, 'Pacific/Auckland').toISOString()).toBe('2026-11-07T10:30:00.000Z');
		expect(instantOfLocal('2026-11-07', 0, 15, 'UTC').toISOString()).toBe('2026-11-07T00:15:00.000Z');
		// The day the clocks go back in New York (01:30 happens twice): the instant is still that day's 08:00.
		expect(instantOfLocal('2026-11-01', 8, 0, 'America/New_York').toISOString()).toBe('2026-11-01T13:00:00.000Z');
		expect(nextLocalDate('2026-10-31')).toBe('2026-11-01');
		expect(nextLocalDate('2026-12-31')).toBe('2027-01-01');
		// 14 March 2027 in New York: 02:00 becomes 03:00, so 02:30 does not exist and is the first instant after the gap.
		expect(instantOfLocal('2027-03-14', 2, 30, 'America/New_York').toISOString()).toBe('2027-03-14T07:00:00.000Z');
		expect(instantOfLocal('2027-03-14', 3, 0, 'America/New_York').toISOString()).toBe('2027-03-14T07:00:00.000Z');
		expect(instantOfLocal('2027-03-14', 1, 59, 'America/New_York').toISOString()).toBe('2027-03-14T06:59:00.000Z');
	});

	it('reads HH:mm as minutes of the day, and nothing else', () => {
		expect(minutesOfDay('08:30')).toBe(510);
		expect(minutesOfDay('8:05')).toBe(485);
		expect(minutesOfDay('24:00')).toBeNull();
		expect(minutesOfDay('noon')).toBeNull();
		expect(minutesOfDay(930)).toBeNull();
	});
});

describe('the do-not-disturb window', () => {
	const night = { start: '22:00', end: '07:00' };
	const office = { start: '09:00', end: '17:00' };
	const at = (hour: number, minute = 0) => ({ date: '2026-11-07', hour, minute });

	it('knows a window that spans midnight from one that does not', () => {
		expect(isWithinWindow(at(23), night)).toBe(true);
		expect(isWithinWindow(at(6, 59), night)).toBe(true);
		expect(isWithinWindow(at(7), night)).toBe(false);
		expect(isWithinWindow(at(12), night)).toBe(false);
		expect(isWithinWindow(at(12), office)).toBe(true);
		expect(isWithinWindow(at(17), office)).toBe(false);
		expect(isWithinWindow(at(12), { start: '12:00', end: '12:00' })).toBe(false);
		expect(isWithinWindow(at(12), { start: 'x', end: '13:00' })).toBe(false);
		expect(isWithinWindow(at(12), null)).toBe(false);
	});

	it("ends at the window's end, today when it is still ahead and tomorrow otherwise", () => {
		// Midnight in Sofia (22:00 UTC): the night window ends at 07:00 Sofia, 05:00 UTC, the same calendar day there.
		expect(windowEndAfter(new Date('2026-11-07T22:00:00.000Z'), night, 'Europe/Sofia').toISOString()).toBe('2026-11-08T05:00:00.000Z');
		// 14:30 in Sofia with the window's end at 07:00 already behind: tomorrow's.
		expect(windowEndAfter(NOW, night, 'Europe/Sofia').toISOString()).toBe('2026-11-08T05:00:00.000Z');
		// 12:30 UTC inside the office window: 17:00 UTC today.
		expect(windowEndAfter(NOW, office, 'UTC').toISOString()).toBe('2026-11-07T17:00:00.000Z');
	});
});

describe('the digest hour', () => {
	it('is today when still ahead on the person\'s clock, else tomorrow, and 8 when the hour is not one', () => {
		expect(nextDigestAt(NOW, 8, 'Europe/Sofia').toISOString()).toBe('2026-11-08T06:00:00.000Z');
		expect(nextDigestAt(NOW, 15, 'Europe/Sofia').toISOString()).toBe('2026-11-07T13:00:00.000Z');
		expect(nextDigestAt(NOW, 8, 'America/Los_Angeles').toISOString()).toBe('2026-11-07T16:00:00.000Z');
		expect(nextDigestAt(NOW, 99, 'UTC').toISOString()).toBe('2026-11-08T08:00:00.000Z');
	});

	it('is today up to the last millisecond before the hour, and tomorrow from the hour itself', () => {
		expect(nextDigestAt(new Date('2026-11-07T07:59:59.999Z'), 8, 'UTC').toISOString()).toBe('2026-11-07T08:00:00.000Z');
		expect(nextDigestAt(new Date('2026-11-07T08:00:00.000Z'), 8, 'UTC').toISOString()).toBe('2026-11-08T08:00:00.000Z');
		// A digest hour the clock skips on the day the clocks go forward goes out at the first instant after the gap.
		expect(nextDigestAt(new Date('2027-03-14T05:30:00.000Z'), 2, 'America/New_York').toISOString()).toBe('2027-03-14T07:00:00.000Z');
		// A window's end in the gap ends there too.
		expect(windowEndAfter(new Date('2027-03-14T06:30:00.000Z'), { start: '22:00', end: '02:30' }, 'America/New_York').toISOString()).toBe('2027-03-14T07:00:00.000Z');
	});

	it('keeps the chosen hour across a daylight-saving change (the next calendar day, not 24 hours on)', () => {
		// 09:00 EDT on 31 October 2026; the digest hour has passed; the clocks go back overnight: 08:00 EST is 13:00 UTC.
		expect(nextDigestAt(new Date('2026-10-31T13:00:00.000Z'), 8, 'America/New_York').toISOString()).toBe('2026-11-01T13:00:00.000Z');
		// 23:00 EDT on 31 October inside a 22:00–07:00 window: it ends at 07:00 EST, 12:00 UTC.
		expect(windowEndAfter(new Date('2026-11-01T03:00:00.000Z'), { start: '22:00', end: '07:00' }, 'America/New_York').toISOString()).toBe('2026-11-01T12:00:00.000Z');
	});
});

describe('the preferences', () => {
	it('reads the preferences stored as an object or as JSON, and nothing from neither', () => {
		expect(preferencesOf({ preferences: { email: 'digest' } })).toEqual({ email: 'digest' });
		expect(preferencesOf({ preferences: '{"email":"off"}' })).toEqual({ email: 'off' });
		expect(preferencesOf({ preferences: '{oops' })).toEqual({});
		expect(preferencesOf(null)).toEqual({});
	});

	it("honours the kind's switch, with TaskUpdate in the preferences and unknown kinds on", () => {
		expect(kindSwitchOf({ mention: false }, {}, EmployeeNotificationTypeEnum.MENTION)).toBe(false);
		expect(kindSwitchOf({ mention: false }, {}, EmployeeNotificationTypeEnum.ASSIGNMENT)).toBe(true);
		expect(kindSwitchOf({}, { taskUpdate: false }, EmployeeNotificationTypeEnum.TASK_UPDATE)).toBe(false);
		expect(kindSwitchOf({}, {}, EmployeeNotificationTypeEnum.TASK_UPDATE)).toBe(true);
		expect(kindSwitchOf(null, {}, 'Whatever')).toBe(true);
	});

	it('takes a timer reminder unless the employee turned the reminders off', () => {
		const timer = EmployeeNotificationTypeEnum.TIMER_REMINDER;
		expect(kindSwitchOf({}, {}, timer)).toBe(true);
		expect(kindSwitchOf({}, { timerReminderHours: 4 }, timer)).toBe(true);
		expect(kindSwitchOf({}, { timerReminderHours: null }, timer)).toBe(false);
		expect(kindSwitchOf({}, { timerReminderHours: 0 }, timer)).toBe(false);
	});

	it("reads the kind's email mode, else the one for every kind, else immediate", () => {
		expect(emailModeOf({}, EmployeeNotificationTypeEnum.MENTION)).toBe('immediate');
		expect(emailModeOf({ email: false }, EmployeeNotificationTypeEnum.MENTION)).toBe('off');
		expect(emailModeOf({ email: true }, EmployeeNotificationTypeEnum.MENTION)).toBe('immediate');
		expect(emailModeOf({ email: 'digest' }, EmployeeNotificationTypeEnum.MENTION)).toBe('digest');
		expect(emailModeOf({ email: 'digest', emailByType: { Mention: 'immediate' } }, EmployeeNotificationTypeEnum.MENTION)).toBe('immediate');
		expect(emailModeOf({ email: 'digest', emailByType: { Mention: 'sometimes' as never } }, EmployeeNotificationTypeEnum.MENTION)).toBe('digest');
	});
});

describe('decideEmailDelivery', () => {
	it('sends at once by default, and nothing when the kind or its email is off', () => {
		expect(decideEmailDelivery({ now: NOW, type: EmployeeNotificationTypeEnum.MENTION, setting: null })).toEqual({ mode: InboxDeliveryModeEnum.IMMEDIATE, dueAt: NOW, digestKey: null });
		expect(decideEmailDelivery({ now: NOW, type: EmployeeNotificationTypeEnum.MENTION, setting: { mention: false } })).toEqual({ mode: InboxDeliveryModeEnum.NONE, dueAt: null, digestKey: null });
		expect(decideEmailDelivery({ now: NOW, type: EmployeeNotificationTypeEnum.MENTION, setting: { preferences: { emailByType: { Mention: 'off' } } } })).toEqual({ mode: InboxDeliveryModeEnum.NONE, dueAt: null, digestKey: null });
	});

	it('sends nothing for a timer reminder already read, and holds an unread one for the wait an open tab marks it read in', () => {
		const decide = (setting: IDeliverySettingLike | null, alreadyRead?: boolean, userTimeZone?: string) =>
			decideEmailDelivery({
				now: NOW,
				type: EmployeeNotificationTypeEnum.TIMER_REMINDER,
				setting,
				alreadyRead,
				userTimeZone
			});
		expect(decide(null, true)).toEqual({ mode: InboxDeliveryModeEnum.NONE, dueAt: null, digestKey: null });
		expect(decide(null, false)).toEqual({
			mode: InboxDeliveryModeEnum.IMMEDIATE,
			dueAt: AFTER_WAIT,
			digestKey: null
		});
		expect(decide(null)).toEqual({ mode: InboxDeliveryModeEnum.IMMEDIATE, dueAt: AFTER_WAIT, digestKey: null });
		// Its switch and its email mode, as for any kind
		expect(decide({ preferences: { timerReminderHours: null } }).mode).toBe(InboxDeliveryModeEnum.NONE);
		expect(decide({ preferences: { emailByType: { TimerReminder: 'digest' } } }).mode).toBe(
			InboxDeliveryModeEnum.DIGEST
		);
		// The quiet hours are those at the end of the wait (14:33 in Sofia): a window it reaches holds the email to its end
		expect(decide({ preferences: { dnd: { start: '14:31', end: '16:00' } } }, false, 'Europe/Sofia').dueAt).toEqual(
			new Date('2026-11-07T14:00:00.000Z')
		);
		expect(decide({ preferences: { dnd: { start: '12:00', end: '14:32' } } }, false, 'Europe/Sofia').dueAt).toEqual(
			AFTER_WAIT
		);
	});

	it('decides every other kind as it always did, whether the person read the entry or not', () => {
		for (const alreadyRead of [true, false, undefined]) {
			expect(
				decideEmailDelivery({
					now: NOW,
					type: EmployeeNotificationTypeEnum.MENTION,
					setting: null,
					alreadyRead
				})
			).toEqual({ mode: InboxDeliveryModeEnum.IMMEDIATE, dueAt: NOW, digestKey: null });
			expect(
				decideEmailDelivery({
					now: NOW,
					type: EmployeeNotificationTypeEnum.COMMENT,
					setting: { preferences: { email: 'digest', digestHour: 8 } },
					userTimeZone: 'Europe/Sofia',
					alreadyRead
				})
			).toEqual({
				mode: InboxDeliveryModeEnum.DIGEST,
				dueAt: new Date('2026-11-08T06:00:00.000Z'),
				digestKey: '2026-11-08'
			});
			expect(
				decideEmailDelivery({
					now: NOW,
					type: EmployeeNotificationTypeEnum.ASSIGNMENT,
					setting: { preferences: { dnd: { start: '12:00', end: '16:00' } } },
					userTimeZone: 'Europe/Sofia',
					alreadyRead
				}).dueAt
			).toEqual(new Date('2026-11-07T14:00:00.000Z'));
			expect(
				decideEmailDelivery({
					now: NOW,
					type: EmployeeNotificationTypeEnum.MENTION,
					setting: { mention: false },
					alreadyRead
				}).mode
			).toBe(InboxDeliveryModeEnum.NONE);
		}
	});

	it("places a digest kind at the person's next digest hour, keyed by that day", () => {
		const decision = decideEmailDelivery({ now: NOW, type: EmployeeNotificationTypeEnum.COMMENT, setting: { preferences: { email: 'digest', digestHour: 8 } }, userTimeZone: 'Europe/Sofia' });
		expect(decision).toEqual({ mode: InboxDeliveryModeEnum.DIGEST, dueAt: new Date('2026-11-08T06:00:00.000Z'), digestKey: '2026-11-08' });
	});

	it("holds an immediate email until the do-not-disturb window ends, in the window's own time zone", () => {
		const sofia = decideEmailDelivery({ now: NOW, type: EmployeeNotificationTypeEnum.ASSIGNMENT, setting: { preferences: { dnd: { start: '12:00', end: '16:00' } } }, userTimeZone: 'Europe/Sofia' });
		expect(sofia).toEqual({ mode: InboxDeliveryModeEnum.IMMEDIATE, dueAt: new Date('2026-11-07T14:00:00.000Z'), digestKey: null });
		const utc = decideEmailDelivery({ now: NOW, type: EmployeeNotificationTypeEnum.ASSIGNMENT, setting: { preferences: { dnd: { start: '12:00', end: '16:00', timeZone: 'UTC' } } }, userTimeZone: 'Europe/Sofia' });
		expect(utc.dueAt).toEqual(new Date('2026-11-07T16:00:00.000Z'));
		const outside = decideEmailDelivery({ now: NOW, type: EmployeeNotificationTypeEnum.ASSIGNMENT, setting: { preferences: { dnd: { start: '22:00', end: '07:00' } } }, userTimeZone: 'Europe/Sofia' });
		expect(outside.dueAt).toEqual(NOW);
	});
});

describe('decidePushDelivery', () => {
	const mention = EmployeeNotificationTypeEnum.MENTION;

	it('pushes at once to a person with a device, and nothing without one, when the kind is off, or when push is off for it', () => {
		expect(decidePushDelivery({ now: NOW, type: mention, setting: null, hasSubscription: true })).toEqual({ mode: InboxDeliveryModeEnum.IMMEDIATE, dueAt: NOW, digestKey: null });
		expect(decidePushDelivery({ now: NOW, type: mention, setting: null, hasSubscription: false }).mode).toBe(InboxDeliveryModeEnum.NONE);
		expect(decidePushDelivery({ now: NOW, type: mention, setting: { mention: false }, hasSubscription: true }).mode).toBe(InboxDeliveryModeEnum.NONE);
		expect(decidePushDelivery({ now: NOW, type: mention, setting: { preferences: { push: false } }, hasSubscription: true }).mode).toBe(InboxDeliveryModeEnum.NONE);
		expect(decidePushDelivery({ now: NOW, type: mention, setting: { preferences: { pushByType: { Mention: false } } }, hasSubscription: true }).mode).toBe(InboxDeliveryModeEnum.NONE);
		// The kind's own switch wins over the one for every kind.
		expect(decidePushDelivery({ now: NOW, type: mention, setting: { preferences: { push: false, pushByType: { Mention: true } } }, hasSubscription: true }).mode).toBe(InboxDeliveryModeEnum.IMMEDIATE);
	});

	it('pushes a timer reminder only while unread, once the wait is over, and any other kind as it always did', () => {
		const timer = (input: Partial<Parameters<typeof decidePushDelivery>[0]>) =>
			decidePushDelivery({
				now: NOW,
				type: EmployeeNotificationTypeEnum.TIMER_REMINDER,
				setting: null,
				hasSubscription: true,
				...input
			});
		expect(timer({ alreadyRead: true }).mode).toBe(InboxDeliveryModeEnum.NONE);
		expect(timer({})).toEqual({ mode: InboxDeliveryModeEnum.IMMEDIATE, dueAt: AFTER_WAIT, digestKey: null });
		expect(timer({ setting: { preferences: { pushByType: { TimerReminder: false } } } }).mode).toBe(
			InboxDeliveryModeEnum.NONE
		);
		expect(timer({ setting: { preferences: { timerReminderHours: 0 } } }).mode).toBe(InboxDeliveryModeEnum.NONE);
		expect(timer({ hasSubscription: false }).mode).toBe(InboxDeliveryModeEnum.NONE);
		// A mention read in the app is pushed as before: whether the person looks at the app is decided when it is due
		for (const alreadyRead of [true, false]) {
			expect(
				decidePushDelivery({ now: NOW, type: mention, setting: null, hasSubscription: true, alreadyRead })
			).toEqual({ mode: InboxDeliveryModeEnum.IMMEDIATE, dueAt: NOW, digestKey: null });
		}
	});

	it("holds a push until the do-not-disturb window ends, in the window's own time zone", () => {
		const held = decidePushDelivery({ now: NOW, type: mention, setting: { preferences: { dnd: { start: '12:00', end: '16:00' } } }, userTimeZone: 'Europe/Sofia', hasSubscription: true });
		expect(held).toEqual({ mode: InboxDeliveryModeEnum.IMMEDIATE, dueAt: new Date('2026-11-07T14:00:00.000Z'), digestKey: null });
	});
});

describe('isSentOnlyWhileUnread', () => {
	it('is a timer reminder alone: every other kind is sent read or not', () => {
		for (const type of Object.values(EmployeeNotificationTypeEnum)) {
			expect(isSentOnlyWhileUnread(type)).toBe(type === EmployeeNotificationTypeEnum.TIMER_REMINDER);
		}
		expect(isSentOnlyWhileUnread(null)).toBe(false);
		expect(isSentOnlyWhileUnread('Whatever')).toBe(false);
	});
});

describe('the attempts and the links', () => {
	it('waits twice as long after each failed attempt, and gives up after the fifth', () => {
		expect(retryDelayMs(1)).toBe(5 * 60_000);
		expect(retryDelayMs(2)).toBe(10 * 60_000);
		expect(retryDelayMs(4)).toBe(40 * 60_000);
		expect(retryDelayMs(5)).toBeNull();
	});

	it('links the entry in the Inbox page, and cuts a body for a line', () => {
		expect(inboxItemLinkOf('https://app.example.test/', 'i 1')).toBe('https://app.example.test/#/pages/inbox?item=i%201');
		expect(excerptOf('<p>Hello</p>   <b>world</b>')).toBe('Hello world');
		expect(excerptOf('x'.repeat(300)).length).toBe(280);
		expect(excerptOf(null)).toBe('');
	});
});

describe('linear-time text handling (CodeQL js/polynomial-redos)', () => {
	it('drops trailing slashes in one pass', () => {
		expect(withoutTrailingSlashes('https://app.test///')).toBe('https://app.test');
		expect(withoutTrailingSlashes('https://app.test')).toBe('https://app.test');
		expect(withoutTrailingSlashes('///')).toBe('');
		expect(inboxItemLinkOf('https://app.test///', 'i1')).toBe(inboxItemLinkOf('https://app.test', 'i1'));
		const started = Date.now();
		withoutTrailingSlashes('/'.repeat(200_000) + 'x');
		expect(Date.now() - started).toBeLessThan(200);
	});

	it('strips tags, and reads a body of many unclosed < in linear time', () => {
		expect(excerptOf('<p>a</p><b>b</b>')).toBe('a b');
		expect(excerptOf('1 < 2 and <i>x</i>')).toBe('1 < 2 and x');
		const started = Date.now();
		expect(excerptOf('<'.repeat(200_000)).length).toBeLessThanOrEqual(280);
		expect(Date.now() - started).toBeLessThan(500);
	});
});
