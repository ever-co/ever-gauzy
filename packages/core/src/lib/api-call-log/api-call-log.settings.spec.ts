import { resolveApiCallLogEnabled } from './api-call-log.settings';

describe('resolveApiCallLogEnabled', () => {
	it('is on by default', () => {
		expect(resolveApiCallLogEnabled({})).toBe(true);
		expect(resolveApiCallLogEnabled({ API_CALL_LOG_ENABLED: '' })).toBe(true);
	});

	it.each(['false', '0', 'no', 'off', ' OFF '])('API_CALL_LOG_ENABLED=%j turns it off', (value) => {
		expect(resolveApiCallLogEnabled({ API_CALL_LOG_ENABLED: value })).toBe(false);
	});

	it.each(['true', '1', 'yes', 'anything-else'])('API_CALL_LOG_ENABLED=%j keeps it on', (value) => {
		expect(resolveApiCallLogEnabled({ API_CALL_LOG_ENABLED: value })).toBe(true);
	});
});
