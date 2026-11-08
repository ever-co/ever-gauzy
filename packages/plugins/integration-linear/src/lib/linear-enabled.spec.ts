import { isLinearEnabled } from './linear-enabled';

describe('isLinearEnabled', () => {
	it('is on only for exactly "true"', () => {
		expect(isLinearEnabled({ LINEAR_ENABLED: 'true' })).toBe(true);
		expect(isLinearEnabled({ LINEAR_ENABLED: 'false' })).toBe(false);
		expect(isLinearEnabled({ LINEAR_ENABLED: '' })).toBe(false);
		expect(isLinearEnabled({})).toBe(false);
	});

	it('reports any other value once, without repeating it', () => {
		const warn = jest.fn();
		expect(isLinearEnabled({ LINEAR_ENABLED: 'TRUE' }, warn)).toBe(false);
		expect(isLinearEnabled({ LINEAR_ENABLED: '1' }, warn)).toBe(false);
		expect(warn).toHaveBeenCalledTimes(2);
		expect(String(warn.mock.calls[0][0])).not.toContain('TRUE');
	});
});
