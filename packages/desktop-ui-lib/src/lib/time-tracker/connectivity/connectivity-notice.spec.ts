import { CONNECTIVITY_NOTICE_KEYS, connectivityNotice } from './connectivity-notice';

/**
 * The time tracker detects a lost connection (it pings the API every 10 seconds) and shows Online / Offline in its
 * footer, but said nothing when the state changed (#8415). These are the notices for each change.
 */
describe('connectivityNotice', () => {
	it('warns when the connection is lost', () => {
		expect(connectivityNotice(false, true)).toEqual({
			state: 'offline',
			messageKey: CONNECTIVITY_NOTICE_KEYS.LOST
		});
	});

	it('says the connection is back, and how many entries are waiting to sync', () => {
		expect(connectivityNotice(true, false, 3)).toEqual({
			state: 'online',
			messageKey: CONNECTIVITY_NOTICE_KEYS.RESTORED_SYNCING,
			params: { count: 3 }
		});
	});

	it('does not mention syncing when nothing is waiting', () => {
		expect(connectivityNotice(true, false, 0)).toEqual({
			state: 'online',
			messageKey: CONNECTIVITY_NOTICE_KEYS.RESTORED
		});
		expect(connectivityNotice(true, false)).toEqual({
			state: 'online',
			messageKey: CONNECTIVITY_NOTICE_KEYS.RESTORED
		});
	});

	it('says nothing when the state did not change', () => {
		expect(connectivityNotice(false, false)).toBeNull();
		expect(connectivityNotice(true, true, 5)).toBeNull();
	});

	it('says nothing at an online start-up (the initial state is online), but warns at an offline one', () => {
		const initial = false;

		expect(connectivityNotice(initial, false)).toBeNull();
		expect(connectivityNotice(initial, true)?.state).toBe('offline');
	});
});
