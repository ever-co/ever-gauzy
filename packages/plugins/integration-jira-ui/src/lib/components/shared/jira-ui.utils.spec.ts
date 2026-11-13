import { DatePipe } from '@angular/common';
import { conflictValueView, errorCode, errorText, isNotFound, namedStatusesOf, plainText, statusKey, statusMapOf } from './jira-ui.utils';

describe('jira-ui.utils', () => {
	it('builds a status map: the three categories (a blank one takes the default), then the named statuses that have a task status', () => {
		expect(statusMapOf({ new: 'todo', indeterminate: '  ', done: 'done' }, { '10001': 'review', '10002': '  ' })).toEqual({
			new: 'todo',
			indeterminate: 'in-progress',
			done: 'done',
			'status:10001': 'review'
		});
		expect(statusMapOf({}, {}, { new: 'backlog', indeterminate: 'doing', done: 'closed' })).toEqual({ new: 'backlog', indeterminate: 'doing', done: 'closed' });
		expect(statusKey('42')).toBe('status:42');
	});

	it('reads the named statuses of a stored map, leaving the categories and blank entries out', () => {
		expect(namedStatusesOf({ new: 'open', 'status:10001': ' review ', 'status:': 'x', 'status:10002': '' })).toEqual({ '10001': 'review' });
		expect(namedStatusesOf(null)).toEqual({});
	});

	it('reads the API message and code of an error, in their shapes', () => {
		expect(errorText({ error: { message: 'No.' } })).toBe('No.');
		expect(errorText({ error: { message: ['one', 'two'] } })).toBe('one two');
		expect(errorText(null)).toBe('The request failed. Please try again.');
		expect(isNotFound({ status: 404 })).toBe(true);
		expect(errorCode({ error: { message: 'Stale', code: 'JIRA_CONFLICT_STALE' } })).toBe('JIRA_CONFLICT_STALE');
		expect(errorCode({ error: { error: { code: 'JIRA_CONFLICT_NOT_FOUND' } } })).toBe('JIRA_CONFLICT_NOT_FOUND');
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
		// A day, not a moment: the bare day, which the date pipe shows as that day in any zone.
		expect(conflictValueView('dueDate', '2026-11-20')).toMatchObject({ date: '2026-11-20', dateOnly: true });
		expect(conflictValueView('dueDate', '2026-11-20T00:00:00.000Z')).toMatchObject({ date: '2026-11-20', dateOnly: true });
		expect(conflictValueView('dueDate', '2026-11-20T00:00:00+00:00')).toMatchObject({ date: '2026-11-20', dateOnly: true });
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

describe('a date-only due date as the conflict list shows it', () => {
	// The list renders `view.date | date: 'mediumDate'` for a date-only value: the same pipe call, in several zones.
	const shown = (value: string) => new DatePipe('en-US').transform(conflictValueView('dueDate', value).date, 'mediumDate');

	it.each(['America/Los_Angeles', 'Asia/Tokyo', 'Europe/Paris', 'UTC'])('keeps its day for a reader in %s', (zone) => {
		const before = process.env['TZ'];
		process.env['TZ'] = zone;
		try {
			expect(shown('2026-11-20')).toBe('Nov 20, 2026');
			expect(shown('2026-11-21T00:00:00.000Z')).toBe('Nov 21, 2026');
			expect(shown('2026-11-21T00:00:00+00:00')).toBe('Nov 21, 2026');
		} finally {
			if (before === undefined) delete process.env['TZ'];
			else process.env['TZ'] = before;
		}
	});
});
