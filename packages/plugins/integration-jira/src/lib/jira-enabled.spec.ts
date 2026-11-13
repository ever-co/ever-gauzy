import { isJiraEnabled } from './jira-enabled';

describe('isJiraEnabled', () => {
	it('is on only for exactly "true"', () => {
		expect(isJiraEnabled({ JIRA_ENABLED: 'true' })).toBe(true);
		expect(isJiraEnabled({ JIRA_ENABLED: 'false' })).toBe(false);
		expect(isJiraEnabled({ JIRA_ENABLED: '' })).toBe(false);
		expect(isJiraEnabled({})).toBe(false);
	});

	it('reports any other value once, without repeating it', () => {
		const warn = jest.fn();
		expect(isJiraEnabled({ JIRA_ENABLED: 'TRUE' }, warn)).toBe(false);
		expect(isJiraEnabled({ JIRA_ENABLED: '1' }, warn)).toBe(false);
		expect(warn).toHaveBeenCalledTimes(2);
		expect(String(warn.mock.calls[0][0])).not.toContain('TRUE');
	});
});
