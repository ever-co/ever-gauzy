import { AwayStamp, isNewerAway, newConnectionId } from './chat-presence-reporter.service';

describe('isNewerAway', () => {
	it('orders away changes by time, then by tab, the same way in every tab', () => {
		const a: AwayStamp = { at: 100, tab: 'tab-a' };
		const b: AwayStamp = { at: 101, tab: 'tab-b' };
		expect(isNewerAway(b, a)).toBe(true);
		expect(isNewerAway(a, b)).toBe(false);
		// The same moment: the tab decides, and only one of the two is newer.
		const c: AwayStamp = { at: 100, tab: 'tab-c' };
		expect(isNewerAway(c, a)).toBe(true);
		expect(isNewerAway(a, c)).toBe(false);
		// Nothing known yet: any change is newer; the same change is not newer than itself.
		expect(isNewerAway(a, null)).toBe(true);
		expect(isNewerAway(a, { ...a })).toBe(false);
	});

	it('leaves two tabs on the same flag whatever order the crossing changes arrive in', () => {
		// Tab A sets away at 100; meanwhile tab B sets away at 101, then back at 102.
		const changes = [
			{ isAway: true, stamp: { at: 100, tab: 'tab-a' } },
			{ isAway: true, stamp: { at: 101, tab: 'tab-b' } },
			{ isAway: false, stamp: { at: 102, tab: 'tab-b' } }
		];
		const settle = (order: typeof changes) => {
			let latest: AwayStamp | null = null;
			let isAway = false;
			for (const change of order) {
				if (!isNewerAway(change.stamp, latest)) continue;
				latest = change.stamp;
				isAway = change.isAway;
			}
			return isAway;
		};
		// A sees its own change first, then B's; B sees its own two first, then A's.
		expect(settle(changes)).toBe(false);
		expect(settle([changes[1], changes[2], changes[0]])).toBe(false);
	});
});

describe('newConnectionId', () => {
	it('is a fresh id of letters, digits, dashes and underscores, at most 64 long', () => {
		const id = newConnectionId();
		expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
		expect(newConnectionId()).not.toBe(id);
	});
});
