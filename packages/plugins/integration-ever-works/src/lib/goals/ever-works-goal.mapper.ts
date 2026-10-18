import { KeyResultDeadlineEnum, KeyResultTypeEnum, KeyResultWeightEnum } from '@gauzy/contracts';

/**
 * Goals ↔ Goal + KeyResults (plan 01 §6, plan 06 G-P2-1). Pure functions: the time-frame resolver, the
 * key results an Ever Works goal makes, and the Ever Works goal a Gauzy goal makes.
 */

/** A weighted success criterion of an Ever Works goal (contract v1 `goal.schema.json#/$defs/Criterion`). */
export interface EverWorksGoalCriterion {
	id: string;
	name: string;
	weight: number;
	target: number;
	direction: 'gte' | 'lte';
	unit?: string;
	metricSource?: { pluginId: string; metricId: string; params?: Record<string, unknown> };
	window?: string;
}

/** A Definition-of-Done item of an Ever Works goal (`DoDCriterion`). */
export interface EverWorksGoalDoD {
	id: string;
	text: string;
	status: 'open' | 'done' | 'waived';
	evidence?: string | null;
	note?: string | null;
	source?: 'operator' | 'planner';
	proposed?: boolean;
}

/** An Ever Works goal (contract v1 goal DTO, EW-P2-2; also the `data` of `goal.*` events). */
export interface EverWorksGoal {
	id: string;
	organizationId?: string;
	version?: number;
	updatedAt?: string;
	visibility?: string;
	owner?: { type: 'user' | 'agent' | 'integration'; id: string } | null;
	externalLinks?: Array<{
		source: string;
		installationId?: string | null;
		externalId: string;
		externalUrl?: string | null;
	}>;
	teamIds?: string[];
	title?: string;
	description?: string | null;
	goalKind?: 'metric' | 'delivery';
	status?: 'draft' | 'active' | 'paused' | 'completed';
	outcome?: string | null;
	comparator?: 'gte' | 'lte' | null;
	targetValue?: number | null;
	unit?: string | null;
	window?: string | null;
	baselineValue?: number | null;
	currentValue?: number | null;
	deadline?: string | null;
	criteria?: EverWorksGoalCriterion[] | null;
	resolvedScore?: {
		score: number;
		criteria: Array<{
			id: string;
			value: number | null;
			target: number;
			weight: number;
			ratio: number;
			satisfied: boolean;
		}>;
	} | null;
	dodCriteria?: EverWorksGoalDoD[] | null;
	progress?: number | null;
	missionIds?: string[];
	primaryMissionId?: string | null;
	assignedAgentId?: string | null;
	activeAgentId?: string | null;
	loop?: { status: string | null; iteration: number; spentCents: number } | null;
	archivedAt?: string | null;
	webUrl?: string | null;
	deleted?: boolean;
}

// ── Time frames ──────────────────────────────────────────────────────────────────────────────

/** A Gauzy goal time frame (`goal_time_frame`). */
export interface GoalTimeFrameRow {
	id?: string;
	name: string;
	status?: string | null;
	startDate: Date | string;
	endDate: Date | string;
}

/** The calendar quarter of a date (UTC): `Q<n> <yyyy>` with its first and last day. */
export function quarterOf(date: Date): { name: string; startDate: Date; endDate: Date } {
	const year = date.getUTCFullYear();
	const quarter = Math.floor(date.getUTCMonth() / 3);
	return {
		name: `Q${quarter + 1} ${year}`,
		startDate: new Date(Date.UTC(year, quarter * 3, 1)),
		endDate: new Date(Date.UTC(year, quarter * 3 + 3, 0, 23, 59, 59, 999))
	};
}

