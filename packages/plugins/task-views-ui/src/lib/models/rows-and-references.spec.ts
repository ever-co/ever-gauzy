import { ID, ITask } from '@gauzy/contracts';
import { dayOfInstant, instantOfDay } from './date-input';
import { isMove, moveItem, orderAfterDrop } from './manual-order';
import { appendRows, groupKeysOf, groupRows, nextFocus, visibleOrder } from './row-groups';
import { outcomeOfResolution, parseGoToInput, taskReferenceOf } from './task-reference';

const task = (id: string, extra: Partial<ITask> = {}) => ({ id, title: id, ...extra }) as ITask;

describe('manual order', () => {
	it('moves an item and leaves the list it was given as it is', () => {
		const list = ['a', 'b', 'c', 'd'];
		expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
		expect(moveItem(list, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
		expect(moveItem(list, 9, 0)).toEqual(list);
		expect(list).toEqual(['a', 'b', 'c', 'd']);
		expect(isMove(1, 1, 4)).toBe(false);
		expect(isMove(1, 5, 4)).toBe(false);
		expect(isMove(1, 2, 4)).toBe(true);
	});

	it('keeps the tasks not on the page after it, in the order they had, each once', () => {
		expect(orderAfterDrop(['a', 'b', 'c', 'x', 'y'] as ID[], ['b', 'a', 'c'] as ID[], 5000)).toEqual([
			'b',
			'a',
			'c',
			'x',
			'y'
		]);
		// A task new to the view (not in the stored order) is ordered where it was dropped.
		expect(orderAfterDrop(['a', 'x'] as ID[], ['n', 'a'] as ID[], 5000)).toEqual(['n', 'a', 'x']);
		expect(orderAfterDrop(null, ['b', 'a'] as ID[], 1)).toEqual(['b']);
	});
});

describe('row groups', () => {
	const rows = [
		task('t1', { taskStatusId: 's1', members: [{ id: 'e1' }, { id: 'e2' }] as never, tags: [] }),
		task('t2', { taskStatusId: 's2', members: [] }),
		task('t3', { taskStatus: { id: 's1' } as never })
	];

	it('finds the groups of a task: one per record field, one per member, team or label, none as empty', () => {
		expect(groupKeysOf(rows[0], 'assignee')).toEqual(['e1', 'e2']);
		expect(groupKeysOf(rows[1], 'assignee')).toEqual(['']);
		expect(groupKeysOf(rows[2], 'status')).toEqual(['s1']);
		expect(groupKeysOf(rows[0], 'label')).toEqual(['']);
	});

	it('groups the rows in the order the platform counted, keeping counted groups with no row loaded yet', () => {
		const groups = groupRows(
			rows,
			'status',
			[
				{ key: 's2' as ID, label: 'in-progress', count: 4 },
				{ key: 's3' as ID, label: null, count: 2 },
				{ key: 's1' as ID, label: 'open', count: 2 }
			],
			(key) => (key === 's3' ? 'Blocked' : '')
		);
		expect(groups.map((group) => [group.key, group.label, group.count, group.rows.map((row) => row.id)])).toEqual([
			['s2', 'in-progress', 4, ['t2']],
			['s3', 'Blocked', 2, []],
			['s1', 'open', 2, ['t1', 't3']]
		]);
	});

	it('shows a task under each of its assignees, and walks every task once', () => {
		const groups = groupRows(rows, 'assignee', null);
		expect(groups.map((group) => group.key)).toEqual(['e1', 'e2', '']);
		expect(groups[2].rows.map((row) => row.id)).toEqual(['t2', 't3']);
		expect(visibleOrder(groups)).toEqual(['t1', 't2', 't3']);
		expect(groupRows(rows, 'none', null)).toEqual([{ key: '', label: '', count: null, rows }]);
	});

	it('moves the focus down and up, starting at an end', () => {
		const order = ['a', 'b', 'c'] as ID[];
		expect(nextFocus(order, null, 1)).toBe('a');
		expect(nextFocus(order, null, -1)).toBe('c');
		expect(nextFocus(order, 'b' as ID, 1)).toBe('c');
		expect(nextFocus(order, 'c' as ID, 1)).toBe('c');
		expect(nextFocus([], null, 1)).toBeNull();
	});

	it('appends a page without listing a task twice', () => {
		expect(appendRows([task('a'), task('b')], [task('b'), task('c')]).map((row) => row.id)).toEqual([
			'a',
			'b',
			'c'
		]);
	});
});

describe('task references', () => {
	it('shows the project key and the number, else what the task was always shown with', () => {
		expect(taskReferenceOf({ number: 42, prefix: 'Api', project: { taskKey: 'API' } })).toBe('API-42');
		expect(
			taskReferenceOf({ number: 42, prefix: 'Api', taskNumber: 'Api-42', project: { taskKey: 'bad key' } })
		).toBe('Api-42');
		expect(taskReferenceOf({ number: 7, prefix: 'Ful' })).toBe('Ful-7');
		expect(taskReferenceOf({ number: undefined, prefix: 'Ful' })).toBeNull();
		expect(taskReferenceOf(null)).toBeNull();
	});

	it('reads what was typed into the go-to box', () => {
		expect(parseGoToInput(' #api-42 ')).toEqual({ kind: 'reference', reference: 'API-42', key: 'API', number: 42 });
		expect(
			parseGoToInput('https://app.gauzy.co/#/pages/tasks/view/5F0D2A58-1C6B-4A8A-9C4B-6E0C9D2B3A11?x=1')
		).toEqual({ kind: 'id', id: '5f0d2a58-1c6b-4a8a-9c4b-6e0c9d2b3a11' });
		expect(parseGoToInput('5f0d2a58-1c6b-4a8a-9c4b-6e0c9d2b3a11').kind).toBe('id');
		expect(parseGoToInput('API-0').kind).toBe('invalid');
		expect(parseGoToInput('A-1').kind).toBe('invalid');
		expect(parseGoToInput('hello').kind).toBe('invalid');
		expect(parseGoToInput('').kind).toBe('invalid');
	});

	it('opens a resolved task, says when it moved, and refuses to guess', () => {
		expect(
			outcomeOfResolution(
				{
					reference: 'API-42',
					key: 'API',
					number: 42,
					resolved: true,
					taskId: 't' as ID,
					currentKey: 'API',
					currentNumber: 42
				},
				'API-42'
			)
		).toEqual({
			kind: 'open',
			taskId: 't',
			reference: 'API-42',
			title: undefined
		});
		expect(
			outcomeOfResolution(
				{
					reference: 'API-42',
					key: 'API',
					number: 42,
					resolved: true,
					taskId: 't' as ID,
					formerReference: true,
					currentKey: 'SYS',
					currentNumber: 3
				},
				'API-42'
			)
		).toMatchObject({
			kind: 'moved',
			current: 'SYS-3'
		});
		expect(
			outcomeOfResolution(
				{ reference: 'API-42', key: 'API', number: 42, resolved: false, ambiguous: true },
				'API-42'
			).kind
		).toBe('ambiguous');
		expect(
			outcomeOfResolution({ reference: 'API-42', key: 'API', number: 42, resolved: false }, 'API-42').kind
		).toBe('not-found');
		expect(outcomeOfResolution(undefined, 'API-42').kind).toBe('not-found');
	});
});

describe('date fields of the filter editor', () => {
	it('turns a picked day into the bound the condition holds, and back', () => {
		const from = instantOfDay('2026-11-20', 'from') as string;
		expect(new Date(from).getDate()).toBe(20);
		// The platform reads the upper bound of "between" with <=: the last instant of the day, never the next midnight.
		const until = new Date(instantOfDay('2026-11-20', 'until') as string);
		expect([
			until.getDate(),
			until.getHours(),
			until.getMinutes(),
			until.getSeconds(),
			until.getMilliseconds()
		]).toEqual([20, 23, 59, 59, 999]);
		expect(until.getTime() + 1).toBe(new Date(2026, 10, 21).getTime());
		expect(dayOfInstant(from, 'from')).toBe('2026-11-20');
		expect(dayOfInstant(until.toISOString(), 'until')).toBe('2026-11-20');
		expect(instantOfDay('20/11/2026', 'from')).toBeNull();
		expect(dayOfInstant('nope', 'from')).toBe('');
	});
});
