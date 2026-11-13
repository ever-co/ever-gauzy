import { DatePipe } from '@angular/common';
import { conflictValueView, errorCode, errorText, isNotFound, listMapOf, plainText, tokenOfFragment } from './trello-ui.utils';

describe('trello-ui.utils', () => {
	it('reads the API message of an error, in its shapes, else a generic line', () => {
		expect(errorText({ error: { message: 'No.' } })).toBe('No.');
		expect(errorText({ error: { message: ['one', 'two'] } })).toBe('one two');
		expect(errorText({ error: 'plain' })).toBe('plain');
		expect(errorText(null)).toBe('The request failed. Please try again.');
		expect(isNotFound({ status: 404 })).toBe(true);
		expect(isNotFound({ status: 400 })).toBe(false);
	});

	it('reads the token Trello returns in the fragment, and nothing else', () => {
		expect(tokenOfFragment('token=abc123')).toBe('abc123');
		expect(tokenOfFragment('#token=abc123&other=1')).toBe('abc123');
		expect(tokenOfFragment('token=')).toBeNull();
		expect(tokenOfFragment('error=denied')).toBeNull();
		expect(tokenOfFragment('token=not safe!')).toBeNull();
		expect(tokenOfFragment(null)).toBeNull();
	});

	it('keeps only the lists given a status, trimmed', () => {
		expect(
			listMapOf([
				{ id: 'l-1', status: ' in-progress ' },
				{ id: 'l-2', status: '' },
				{ id: '', status: 'open' }
			])
		).toEqual({ 'l-1': 'in-progress' });
	});

	it('reads the code of an API error, in its shapes', () => {
		expect(errorCode({ error: { message: 'Stale', code: 'TRELLO_CONFLICT_STALE' } })).toBe('TRELLO_CONFLICT_STALE');
		expect(errorCode({ error: { error: { code: 'TRELLO_CONFLICT_NOT_FOUND' } } })).toBe('TRELLO_CONFLICT_NOT_FOUND');
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
