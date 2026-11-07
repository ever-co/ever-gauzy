import { taskDescriptionOf, taskMentionsIn, taskTitleOf } from './chat-task-references';

describe('taskMentionsIn', () => {
	it('finds the typed references, upper-cased and each once, and the tasks linked by id', () => {
		const body = 'See API-12 and api-12, then GZY-7; https://app.ever.team/en/task/8d7f2a3e-1b2c-4d5e-8f90-123456789abc and ' + 'https://app.gauzy.co/#/pages/tasks/dashboard?taskId=8D7F2A3E-1B2C-4D5E-8F90-123456789ABC plus /tasks/0a1b2c3d-4e5f-4a6b-8c7d-9e8f7a6b5c4d ' + 'and the Gauzy task page https://app.gauzy.co/#/pages/tasks/view/5a1b2c3d-4e5f-4a6b-8c7d-9e8f7a6b5c4d';
		expect(taskMentionsIn(body)).toEqual({
			typed: ['API-12', 'GZY-7'],
			linked: ['8d7f2a3e-1b2c-4d5e-8f90-123456789abc', '0a1b2c3d-4e5f-4a6b-8c7d-9e8f7a6b5c4d', '5a1b2c3d-4e5f-4a6b-8c7d-9e8f7a6b5c4d']
		});
	});

	it('finds nothing in a body without them', () => {
		expect(taskMentionsIn('a plain message, with a date 2026-11 and a path /task/not-an-id')).toEqual({ typed: [], linked: [] });
		expect(taskMentionsIn(null)).toEqual({ typed: [], linked: [] });
	});
});

describe('taskTitleOf', () => {
	it('takes the first line without the mention tokens, and cuts a long one', () => {
		expect(taskTitleOf('<@emp-1> please fix the login   page\n\nmore details')).toBe('please fix the login page');
		expect(taskTitleOf('\n  \nSecond line is first')).toBe('Second line is first');
		expect(taskTitleOf('x'.repeat(300), 20)).toBe('x'.repeat(19) + '…');
		expect(taskTitleOf('')).toBe('');
	});
});

describe('taskDescriptionOf', () => {
	it('keeps the text as escaped HTML: a paragraph per block, a break per line, the mention tokens dropped', () => {
		expect(taskDescriptionOf('<@emp-1> Fix <b>rendering</b>\nof the "login" page\n\nSee API-12')).toBe('<p>Fix &lt;b&gt;rendering&lt;/b&gt;<br>of the &quot;login&quot; page</p><p>See API-12</p>');
		expect(taskDescriptionOf('  \n\n')).toBe('');
		expect(taskDescriptionOf(null)).toBe('');
	});
});
