/**
 * G-P2-1 Goals ↔ Goal + KeyResults: the pure mappers (plan 01 §6) — the time-frame resolver, weight
 * buckets, the key results an Ever Works goal makes, the Ever Works goal a Gauzy goal makes (never a
 * status), and the push plan against the last sync.
 */
import { KeyResultDeadlineEnum, KeyResultTypeEnum, KeyResultWeightEnum } from '@gauzy/contracts';
import {
	bucketWeight,
	everWorksGoalShared,
	gauzyGoalToEverWorks,
	goalCreateBody,
	goalPushPlan,
	isCurrencyUnit,
	keyResultsOfGoal,
	progressBetween,
	quarterOf,
	resolveTimeFrame,
	weightBucket
} from './ever-works-goal.mapper';

describe('goal time frames', () => {
	const frames = [
		{ name: '2026', status: 'Active', startDate: '2026-01-01', endDate: '2026-12-31' },
		{ name: 'Q4 2026 (sales)', status: 'Active', startDate: '2026-10-01', endDate: '2026-12-31' },
		{ name: 'November', status: 'Inactive', startDate: '2026-11-01', endDate: '2026-11-30' }
	];

	it('quarters are named Q<n> <yyyy> with their first and last day (UTC)', () => {
		const q = quarterOf(new Date('2026-11-15T10:00:00Z'));
		expect(q.name).toBe('Q4 2026');
		expect(q.startDate.toISOString()).toBe('2026-10-01T00:00:00.000Z');
		expect(q.endDate.toISOString()).toBe('2026-12-31T23:59:59.999Z');
		expect(quarterOf(new Date('2027-02-01T00:00:00Z')).name).toBe('Q1 2027');
	});

	it('picks the narrowest ACTIVE time frame containing the deadline, by day', () => {
		expect(resolveTimeFrame('2026-11-15T00:00:00.000Z', frames)).toEqual({ name: 'Q4 2026 (sales)' });
		expect(resolveTimeFrame('2026-12-31T23:00:00.000Z', frames)).toEqual({ name: 'Q4 2026 (sales)' });
		expect(resolveTimeFrame('2026-03-01T00:00:00.000Z', frames)).toEqual({ name: '2026' });
	});

	it('else creates the quarter (once: a quarter of that name is reused); no deadline → null', () => {
		const resolved = resolveTimeFrame('2027-05-20T00:00:00.000Z', frames);
		expect(resolved?.name).toBe('Q2 2027');
		expect(resolved?.create?.startDate.toISOString()).toBe('2027-04-01T00:00:00.000Z');
		expect(
			resolveTimeFrame('2027-05-20T00:00:00.000Z', [
				...frames,
				{ name: 'Q2 2027', status: 'Inactive', startDate: '2027-04-01', endDate: '2027-06-30' }
			])
		).toEqual({ name: 'Q2 2027' });
		expect(resolveTimeFrame(null, frames)).toBeNull();
		expect(resolveTimeFrame('not a date', frames)).toBeNull();
	});
});

describe('key results of an Ever Works goal', () => {
	it('weights bucket ≤0.33 → 1, ≤0.66 → 2, else 4, and come back as numbers', () => {
		expect(weightBucket(0.2)).toBe(KeyResultWeightEnum.DEFAULT);
		expect(weightBucket(0.5)).toBe(KeyResultWeightEnum.INCREASE_BY_2X);
		expect(weightBucket(0.8)).toBe(KeyResultWeightEnum.INCREASE_BY_4X);
		expect([bucketWeight('1'), bucketWeight('2'), bucketWeight('4'), bucketWeight(null)]).toEqual([1, 2, 4, 1]);
		expect(isCurrencyUnit('USD')).toBe(true);
		expect(isCurrencyUnit('€')).toBe(true);
		expect(isCurrencyUnit('customers')).toBe(false);
		expect(progressBetween(96, 80, 120)).toBe(40);
		expect(progressBetween(2.2, 3, 2)).toBe(80);
	});

	it('one per weighted criterion (value and progress from the score), and one True/False per approved DoD item', () => {
		const results = keyResultsOfGoal({
			id: 'g1',
			title: 'Grow',
			goalKind: 'metric',
			unit: 'customers',
			deadline: '2026-12-31T00:00:00.000Z',
			criteria: [
				{ id: 'kr-signups', name: 'New signups', weight: 2, target: 50, direction: 'gte', unit: 'signups' },
				{ id: 'kr-mrr', name: 'MRR', weight: 1, target: 5000, direction: 'gte', unit: 'USD' }
			],
			resolvedScore: {
				score: 0.6,
				criteria: [{ id: 'kr-signups', value: 30, target: 50, weight: 0.6667, ratio: 0.6, satisfied: false }]
			},
			dodCriteria: [
				{ id: 'launch', text: 'Pricing page launched', status: 'done' },
				{ id: 'waived', text: 'Survey', status: 'waived' },
				{ id: 'open', text: 'Blog post', status: 'open' },
				{ id: 'idea', text: 'Planner idea', status: 'open', proposed: true }
			]
		});
		expect(results.map((r) => r.key)).toEqual(['c:kr-signups', 'c:kr-mrr', 'd:launch', 'd:waived', 'd:open']);
		expect(results[0]).toMatchObject({
			type: KeyResultTypeEnum.NUMERICAL,
			targetValue: 50,
			update: 30,
			progress: 60
		});
		expect(results[0].weight).toBe(KeyResultWeightEnum.INCREASE_BY_4X);
		expect(results[1]).toMatchObject({
			type: KeyResultTypeEnum.CURRENCY,
			update: 0,
			progress: 0,
			weight: KeyResultWeightEnum.INCREASE_BY_2X
		});
		expect(results[2]).toMatchObject({
			type: KeyResultTypeEnum.TRUE_OR_FALSE,
			update: 1,
			progress: 100,
			deadline: KeyResultDeadlineEnum.HARD_DEADLINE
		});
		expect(results[3]).toMatchObject({ update: 1, progress: 100 });
		expect(results[4]).toMatchObject({ update: 0, progress: 0 });
	});

	it('a metric goal without criteria makes one key result from its target, current value and baseline', () => {
		const [metric] = keyResultsOfGoal({
			id: 'g1',
			title: 'Customers',
			goalKind: 'metric',
			targetValue: 120,
			baselineValue: 80,
			currentValue: 96,
			unit: 'customers'
		});
		expect(metric).toMatchObject({
			key: 'm',
			name: 'Customers',
			targetValue: 120,
			initialValue: 80,
			update: 96,
			progress: 40,
			deadline: KeyResultDeadlineEnum.NO_CUSTOM_DEADLINE
		});
		expect(keyResultsOfGoal({ id: 'g2', title: 'Ship', goalKind: 'delivery', dodCriteria: [] })).toEqual([]);
	});
});

