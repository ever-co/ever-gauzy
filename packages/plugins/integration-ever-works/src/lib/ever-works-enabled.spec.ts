import { isEverWorksEnabled } from './ever-works-enabled';

describe('isEverWorksEnabled', () => {
	it.each([
		['unset (the default)', undefined, false, 0],
		['empty', '', false, 0],
		['false', 'false', false, 0],
		['true', 'true', true, 0],
		['TRUE', 'TRUE', false, 1],
		['True', 'True', false, 1],
		['1', '1', false, 1],
		['yes', 'yes', false, 1],
		['on', 'on', false, 1],
		[' true (padded)', ' true', false, 1]
	])('%s: enabled %s, %i warning(s)', (_name, value, enabled, warnings) => {
		const warn = jest.fn();
		expect(isEverWorksEnabled({ EVER_WORKS_ENABLED: value }, warn)).toBe(enabled);
		expect(warn).toHaveBeenCalledTimes(warnings);
	});

	it('never repeats the value an operator typed in the warning', () => {
		const warn = jest.fn();
		isEverWorksEnabled({ EVER_WORKS_ENABLED: 'super-secret-typo' }, warn);
		expect(String(warn.mock.calls[0][0])).not.toContain('super-secret-typo');
	});

	it('reads process.env by default and stays off without it', () => {
		const saved = process.env['EVER_WORKS_ENABLED'];
		delete process.env['EVER_WORKS_ENABLED'];
		try {
			expect(isEverWorksEnabled()).toBe(false);
			process.env['EVER_WORKS_ENABLED'] = 'true';
			expect(isEverWorksEnabled()).toBe(true);
		} finally {
			if (saved === undefined) delete process.env['EVER_WORKS_ENABLED'];
			else process.env['EVER_WORKS_ENABLED'] = saved;
		}
	});
});
