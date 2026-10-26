jest.mock('@gauzy/ui-core/common', () => ({ AVATAR_DEFAULT_SVG: 'avatar-default.svg' }));

import { activityOf } from './team-dashboard.utils';

describe('activityOf', () => {
	it('weights by tracked time: active seconds over tracked seconds', () => {
		expect(
			activityOf([
				{ id: 'a', overall: 600, duration: 600 },
				{ id: 'b', overall: 0, duration: 1800 }
			])
		).toBe(25);
	});

	it('keeps each team to its own slots: 100% on one team and 0% on another stay apart', () => {
		const teamA = [{ id: 'a1', overall: 600, duration: 600 }];
		const teamB = [{ id: 'b1', overall: 0, duration: 600 }];

		expect(activityOf(teamA)).toBe(100);
		expect(activityOf(teamB)).toBe(0);
		// The employee-wide figure the daily report gives both teams.
		expect(activityOf([...teamA, ...teamB])).toBe(50);
	});

	it('counts a slot shared by several logs once', () => {
		const slot = { id: 's', overall: 300, duration: 600 };
		expect(activityOf([slot, slot, { id: 't', overall: 600, duration: 600 }])).toBe(75);
	});

	it('is null when there is nothing to measure', () => {
		expect(activityOf([])).toBeNull();
		expect(activityOf([{ id: 'z', overall: 0, duration: 0 }])).toBeNull();
	});
});