describe('the Ever Works goal of a Gauzy goal', () => {
	const kr = (id: string, type: string, extra: Record<string, unknown> = {}) => ({
		id,
		name: `KR ${id}`,
		type,
		targetValue: 10,
		initialValue: 0,
		unit: 'deals',
		update: 0,
		progress: 0,
		weight: '1',
		...extra
	});

	it('one numeric key result → a metric goal on its own target; True/False ones → the Definition of Done', () => {
		const shared = gauzyGoalToEverWorks(
			{ name: 'Close deals', description: 'Q4' },
			'2026-12-31T23:59:59.999Z',
			[kr('a', 'Numerical', { initialValue: 2 }), kr('b', 'True/False', { update: 1 })],
			['ew-t1']
		);
		expect(shared).toMatchObject({
			title: 'Close deals',
			goalKind: 'metric',
			comparator: 'gte',
			targetValue: 10,
			unit: 'deals',
			baselineValue: 2,
			criteria: [],
			dodCriteria: [{ id: 'b', text: 'KR b', status: 'done' }],
			teamIds: ['ew-t1']
		});
	});

	it('several numeric key results → weighted criteria (linked ones keep their Ever Works id); none → a delivery goal', () => {
		const shared = gauzyGoalToEverWorks(
			{ name: 'Grow' },
			null,
			[
				kr('a', 'Numerical', { weight: '4' }),
				kr('b', 'Currency', { targetValue: 2, initialValue: 5, ewKey: 'c:kr-churn' })
			],
			[]
		);
		expect(shared?.criteria).toEqual([
			{ id: 'a', name: 'KR a', weight: 4, target: 10, direction: 'gte', unit: 'deals' },
			{ id: 'kr-churn', name: 'KR b', weight: 1, target: 2, direction: 'lte', unit: 'deals' }
		]);
		expect(gauzyGoalToEverWorks({ name: 'Ship' }, null, [kr('c', 'True/False')], [])).toMatchObject({
			goalKind: 'delivery',
			targetValue: null,
			dodCriteria: [{ id: 'c', status: 'open' }]
		});
		// Nothing Ever Works could hold yet: no numeric and no True/False key result.
		expect(gauzyGoalToEverWorks({ name: 'Empty' }, null, [kr('t', 'Task')], [])).toBeNull();
		// The kind is fixed once the goal exists in Ever Works.
		expect(gauzyGoalToEverWorks({ name: 'Grow' }, null, [kr('d', 'True/False')], [], 'metric')).toBeNull();
	});

	it('the create body never carries a status (always a draft) and reads the external metric source', () => {
		const shared = gauzyGoalToEverWorks({ name: 'Grow' }, null, [kr('a', 'Numerical')], []);
		const body = goalCreateBody(shared!, { source: 'gauzy', externalId: 'goal-1' });
		expect(body).not.toHaveProperty('status');
		expect(body).not.toHaveProperty('outcome');
		expect(body).toMatchObject({
			goalKind: 'metric',
			metricSource: { pluginId: 'external', metricId: 'value' },
			window: 'point',
			visibility: 'organization',
			externalRef: { externalId: 'goal-1' }
		});
	});

	it('the push plan sends only what differs from the last sync: a PATCH, the criteria, the Definition of Done', () => {
		const now = gauzyGoalToEverWorks(
			{ name: 'Grow' },
			null,
			[kr('a', 'Numerical'), kr('b', 'Numerical'), kr('c', 'True/False')],
			[]
		)!;
		expect(goalPushPlan(now, now)).toEqual({ patch: null, criteria: false, dod: false });
		const renamed = { ...now, title: 'Grow faster', teamIds: ['ew-t1'] };
		expect(goalPushPlan(renamed, now)).toEqual({
			patch: { title: 'Grow faster', teamIds: ['ew-t1'], visibility: 'team' },
			criteria: false,
			dod: false
		});
		expect(goalPushPlan({ ...now, dodCriteria: [{ id: 'c', text: 'KR c', status: 'done' }] }, now)).toMatchObject({
			patch: null,
			dod: true
		});
		expect(goalPushPlan({ ...now, criteria: now.criteria.slice(1) }, now)).toMatchObject({ criteria: true });
		const fromEverWorks = everWorksGoalShared({
			id: 'g1',
			title: ' Grow ',
			goalKind: 'metric',
			criteria: null,
			dodCriteria: [{ id: 'x', text: 'Planner', status: 'open', proposed: true }]
		});
		expect(fromEverWorks).toMatchObject({ title: 'Grow', criteria: [], dodCriteria: [] });
	});
});
