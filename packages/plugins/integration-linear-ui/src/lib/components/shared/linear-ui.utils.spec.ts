import { conflictValueView, errorCode, errorText, isNotFound, plainText } from './linear-ui.utils';

describe('linear-ui.utils', () => {
	it('reads the API message and code of an error, in their shapes', () => {
		expect(errorText({ error: { message: 'No.' } })).toBe('No.');
		expect(errorText({ error: { message: ['one', 'two'] } })).toBe('one two');
		expect(errorText(null)).toBe('The request failed. Please try again.');
		expect(isNotFound({ status: 404 })).toBe(true);
		expect(errorCode({ error: { message: 'Stale', code: 'LINEAR_CONFLICT_STALE' } })).toBe('LINEAR_CONFLICT_STALE');
		expect(errorCode({ error: { error: { code: 'LINEAR_CONFLICT_NOT_FOUND' } } })).toBe('LINEAR_CONFLICT_NOT_FOUND');
		expect(errorCode({ error: 'plain' })).toBeNull();
		expect(errorCode(undefined)).toBeNull();
	});

	it('shows an empty value as empty, and a due date as a date', () => {
		expect(conflictValueView('title', null)).toMatchObject({ empty: true });
		expect(conflictValueView('title', '   ')).toMatchObject({ empty: true });
		expect(conflictValueView('dueDate', '2026-11-20T09:00:00.000Z')).toEqual({
			empty: false,
			date: '2026-11-20T09:00:00.000Z',
			dateOnly: false,
			text: '2026-11-20T09:00:00.000Z',
			full: '2026-11-20T09:00:00.000Z'
		});
		// A day, not a moment: shown as that day in UTC.
		expect(conflictValueView('dueDate', '2026-11-20')).toMatchObject({ date: '2026-11-20', dateOnly: true });
		expect(conflictValueView('dueDate', '2026-11-20T00:00:00.000Z')).toMatchObject({ dateOnly: true });
		expect(conflictValueView('dueDate', '2026-11-20T00:00:00+00:00')).toMatchObject({ dateOnly: true });
		expect(conflictValueView('dueDate', '2026-11-20T00:00:00+02:00')).toMatchObject({ dateOnly: false });
		// Not a date: shown as the text it is.
		expect(conflictValueView('dueDate', 'soon')).toMatchObject({ date: null, text: 'soon' });
	});

	it('shows a description as its text, never its HTML, and cuts a long value', () => {
		const view = conflictValueView('description', '<p>Fix the <strong>login</strong> &amp; signup</p><p>Second</p><script>alert(1)</script>');
		expect(view.text).toBe('Fix the login & signup Second alert(1)');
		expect(view.text).not.toContain('<');
		expect(conflictValueView('description', '<p> </p>')).toMatchObject({ empty: true });

		const long = conflictValueView('title', 'x'.repeat(400));
		expect(long.text.length).toBe(160);
		expect(long.text.endsWith('…')).toBe(true);
		expect(long.full.length).toBe(400);

		// A status is shown as it is stored.
		expect(conflictValueView('status', 'in-progress')).toMatchObject({ empty: false, text: 'in-progress' });
	});

	it('reads the text of HTML with spaces at block ends', () => {
		expect(plainText('<ul><li>one</li><li>two</li></ul>line<br>break')).toBe('one two line break');
	});
});
