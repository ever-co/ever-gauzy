// cspell:ignore bdquo hellip laquo larr ldquo lsquo middot ndash plusmn raquo rarr rdquo rsquo sbquo
/**
 * G-P2-3 Ideas ↔ Idea tasks: the pure mappers (plan 01 §8) — status both ways (dismiss / restore only),
 * text ↔ HTML without flapping, the idea a Gauzy task makes, the patch diff and the Gauzy task an idea
 * was made from.
 */
import {
	everWorksIdeaShared,
	gauzyTaskOfIdea,
	gauzyTaskToIdea,
	htmlToIdeaText,
	ideaCreateBody,
	ideaPatchBody,
	ideaSourceTag,
	ideaStatusAction,
	ideaStatusAsTaskStatus,
	ideaTextToHtml,
	isIdeaTask,
	normalizeIdeaText
} from './ever-works-idea.mapper';

describe('Ever Works idea mappers', () => {
	it('an idea task is one of the seeded "Idea" type, by id or by its spelling', () => {
		expect(isIdeaTask({ taskTypeId: 'type-idea' }, 'type-idea')).toBe(true);
		expect(isIdeaTask({ issueType: 'Idea' }, null)).toBe(true);
		expect(isIdeaTask({ issueType: 'idea' }, '')).toBe(true);
		expect(isIdeaTask({ issueType: 'Bug', taskTypeId: 'type-bug' }, 'type-idea')).toBe(false);
		expect(isIdeaTask(null, 'type-idea')).toBe(false);
	});

	it.each([
		['pending', 'todo'],
		['queued', 'in_progress'],
		['building', 'in_progress'],
		['accepted', 'done'],
		['dismissed', 'cancelled'],
		['failed', 'blocked'],
		['something-new', null]
	])('EW idea %s → the Gauzy status of EW task %s', (status, expected) =>
		expect(ideaStatusAsTaskStatus(status)).toBe(expected)
	);

	it('G → EW only dismisses (cancelled) a pending idea and restores a dismissed one; nothing else is pushed (D9)', () => {
		expect(ideaStatusAction('pending', 'cancelled')).toBe('dismiss');
		expect(ideaStatusAction('dismissed', 'open')).toBe('restore');
		expect(ideaStatusAction('dismissed', 'backlog')).toBe('restore');
		expect(ideaStatusAction('pending', 'done')).toBeNull();
		expect(ideaStatusAction('pending', 'in-progress')).toBeNull();
		expect(ideaStatusAction('accepted', 'cancelled')).toBeNull();
		expect(ideaStatusAction('dismissed', 'cancelled')).toBeNull();
		// A custom status with no flags leaves the idea as it is.
		expect(ideaStatusAction('pending', 'parked', {})).toBeNull();
		expect(ideaStatusAction('dismissed', 'parked', { isTodo: true })).toBe('restore');
	});

	it('text → HTML escapes everything and keeps paragraphs and line breaks; HTML → text is its inverse', () => {
		const text = 'First <b>line</b> & more\nsecond line\n\nNew paragraph';
		const html = ideaTextToHtml(text);
		expect(html).toBe('<p>First &lt;b&gt;line&lt;/b&gt; &amp; more<br>second line</p><p>New paragraph</p>');
		expect(htmlToIdeaText(html)).toBe(text);
		expect(htmlToIdeaText('<p>One</p><ul><li>a</li><li>b</li></ul><p>&amp;lt; stays</p>')).toBe(
			'One\n\n- a\n\n- b\n\n&lt; stays'
		);
		expect(ideaTextToHtml('   ')).toBe('');
	});

	it('numeric and named character references read as their characters (once: `&amp;lt;` stays `&lt;`)', () => {
		expect(htmlToIdeaText('<p>A&#8212;B &#x27;q&#x27; &rsquo;s &hellip; &amp;lt; &nbsp;x &unknown;</p>')).toBe(
			"A—B 'q' ’s … &lt;  x &unknown;"
		);
	});

	it('the full title opens the description once, and teams Gauzy cannot map stay on the idea', () => {
		const long = 'L'.repeat(130);
		const first = gauzyTaskToIdea(
			{ title: long, description: '<p>Body</p>' },
			{ visibility: 'organization', teamIds: [] }
		);
		// The description came back from Ever Works with the title in it: not prefixed again.
		const again = gauzyTaskToIdea(
			{ title: long, description: ideaTextToHtml(first.description) },
			{ visibility: 'organization', teamIds: [] }
		);
		expect(again.description).toBe(first.description);
		const kept = gauzyTaskToIdea({ title: 'Portal' }, { visibility: 'organization', teamIds: [] }, ['ew-unpaired']);
		expect(kept).toMatchObject({ teamIds: ['ew-unpaired'], visibility: 'team' });
	});

	it('whitespace Gauzy drops never flaps: snapshots keep the text as it reads after a trip through Gauzy', () => {
		const ewText = '  Idea\r\n\r\n\r\n\r\nwith gaps  ';
		const shared = everWorksIdeaShared(
			{ id: 'i1', title: ' Portal ', description: ewText, teamIds: ['b', 'a'] },
			{}
		);
		expect(shared).toEqual({ title: 'Portal', description: 'Idea\n\nwith gaps', teamIds: ['a', 'b'] });
		expect(normalizeIdeaText(htmlToIdeaText(ideaTextToHtml(ewText)))).toBe(shared.description);
		// A partial event keeps what the last sync had.
		expect(everWorksIdeaShared({ id: 'i1', status: 'queued' }, shared)).toEqual(shared);
	});

	it('a Gauzy task makes an idea: the title cut to 120 (the full title opens the description), never an empty description', () => {
		const scope = { visibility: 'team' as const, teamIds: ['ew-t2', 'ew-t1'] };
		const long = 'L'.repeat(130);
		const idea = gauzyTaskToIdea({ title: long, description: '<p>Body</p>' }, scope);
		expect(idea.title).toHaveLength(120);
		expect(idea.description).toBe(`${long}\n\nBody`);
		expect(idea.teamIds).toEqual(['ew-t1', 'ew-t2']);
		expect(idea.visibility).toBe('team');
		expect(
			gauzyTaskToIdea({ title: 'Short', description: '' }, { visibility: 'organization', teamIds: [] })
				.description
		).toBe('Short');
	});

	it('the create body links back to the task; the patch has only what differs from the last sync', () => {
		const now = { title: 'Portal', description: 'Body', teamIds: ['ew-t1'], visibility: 'team' };
		expect(ideaCreateBody(now, 'c1', 'task-1')).toEqual({
			title: 'Portal',
			description: 'Body',
			teamIds: ['ew-t1'],
			visibility: 'team',
			externalRef: { source: 'gauzy', installationId: 'c1', externalId: 'task-1' }
		});
		expect(ideaPatchBody(now, { title: 'Portal', description: 'Body', teamIds: ['ew-t1'] })).toBeNull();
		expect(ideaPatchBody(now, { title: 'Old', description: 'Body', teamIds: ['ew-t1'] })).toEqual({
			title: 'Portal'
		});
		expect(
			ideaPatchBody(
				{ ...now, teamIds: [], visibility: 'organization' },
				{ title: 'Portal', description: 'Body', teamIds: ['ew-t1'] }
			)
		).toEqual({
			teamIds: [],
			visibility: 'organization'
		});
	});

	it('source tags, and the Gauzy task an idea was made from (through this connection only)', () => {
		expect(ideaSourceTag('mission')).toBe('source:mission');
		expect(ideaSourceTag('')).toBeNull();
		const idea = { id: 'i1', externalLinks: [{ source: 'gauzy', installationId: 'c1', externalId: 'task-1' }] };
		expect(gauzyTaskOfIdea(idea, 'c1')).toBe('task-1');
		expect(gauzyTaskOfIdea(idea, 'c2')).toBeNull();
		expect(gauzyTaskOfIdea({ id: 'i2', externalLinks: [{ source: 'other', externalId: 'x' }] }, 'c1')).toBeNull();
	});
});
