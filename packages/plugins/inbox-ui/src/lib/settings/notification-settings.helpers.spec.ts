import { EmployeeNotificationTypeEnum } from '@gauzy/contracts';
import {
	defaultEmailModeOf,
	digestHourOf,
	emailDeliveryNoticeOf,
	emailModeOf,
	hourLabelOf,
	isKindOn,
	isTimeOfDay,
	ownEmailModeOf,
	preferencesOf,
	quietHoursOf,
	withPreferencePatch
} from './notification-settings.helpers';

describe('notification settings helpers', () => {
	it('reads the switches and the preferences of a row, stored as an object or as JSON', () => {
		expect(isKindOn(null, 'mention')).toBe(true);
		expect(isKindOn({ id: 's1', mention: false } as never, 'mention')).toBe(false);
		expect(preferencesOf({ id: 's1', preferences: { email: 'digest' } } as never)).toEqual({ email: 'digest' });
		expect(preferencesOf({ id: 's1', preferences: '{"email":"off"}' } as never)).toEqual({ email: 'off' });
		expect(preferencesOf({ id: 's1', preferences: '{oops' } as never)).toEqual({});
	});

	it("reads a kind's email mode before the one of every kind, with true as at once and false as never", () => {
		expect(defaultEmailModeOf({})).toBe('immediate');
		expect(defaultEmailModeOf({ email: false })).toBe('off');
		expect(defaultEmailModeOf({ email: true })).toBe('immediate');
		expect(emailModeOf({ email: 'digest', emailByType: { Mention: 'immediate' } }, EmployeeNotificationTypeEnum.MENTION)).toBe('immediate');
		expect(emailModeOf({ email: 'digest' }, EmployeeNotificationTypeEnum.COMMENT)).toBe('digest');
		expect(ownEmailModeOf({ emailByType: { Mention: 'off' } }, EmployeeNotificationTypeEnum.MENTION)).toBe('off');
		expect(ownEmailModeOf({ email: 'digest' }, EmployeeNotificationTypeEnum.MENTION)).toBeNull();
	});

	it('keeps only a well-formed window and an hour of the day', () => {
		expect(quietHoursOf({ dnd: { start: '22:00', end: '07:00', timeZone: 'UTC' } })).toEqual({ start: '22:00', end: '07:00', timeZone: 'UTC' });
		expect(quietHoursOf({ dnd: { start: 'late', end: '07:00' } })).toBeNull();
		expect(quietHoursOf({})).toBeNull();
		expect(isTimeOfDay('8:05')).toBe(true);
		expect(isTimeOfDay('24:00')).toBe(false);
		expect(digestHourOf({ digestHour: 17 })).toBe(17);
		expect(digestHourOf({ digestHour: 99 })).toBe(8);
		expect(hourLabelOf(8, 'en-GB')).toMatch(/08:00|8:00/);
	});

	it('merges a patch: the per-kind modes and the window merge, a null window clears it', () => {
		const current = { email: 'digest' as const, emailByType: { Mention: 'immediate' as const }, dnd: { start: '22:00', end: '07:00', timeZone: 'UTC' } };
		expect(withPreferencePatch(current, { emailByType: { Comment: 'off' } }).emailByType).toEqual({ Mention: 'immediate', Comment: 'off' });
		expect(withPreferencePatch(current, { dnd: { start: '21:00', end: '07:00' } }).dnd).toEqual({ start: '21:00', end: '07:00', timeZone: 'UTC' });
		expect(withPreferencePatch(current, { emailByType: { Mention: undefined } }).emailByType).toEqual({});
		expect(withPreferencePatch(current, { dnd: null }).dnd).toBeNull();
		expect(withPreferencePatch({}, { digestHour: 9 })).toEqual({ digestHour: 9 });
	});
});

describe('emailDeliveryNoticeOf', () => {
	const status = (enabled: boolean, available: boolean) => ({
		email: { enabled, available },
		push: { enabled: false, available: false },
		checkedAt: '2026-11-11T12:00:00.000Z'
	});

	it('says OFF when the server sends no notification emails, UNAVAILABLE when none can go out, else nothing', () => {
		expect(emailDeliveryNoticeOf(status(false, false))).toBe('OFF');
		expect(emailDeliveryNoticeOf(status(true, false))).toBe('UNAVAILABLE');
		expect(emailDeliveryNoticeOf(status(true, true))).toBeNull();
	});

	it('says nothing when the server does not say', () => {
		expect(emailDeliveryNoticeOf(null)).toBeNull();
		expect(emailDeliveryNoticeOf(undefined)).toBeNull();
		expect(emailDeliveryNoticeOf({} as never)).toBeNull();
	});
});
