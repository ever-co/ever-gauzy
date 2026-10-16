import {
	EVER_WORKS_TASK_STATUSES,
	everWorksPriorityToGauzy,
	everWorksStatusToGauzy,
	gauzyPriorityToEverWorks,
	gauzyStatusSlug,
	gauzyStatusToEverWorks,
	resolveGauzyStatusRow
} from './status-priority.mapper';

describe('status mapping (plan 01 §7.1)', () => {
	it.each([
		['backlog', 'backlog', 'isTodo'],
		['todo', 'open', 'isTodo'],
		['in_progress', 'in-progress', 'isInProgress'],
		['in_review', 'in-review', 'isInProgress'],
		['blocked', 'blocked', 'isInProgress'],
		['done', 'done', 'isDone'],
		['cancelled', 'cancelled', null]
	])('EW %s → G %s (fallback %s)', (ew, slug, flag) => {
		expect(everWorksStatusToGauzy(ew)).toEqual({ slug, flag });
	});

	it('EW → G: an unknown status maps to nothing', () => {
		expect(everWorksStatusToGauzy('archived')).toBeNull();
		expect(everWorksStatusToGauzy(undefined)).toBeNull();
	});

	it.each([
		['backlog', 'backlog'],
		['open', 'todo'],
		['Open', 'todo'],
		['in-progress', 'in_progress'],
		['In Progress', 'in_progress'],
		['in_progress', 'in_progress'],
		['ready-for-review', 'in_review'],
		['in-review', 'in_review'],
		['blocked', 'blocked'],
		['done', 'done'],
		['completed', 'done'],
		['cancelled', 'cancelled']
	])('G %s → EW %s', (g, ew) => {
		expect(gauzyStatusToEverWorks(g)).toBe(ew);
	});

	it('G → EW: a custom status maps by its flags, done first; no flag → unchanged', () => {
		expect(gauzyStatusToEverWorks('shipped', { isDone: true, isInProgress: true })).toBe('done');
		expect(gauzyStatusToEverWorks('qa', { isInProgress: true })).toBe('in_progress');
		expect(gauzyStatusToEverWorks('triage', { isTodo: true })).toBe('todo');
		expect(gauzyStatusToEverWorks('parked', {})).toBeNull();
	});

	it('round-trips every Ever Works status through its Gauzy slug', () => {
		for (const status of EVER_WORKS_TASK_STATUSES) {
			expect(gauzyStatusToEverWorks(everWorksStatusToGauzy(status)!.slug)).toBe(status);
		}
	});

	it('resolves the Gauzy row by slug, then by flag; cancelled → a row with no flag', () => {
		const rows = [
			{ value: 'Ready', isTodo: true },
			{ value: 'Doing', isInProgress: true },
			{ value: 'Shipped', isDone: true },
			{ value: 'Dropped' },
			{ value: 'in-review', isInProgress: true }
		];
		expect(resolveGauzyStatusRow('in_review', rows)?.value).toBe('in-review');
		expect(resolveGauzyStatusRow('in_progress', rows)?.value).toBe('Doing');
		expect(resolveGauzyStatusRow('todo', rows)?.value).toBe('Ready');
		expect(resolveGauzyStatusRow('done', rows)?.value).toBe('Shipped');
		expect(resolveGauzyStatusRow('cancelled', rows)?.value).toBe('Dropped');
		expect(resolveGauzyStatusRow('nonsense', rows)).toBeNull();
		expect(gauzyStatusSlug(' In_Review ')).toBe('in-review');
	});
});

describe('priority mapping (plan 01 §7)', () => {
	it.each([
		['p0', 'urgent'],
		['p1', 'high'],
		['p2', 'medium'],
		['p3', 'medium'],
		['p4', 'low'],
		['P1', 'high'],
		['p9', null]
	])('EW %s → G %s', (ew, g) => expect(everWorksPriorityToGauzy(ew)).toBe(g));

	it.each([
		['urgent', 'p0'],
		['high', 'p1'],
		['medium', 'p3'],
		['Medium', 'p3'],
		['low', 'p4'],
		['custom', null],
		[null, null]
	])('G %s → EW %s', (g, ew) => expect(gauzyPriorityToEverWorks(g)).toBe(ew));
});
