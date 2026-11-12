import { isTaskAutomationsEnabled } from './task-automations-enabled';

describe('isTaskAutomationsEnabled', () => {
	it.each([
		['unset (the default)', undefined, false, 0],
		['empty', '', false, 0],
		['false', 'false', false, 0],
		['true', 'true', true, 0],
		['TRUE', 'TRUE', false, 1],
		['1', '1', false, 1],
		['yes', 'yes', false, 1]
	])('GAUZY_TASK_AUTOMATIONS_ENABLED %s → %s, %i warning(s), never echoing the value', (_name, value, enabled, warnings) => {
		const warn = jest.fn();
		expect(isTaskAutomationsEnabled({ GAUZY_TASK_AUTOMATIONS_ENABLED: value }, warn)).toBe(enabled);
		expect(warn).toHaveBeenCalledTimes(warnings);
		for (const [message] of warn.mock.calls) {
			if (value) expect(message).not.toContain(`"${value}" `);
		}
	});
});