const day = (value: Date | string) => {
	const date = new Date(value);
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

/**
 * EW → G (plan 01 §6): the Gauzy time frame of an Ever Works deadline — the narrowest **active** time
 * frame that contains the date (by day), else a new quarter time frame `Q<n> <yyyy>` (`create`). `null`
 * for no or an invalid deadline (the goal keeps its time frame).
 */
export function resolveTimeFrame(
	deadline: string | Date | null | undefined,
	frames: ReadonlyArray<GoalTimeFrameRow>
): { name: string; create?: { name: string; startDate: Date; endDate: Date } } | null {
	if (!deadline) return null;
	const date = new Date(deadline);
	if (Number.isNaN(date.getTime())) return null;
	const at = day(date);
	const containing = frames
		.filter(
			(frame) => (frame.status ?? 'Active') === 'Active' && day(frame.startDate) <= at && at <= day(frame.endDate)
		)
		.sort((a, b) => day(a.endDate) - day(a.startDate) - (day(b.endDate) - day(b.startDate)));
	if (containing.length) return { name: containing[0].name };
	const quarter = quarterOf(date);
	const sameName = frames.find((frame) => frame.name === quarter.name);
	return sameName ? { name: sameName.name } : { name: quarter.name, create: quarter };
}

// ── Key results (EW → G) ──────────────────────────────────────────────────────────────────────

/** The weight bucket of a normalised criterion weight (plan 01 §6): ≤ 0.33 → 1, ≤ 0.66 → 2, else 4. */
export function weightBucket(normalised: number): KeyResultWeightEnum {
	if (normalised <= 0.33) return KeyResultWeightEnum.DEFAULT;
	if (normalised <= 0.66) return KeyResultWeightEnum.INCREASE_BY_2X;
	return KeyResultWeightEnum.INCREASE_BY_4X;
}

/** G → EW: a Gauzy key result weight as an Ever Works criterion weight. */
export function bucketWeight(weight: string | null | undefined): number {
	const value = Number(weight);
	return value === 2 || value === 4 ? value : 1;
}

/** Whether a unit is a currency (an ISO 4217 code or a currency sign): such a key result is `Currency`. */
export function isCurrencyUnit(unit: string | null | undefined): boolean {
	const value = String(unit ?? '').trim();
	return /^[A-Z]{3}$/.test(value) || /^[$€£¥₹₽₩₪₫₺₴₦]$/.test(value);
}

/**
 * The key of a key result on its goal's link: `m` (a metric goal without criteria), `c:<criterion id>`
 * or `d:<Definition-of-Done id>`. A key result link's Ever Works id is `<goal id>:<key>`.
 */
export type KeyResultKey = string;

/** A Gauzy key result as an Ever Works goal makes it (the shared fields; Gauzy-only fields are kept). */
export interface DesiredKeyResult {
	key: KeyResultKey;
	name: string;
	type: KeyResultTypeEnum;
	targetValue: number | null;
	initialValue: number;
	unit: string | null;
	update: number;
	progress: number;
	weight: KeyResultWeightEnum;
	deadline: KeyResultDeadlineEnum;
	hardDeadline: string | null;
}

const clampProgress = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
/**
 * A key result's target, start and current values are integer columns in Gauzy: an Ever Works value is
 * stored rounded (an explicit conversion; Ever Works keeps the exact value, and Gauzy only sends one back
 * when a person changed it).
 */
const stored = (value: number) => Math.round(value);

/** Progress of a value between a baseline and a target (either direction), 0..100. */
export function progressBetween(
	value: number | null | undefined,
	baseline: number | null | undefined,
	target: number | null | undefined
): number {
	if (!finite(value) || !finite(target)) return 0;
	const from = finite(baseline) ? baseline : 0;
	if (target === from) return value === target ? 100 : 0;
	return clampProgress(((value - from) / (target - from)) * 100);
}

/**
 * EW → G (plan 01 §6): the key results of an Ever Works goal — one per weighted criterion (`Numerical`,
 * or `Currency` for a currency unit; weight bucketed; value and progress from the last score), one for a
 * metric goal without criteria (from its target / current / baseline / unit), and one `True/False` per
 * approved Definition-of-Done item (open → 0, done or waived → 100). Proposed items are not part of the
 * finish line and make none.
 */
export function keyResultsOfGoal(goal: EverWorksGoal): DesiredKeyResult[] {
	const deadline = goal.deadline ?? null;
	const deadlineFields = deadline
		? { deadline: KeyResultDeadlineEnum.HARD_DEADLINE, hardDeadline: deadline }
		: { deadline: KeyResultDeadlineEnum.NO_CUSTOM_DEADLINE, hardDeadline: null };
	const results: DesiredKeyResult[] = [];
	const criteria = goal.criteria ?? [];
	if (criteria.length) {
		const total = criteria.reduce((sum, c) => sum + (finite(c.weight) && c.weight > 0 ? c.weight : 0), 0) || 1;
		for (const criterion of criteria) {
			const score = goal.resolvedScore?.criteria?.find((row) => row.id === criterion.id);
			const unit = criterion.unit ?? goal.unit ?? null;
			results.push({
				key: `c:${criterion.id}`,
				name: criterion.name,
				type: isCurrencyUnit(unit) ? KeyResultTypeEnum.CURRENCY : KeyResultTypeEnum.NUMERICAL,
				targetValue: finite(criterion.target) ? stored(criterion.target) : null,
				initialValue: 0,
				unit,
				update: finite(score?.value) ? stored(score?.value as number) : 0,
				progress: score ? clampProgress(score.ratio * 100) : 0,
				weight: weightBucket((finite(criterion.weight) ? criterion.weight : 0) / total),
				...deadlineFields
			});
		}
	} else if (goal.goalKind !== 'delivery' && finite(goal.targetValue)) {
		const baseline = finite(goal.baselineValue) ? goal.baselineValue : 0;
		results.push({
			key: 'm',
			name: goal.title ?? 'Metric',
			type: isCurrencyUnit(goal.unit) ? KeyResultTypeEnum.CURRENCY : KeyResultTypeEnum.NUMERICAL,
			targetValue: stored(goal.targetValue),
			initialValue: stored(baseline),
			unit: goal.unit ?? null,
			update: stored(finite(goal.currentValue) ? goal.currentValue : baseline),
			progress: finite(goal.progress)
				? clampProgress(goal.progress)
				: progressBetween(goal.currentValue, baseline, goal.targetValue),
			weight: KeyResultWeightEnum.DEFAULT,
			...deadlineFields
		});
	}
	for (const item of goal.dodCriteria ?? []) {
		if (item.proposed) continue;
		const closed = item.status === 'done' || item.status === 'waived';
		results.push({
			key: `d:${item.id}`,
			name: item.text,
			type: KeyResultTypeEnum.TRUE_OR_FALSE,
			targetValue: 1,
			initialValue: 0,
			unit: null,
			update: closed ? 1 : 0,
			progress: closed ? 100 : 0,
			weight: KeyResultWeightEnum.DEFAULT,
			...deadlineFields
		});
	}
	return results;
}

// ── G → EW ─────────────────────────────────────────────────────────────────────────────────────

/** A Gauzy key result as the push reads it. `ewKey` is its key on the goal's link when it is linked. */
export interface GauzyKeyResultRow {
	id: string;
	name: string;
	type: string;
	targetValue?: number | null;
	initialValue?: number | null;
	unit?: string | null;
	update?: number | null;
	progress?: number | null;
	weight?: string | null;
	ewKey?: KeyResultKey | null;
}

/** The Ever Works side of a Gauzy goal, in the form both directions compare (the link snapshot). */
export interface GoalShared {
	title: string;
	description: string | null;
	deadline: string | null;
	teamIds: string[];
	goalKind: 'metric' | 'delivery';
	comparator: 'gte' | 'lte' | null;
	targetValue: number | null;
	unit: string | null;
	baselineValue: number | null;
	criteria: GoalCriterionShared[];
	dodCriteria: GoalDoDShared[];
}

/** A criterion as both directions compare it: Ever Works' own details (source, window) ride along. */
export interface GoalCriterionShared {
	id: string;
	name: string;
	weight: number;
	target: number;
	direction: 'gte' | 'lte';
	unit?: string;
	metricSource?: { pluginId: string; metricId: string; params?: Record<string, unknown> };
	window?: string;
}

/** An approved Definition-of-Done item as both directions compare it (evidence and note ride along). */
export interface GoalDoDShared {
	id: string;
	text: string;
	status: 'open' | 'done' | 'waived';
	evidence?: string | null;
	note?: string | null;
}

/** The fields of a key result an Ever Works goal writes, as compared and kept on its link. */
export type KeyResultShared = Omit<DesiredKeyResult, 'key'>;

function same(a: unknown, b: unknown): boolean {
	return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Ever Works' title limit (`CreateGoal.title`). */
export const EVER_WORKS_GOAL_TITLE_MAX = 200;

const numeric = (row: GauzyKeyResultRow) =>
	row.type === KeyResultTypeEnum.NUMERICAL || row.type === KeyResultTypeEnum.CURRENCY;
const isTrueFalse = (row: GauzyKeyResultRow) => row.type === KeyResultTypeEnum.TRUE_OR_FALSE;
const keyId = (row: GauzyKeyResultRow, prefix: 'c' | 'd') =>
	row.ewKey?.startsWith(`${prefix}:`) ? row.ewKey.slice(2) : row.id;

/**
 * G → EW (plan 01 §6): the Ever Works goal of a Gauzy goal and its key results. Numeric key results
 * (`Numerical`, `Currency`) make a **metric** goal — the first sets the goal's own comparator, target,
 * unit and baseline; with more than one, each is a weighted criterion — else the goal is a **delivery**
 * goal. `True/False` key results are its Definition of Done (done when updated to 1 or 100 %). Task and
 * KPI key results stay in Gauzy. `null` when there is nothing Ever Works could hold yet (a delivery goal
 * needs at least one Definition-of-Done item): the goal is pushed once it has a key result.
 */
export function gauzyGoalToEverWorks(
	goal: { name?: string | null; description?: string | null },
	deadline: string | null,
	keyResults: ReadonlyArray<GauzyKeyResultRow>,
	teamIds: ReadonlyArray<string>,
	existingKind?: 'metric' | 'delivery' | null
): GoalShared | null {
	const numbers = keyResults.filter(numeric);
	const kind = existingKind ?? (numbers.length ? 'metric' : 'delivery');
	const dodCriteria = keyResults.filter(isTrueFalse).map((row) => ({
		id: keyId(row, 'd'),
		text:
			String(row.name ?? '')
				.trim()
				.slice(0, 500) || 'Done',
		status: (Number(row.update) >= 1 || Number(row.progress) >= 100 ? 'done' : 'open') as 'open' | 'done'
	}));
	const shared: GoalShared = {
		title: String(goal.name ?? '')
			.trim()
			.slice(0, EVER_WORKS_GOAL_TITLE_MAX),
		description: goal.description ? String(goal.description) : null,
		deadline,
		teamIds: [...teamIds].sort(),
		goalKind: kind,
		comparator: null,
		targetValue: null,
		unit: null,
		baselineValue: null,
		criteria: [],
		dodCriteria
	};
	if (kind === 'metric') {
		const first = numbers[0];
		if (!first || !finite(first.targetValue)) return null;
		const baseline = finite(first.initialValue) ? first.initialValue : 0;
		Object.assign(shared, {
			comparator: (first.targetValue as number) >= baseline ? 'gte' : 'lte',
			targetValue: first.targetValue,
			unit:
				String(first.unit ?? '')
					.trim()
					.slice(0, 32) || 'units',
			baselineValue: baseline
		});
		if (numbers.length > 1) {
			shared.criteria = numbers
				.filter((row) => finite(row.targetValue))
				.map((row) => {
					const from = finite(row.initialValue) ? row.initialValue : 0;
					const unit = String(row.unit ?? '')
						.trim()
						.slice(0, 32);
					return {
						id: keyId(row, 'c'),
						name:
							String(row.name ?? '')
								.trim()
								.slice(0, 200) || 'Key result',
						weight: bucketWeight(row.weight),
						target: row.targetValue as number,
						direction: ((row.targetValue as number) >= from ? 'gte' : 'lte') as 'gte' | 'lte',
						...(unit ? { unit } : {})
					};
				});
		}
	} else if (!dodCriteria.length) {
		return null;
	}
	if (!shared.title) return null;
	return shared;
}

/** A Gauzy key result with what its link holds (what Ever Works made of it at the last sync). */
export interface LinkedKeyResultRow extends GauzyKeyResultRow {
	snapshot?: Partial<KeyResultShared> | null;
}

const text = (value: string | null | undefined, max: number) =>
	String(value ?? '')
		.trim()
		.slice(0, max);

/** A new numeric key result as a criterion (its direction from its start value). */
function criterionOf(row: GauzyKeyResultRow): GoalCriterionShared {
	const from = finite(row.initialValue) ? row.initialValue : 0;
	const unit = text(row.unit, 32);
	return {
		id: keyId(row, 'c'),
		name: text(row.name, 200) || 'Key result',
		weight: bucketWeight(row.weight),
		target: row.targetValue as number,
		direction: (row.targetValue as number) >= from ? 'gte' : 'lte',
		...(unit ? { unit } : {})
	};
}

/**
 * A linked Gauzy goal in Ever Works' terms while the mapping does not sync key results (OQ4): its own fields (title,
 * description, deadline, teams) over the last sync, and the fields Ever Works builds from key results (the metric,
 * the criteria, the Definition of Done) exactly as the last sync left them. Unlike `mergeGauzyGoal`, it needs no key
 * result: a goal whose key results never synced still pushes its own edits.
 */
export function mergeGauzyGoalOwnFields(
	goal: { name?: string | null; description?: string | null },
	deadline: string | null,
	teamIds: ReadonlyArray<string>,
	before: Partial<GoalShared>
): GoalShared {
	return {
		title: text(goal.name, EVER_WORKS_GOAL_TITLE_MAX) || before.title || '',
		description: goal.description ? String(goal.description) : null,
		deadline,
		teamIds: [...teamIds].sort(),
		goalKind: before.goalKind ?? 'delivery',
		comparator: before.comparator ?? null,
		targetValue: before.targetValue ?? null,
		unit: before.unit ?? null,
		baselineValue: before.baselineValue ?? null,
		criteria: before.criteria ?? [],
		dodCriteria: before.dodCriteria ?? []
	};
}

/**
 * G → EW for a goal already in Ever Works: Ever Works' own goal, criteria and Definition of Done as last
 * synced, with **only what a person changed in Gauzy** since (each key result against its link): a
 * renamed key result or a new target, a changed weight or unit, a checked item. What Gauzy only holds
 * rounded or bucketed (exact values, weights, directions, sources, windows, evidence) stays as Ever Works
 * has it. A key result deleted in Gauzy leaves; a new one joins (a second numeric one turns the goal's
 * own metric into weighted criteria). `null` when Ever Works could not hold the result (a delivery goal
 * without a Definition of Done).
 */
export function mergeGauzyGoal(
	goal: { name?: string | null; description?: string | null },
	deadline: string | null,
	rows: ReadonlyArray<LinkedKeyResultRow>,
	teamIds: ReadonlyArray<string>,
	before: GoalShared
): GoalShared | null {
	const changed = (row: LinkedKeyResultRow, field: 'name' | 'targetValue' | 'initialValue' | 'unit' | 'weight') =>
		!row.snapshot || !same(row[field] ?? null, row.snapshot[field] ?? null);
	const byKey = new Map(rows.filter((row) => row.ewKey).map((row) => [row.ewKey as string, row]));
	const fresh = rows.filter((row) => !row.ewKey);
	const shared: GoalShared = {
		...before,
		title: text(goal.name, EVER_WORKS_GOAL_TITLE_MAX) || before.title,
		description: goal.description ? String(goal.description) : null,
		deadline,
		teamIds: [...teamIds].sort(),
		criteria: [],
		dodCriteria: []
	};
	if (before.goalKind === 'metric') {
		const own = byKey.get('m');
		if (own && numeric(own)) {
			if (changed(own, 'targetValue') && finite(own.targetValue)) shared.targetValue = own.targetValue;
			if (changed(own, 'initialValue') && finite(own.initialValue)) shared.baselineValue = own.initialValue;
			if (changed(own, 'unit') && text(own.unit, 32)) shared.unit = text(own.unit, 32);
			if ((changed(own, 'targetValue') || changed(own, 'initialValue')) && finite(shared.targetValue)) {
				shared.comparator = shared.targetValue >= (shared.baselineValue ?? 0) ? 'gte' : 'lte';
			}
		}
		const added = fresh.filter((row) => numeric(row) && finite(row.targetValue)).map(criterionOf);
		if (before.criteria.length) {
			for (const criterion of before.criteria) {
				const row = byKey.get(`c:${criterion.id}`);
				if (!row || !numeric(row)) continue;
				const unit = text(row.unit, 32);
				shared.criteria.push({
					...criterion,
					...(changed(row, 'name') && text(row.name, 200) ? { name: text(row.name, 200) } : {}),
					...(changed(row, 'targetValue') && finite(row.targetValue) ? { target: row.targetValue } : {}),
					...(changed(row, 'weight') ? { weight: bucketWeight(row.weight) } : {}),
					...(changed(row, 'unit') && unit ? { unit } : {})
				});
			}
			shared.criteria.push(...added);
		} else if (added.length && own && numeric(own) && finite(own.targetValue)) {
			// A second numeric key result: the goal's own metric becomes the first weighted criterion.
			shared.criteria = [criterionOf({ ...own, ewKey: null }), ...added];
		}
	}
	for (const item of before.dodCriteria) {
		const row = byKey.get(`d:${item.id}`);
		if (!row || !isTrueFalse(row)) continue;
		const checked = Number(row.update) >= 1 || Number(row.progress) >= 100;
		const moved =
			!row.snapshot ||
			Number(row.update ?? 0) !== Number(row.snapshot.update ?? 0) ||
			Number(row.progress ?? 0) !== Number(row.snapshot.progress ?? 0);
		shared.dodCriteria.push({
			...item,
			...(changed(row, 'name') && text(row.name, 500) ? { text: text(row.name, 500) } : {}),
			...(moved ? { status: checked ? 'done' : 'open' } : {})
		});
	}
	shared.dodCriteria.push(
		...fresh.filter(isTrueFalse).map((row) => ({
			id: keyId(row, 'd'),
			text: text(row.name, 500) || 'Done',
			status: (Number(row.update) >= 1 || Number(row.progress) >= 100 ? 'done' : 'open') as 'open' | 'done'
		}))
	);
	if (before.goalKind === 'delivery' && !shared.dodCriteria.length) return null;
	return shared;
}

/** Whether Gauzy may send these criteria back: only the external source can be written (Ever Works answers 422 otherwise). */
export function criteriaWritable(criteria: ReadonlyArray<GoalCriterionShared>): boolean {
	return criteria.every((criterion) => !criterion.metricSource || criterion.metricSource.pluginId === 'external');
}

/** The Ever Works side of an Ever Works goal, in the form both directions compare (its link snapshot). */
export function everWorksGoalShared(goal: EverWorksGoal, before: Partial<GoalShared> = {}): GoalShared {
	return {
		title: goal.title !== undefined ? goal.title.trim() : (before.title ?? ''),
		description: goal.description !== undefined ? (goal.description ?? null) : (before.description ?? null),
		deadline: goal.deadline !== undefined ? (goal.deadline ?? null) : (before.deadline ?? null),
		teamIds: [...(goal.teamIds ?? before.teamIds ?? [])].sort(),
		goalKind: goal.goalKind ?? before.goalKind ?? 'metric',
		comparator: goal.comparator !== undefined ? (goal.comparator ?? null) : (before.comparator ?? null),
		targetValue: goal.targetValue !== undefined ? (goal.targetValue ?? null) : (before.targetValue ?? null),
		unit: goal.unit !== undefined ? (goal.unit ?? null) : (before.unit ?? null),
		baselineValue: goal.baselineValue !== undefined ? (goal.baselineValue ?? null) : (before.baselineValue ?? null),
		criteria:
			goal.criteria !== undefined
				? (goal.criteria ?? []).map((c) => ({
						id: c.id,
						name: c.name,
						weight: c.weight,
						target: c.target,
						direction: c.direction,
						...(c.unit ? { unit: c.unit } : {}),
						...(c.metricSource ? { metricSource: c.metricSource } : {}),
						...(c.window ? { window: c.window } : {})
					}))
				: (before.criteria ?? []),
		// Planner proposals are not part of the finish line (and `PUT /dod` takes approved items only).
		dodCriteria:
			goal.dodCriteria !== undefined
				? (goal.dodCriteria ?? [])
						.filter((item) => !item.proposed)
						.map((item) => ({
							id: item.id,
							text: item.text,
							status: item.status,
							...(item.evidence != null ? { evidence: item.evidence } : {}),
							...(item.note != null ? { note: item.note } : {})
						}))
				: (before.dodCriteria ?? [])
	};
}

/** The writes a Gauzy goal needs in Ever Works against the last sync: a `PATCH` body, and the sets to `PUT`. */
export function goalPushPlan(
	now: GoalShared,
	before: Partial<GoalShared>
): { patch: Record<string, unknown> | null; criteria: boolean; dod: boolean } {
	const patch: Record<string, unknown> = {};
	if (now.title && now.title !== before.title) patch['title'] = now.title;
	if (!same(now.description, before.description)) patch['description'] = now.description;
	if (!same(now.deadline, before.deadline)) patch['deadline'] = now.deadline;
	if (!same(now.teamIds, [...(before.teamIds ?? [])].sort())) {
		patch['teamIds'] = now.teamIds;
		patch['visibility'] = now.teamIds.length ? 'team' : 'organization';
	}
	if (now.goalKind === 'metric') {
		if (now.comparator && now.comparator !== before.comparator) patch['comparator'] = now.comparator;
		if (finite(now.targetValue) && now.targetValue !== before.targetValue) patch['targetValue'] = now.targetValue;
		if (now.unit && now.unit !== before.unit) patch['unit'] = now.unit;
		if (!same(now.baselineValue, before.baselineValue)) patch['baselineValue'] = now.baselineValue;
	}
	return {
		patch: Object.keys(patch).length ? patch : null,
		criteria: now.goalKind === 'metric' && !same(now.criteria, before.criteria ?? []),
		dod: !same(now.dodCriteria, before.dodCriteria ?? [])
	};
}

/** `POST /goals` body (contract v1 `CreateGoal`): always created `draft` by Ever Works; a metric goal reads the external source. */
export function goalCreateBody(now: GoalShared, externalRef: Record<string, unknown>): Record<string, unknown> {
	return {
		title: now.title,
		description: now.description,
		goalKind: now.goalKind,
		...(now.goalKind === 'metric'
			? {
					metricSource: { pluginId: 'external', metricId: 'value' },
					comparator: now.comparator,
					targetValue: now.targetValue,
					unit: now.unit,
					window: 'point',
					baselineValue: now.baselineValue,
					...(now.criteria.length ? { criteria: now.criteria } : {})
				}
			: {}),
		...(now.dodCriteria.length ? { dodCriteria: now.dodCriteria } : {}),
		deadline: now.deadline,
		teamIds: now.teamIds,
		visibility: now.teamIds.length ? 'team' : 'organization',
		externalRef
	};
}
