import { isAsanaEnabled } from './asana-enabled';

describe('isAsanaEnabled', () => {
	it('is on only for exactly "true"', () => {
		expect(isAsanaEnabled({ ASANA_ENABLED: 'true' })).toBe(true);
		expect(isAsanaEnabled({ ASANA_ENABLED: 'false' })).toBe(false);
		expect(isAsanaEnabled({ ASANA_ENABLED: '' })).toBe(false);
		expect(isAsanaEnabled({})).toBe(false);
	});

	it('reports any other value once, without repeating it', () => {
		const warn = jest.fn();
		expect(isAsanaEnabled({ ASANA_ENABLED: 'TRUE' }, warn)).toBe(false);
		expect(isAsanaEnabled({ ASANA_ENABLED: '1' }, warn)).toBe(false);
		expect(warn).toHaveBeenCalledTimes(2);
		expect(String(warn.mock.calls[0][0])).not.toContain('TRUE');
	});
});
