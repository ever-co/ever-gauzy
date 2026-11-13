import { isRealtimeEnabled, isRealtimeRetentionEnabled } from './realtime-enabled';

describe('isRealtimeEnabled', () => {
	it('is off when the variable is unset, empty or "false", without a warning', () => {
		const warn = jest.fn();
		expect(isRealtimeEnabled({}, warn)).toBe(false);
		expect(isRealtimeEnabled({ GAUZY_REALTIME_ENABLED: '' }, warn)).toBe(false);
		expect(isRealtimeEnabled({ GAUZY_REALTIME_ENABLED: 'false' }, warn)).toBe(false);
		expect(warn).not.toHaveBeenCalled();
	});

	it('is on only for exactly "true"', () => {
		expect(isRealtimeEnabled({ GAUZY_REALTIME_ENABLED: 'true' })).toBe(true);
	});

	it('stays off and warns once for any other value, never repeating the value', () => {
		const warn = jest.fn();
		expect(isRealtimeEnabled({ GAUZY_REALTIME_ENABLED: 'TRUE' }, warn)).toBe(false);
		expect(isRealtimeEnabled({ GAUZY_REALTIME_ENABLED: '1' }, warn)).toBe(false);
		expect(warn).toHaveBeenCalledTimes(2);
		for (const [message] of warn.mock.calls) {
			expect(message).not.toContain('TRUE');
			expect(message).not.toContain('"1"');
		}
	});
});

describe('isRealtimeRetentionEnabled', () => {
	it('is off unless the variable is exactly "true", whatever the plugin switch says', () => {
		const warn = jest.fn();
		expect(isRealtimeRetentionEnabled({ GAUZY_REALTIME_ENABLED: 'true' }, warn)).toBe(false);
		expect(isRealtimeRetentionEnabled({ GAUZY_REALTIME_RETENTION_ENABLED: '' }, warn)).toBe(false);
		expect(isRealtimeRetentionEnabled({ GAUZY_REALTIME_RETENTION_ENABLED: 'false' }, warn)).toBe(false);
		expect(warn).not.toHaveBeenCalled();
		expect(isRealtimeRetentionEnabled({ GAUZY_REALTIME_RETENTION_ENABLED: 'true' })).toBe(true);
	});

	it('stays off and warns for any other value, never repeating it', () => {
		const warn = jest.fn();
		expect(isRealtimeRetentionEnabled({ GAUZY_REALTIME_RETENTION_ENABLED: 'yes' }, warn)).toBe(false);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).not.toContain('yes');
	});
});
