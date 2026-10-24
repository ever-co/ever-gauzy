import { IKeyResult, KeyResultTypeEnum, KpiOperatorEnum } from '@gauzy/contracts';

/** Where a progress update moves its key result: the value it now stands at, and the percentage that is. */
export interface IKeyResultProgress {
	update: number;
	progress: number;
}

/** The members of a key result its progress is computed from. */
export type KeyResultProgressInput = Pick<IKeyResult, 'type' | 'initialValue' | 'targetValue'> & {
	kpi?: { operator?: string } | null;
};

/**
 * What a filed progress update moves its key result to.
 *
 * This is the computation the goals page used to run in the browser before it wrote the result back with
 * `PUT /key-results/:id` (`KeyResultUpdateComponent.updateKeyResult`, and `KeyResultDetailsComponent.keyResultUpdate`
 * for a task key result). That route now needs `GOALS_EDIT`, so the server applies a filed update itself (owner
 * decision 2(a), 2026-10-23), and the progress is computed here rather than taken from the request:
 *
 * - **Numerical / Currency:** how far the value has come from the initial value, as a share of the distance to the
 *   target, rounded — `|value - initial| / |target - initial|`, as the page computed it (a key result that counts
 *   down works the same way). A target equal to the initial value has no distance; the page divided by zero there
 *   and saved `NaN` or `Infinity`, and this answers 100 when the value is the target and 0 otherwise.
 * - **True/False and Task:** done (`1`, 100%) or not (`0`, 0%).
 * - **KPI:** 100% once the value reaches the target in the direction the key result's KPI states (`<=` or `>=`,
 *   `>=` when it states none), 0% before. The page read the operator off whichever KPI of the organization the list
 *   happened to return last; this reads the key result's own.
 *
 * @param keyResult - The key result the update reports on.
 * @param value - The value the update reports.
 * @returns The value and the percentage to store on the key result and on the update.
 */
export function keyResultProgress(keyResult: KeyResultProgressInput, value: number): IKeyResultProgress {
	const reported = Number(value) || 0;
	const target = Number(keyResult.targetValue ?? 0) || 0;

	switch (keyResult.type) {
		case KeyResultTypeEnum.TRUE_OR_FALSE:
		case KeyResultTypeEnum.TASK: {
			const done = reported ? 1 : 0;
			return { update: done, progress: done ? 100 : 0 };
		}
		case KeyResultTypeEnum.KPI: {
			const reached =
				keyResult.kpi?.operator === KpiOperatorEnum.LESSER_THAN_EQUAL_TO
					? reported <= target
					: reported >= target;
			return { update: reported, progress: reached ? 100 : 0 };
		}
		case KeyResultTypeEnum.NUMERICAL:
		case KeyResultTypeEnum.CURRENCY:
		default: {
			const initial = Number(keyResult.initialValue ?? 0) || 0;
			const distance = target - initial;
			if (distance === 0) {
				return { update: reported, progress: reported === target ? 100 : 0 };
			}
			return {
				update: reported,
				progress: Math.round((Math.abs(reported - initial) / Math.abs(distance)) * 100)
			};
		}
	}
}

/**
 * A goal's progress: the average of its key results' progress, weighted by each key result's weight — the
 * computation the goals page ran before it wrote the goal back with `PUT /goals/:id` (`calculateGoalProgress`).
 *
 * A weight that is missing or not a number counts as 0, as `+weight` made it on the page. When no key result carries
 * a weight the page divided by zero and saved `NaN`; this answers the plain average instead, and 0 for a goal with no
 * key results.
 *
 * @param keyResults - Every key result of the goal, with the progress each stands at now.
 * @returns The goal's progress, rounded.
 */
export function goalProgress(keyResults: ReadonlyArray<Pick<IKeyResult, 'progress' | 'weight'>>): number {
	if (!keyResults.length) {
		return 0;
	}

	const rows = keyResults.map((keyResult) => ({
		progress: Number(keyResult.progress) || 0,
		weight: Math.max(Number(keyResult.weight) || 0, 0)
	}));
	const totalWeight = rows.reduce((total, row) => total + row.weight, 0);

	if (totalWeight > 0) {
		return Math.round(rows.reduce((total, row) => total + row.progress * row.weight, 0) / totalWeight);
	}

	return Math.round(rows.reduce((total, row) => total + row.progress, 0) / rows.length);
}
