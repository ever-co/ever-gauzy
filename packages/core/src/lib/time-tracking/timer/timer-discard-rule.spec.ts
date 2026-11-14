import {
	TIMER_DISCARD_DISABLED,
	TIMER_DISCARD_TOO_LATE,
	discardDisabledRefusal,
	discardTooLateRefusal
} from './timer-discard-rule';

describe('timer discard rule', () => {
	describe('discardDisabledRefusal', () => {
		it.each([
			['not set', {}],
			['null', { allowDiscardTimer: null }],
			['on', { allowDiscardTimer: true }]
		])('allows discarding when the switch is %s', (_label, settings) => {
			expect(discardDisabledRefusal(settings)).toBeNull();
		});

		it('allows discarding when the organization is unknown', () => {
			expect(discardDisabledRefusal(undefined)).toBeNull();
		});

		it('refuses with its code when the organization turned the switch off', () => {
			expect(discardDisabledRefusal({ allowDiscardTimer: false })).toEqual({
				code: TIMER_DISCARD_DISABLED,
				message: expect.stringMatching(/turned off/)
			});
		});
	});

	describe('discardTooLateRefusal', () => {
		const startedAt = new Date('2026-11-13T10:00:00.000Z');
		const after = (minutes: number, seconds = 0) => new Date(startedAt.getTime() + (minutes * 60 + seconds) * 1000);

		it.each([
			['no limit', {}],
			['a null limit', { discardTimerWithinMinutes: null }],
			['a limit of zero', { discardTimerWithinMinutes: 0 }]
		])('allows a run of any age with %s', (_label, settings) => {
			expect(discardTooLateRefusal(settings, startedAt, after(600))).toBeNull();
		});

		it('allows a run started less than the limit ago', () => {
			expect(discardTooLateRefusal({ discardTimerWithinMinutes: 10 }, startedAt, after(9, 59))).toBeNull();
		});

		it('refuses a run started the limit ago or longer, naming the limit', () => {
			const settings = { discardTimerWithinMinutes: 10 };

			expect(discardTooLateRefusal(settings, startedAt, after(10))).toEqual({
				code: TIMER_DISCARD_TOO_LATE,
				message: 'This timer can only be discarded within 10 minutes of its start.'
			});
			expect(discardTooLateRefusal(settings, startedAt, after(45))?.code).toBe(TIMER_DISCARD_TOO_LATE);
		});

		it('says minute, not minutes, for a limit of one', () => {
			expect(discardTooLateRefusal({ discardTimerWithinMinutes: 1 }, startedAt, after(2))?.message).toBe(
				'This timer can only be discarded within 1 minute of its start.'
			);
		});

		it('allows a run whose start is ahead of the server clock', () => {
			expect(discardTooLateRefusal({ discardTimerWithinMinutes: 10 }, after(1), startedAt)).toBeNull();
		});
	});
});
