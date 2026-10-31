import { ITimeTrackerFormState } from '../../shared/features/time-tracker-form/time-tracker-form.service';

/**
 * The selectors whose values make up the time tracker's own selection, in the order they are chosen: each one's list
 * depends on the choices before it (a client's projects, a project's teams, a project's and team's tasks).
 */
export const SELECTOR_FIELDS = ['clientId', 'projectId', 'teamId', 'taskId'] as const;

/** A selector of the time tracker's form. */
export type SelectorField = (typeof SELECTOR_FIELDS)[number];

/** The fields of the time tracker's form: its selectors and the note. */
const FORM_FIELDS: ReadonlyArray<keyof ITimeTrackerFormState> = [...SELECTOR_FIELDS, 'note'];

type MaybeState = Partial<ITimeTrackerFormState> | null | undefined;

/** Whether the time tracker has a selection of its own: a client, project, team or task picked. */
export function hasSelection(state: MaybeState): boolean {
	return SELECTOR_FIELDS.some((field) => !!state?.[field]);
}

/**
 * One selection out of several sources, each field taken from the first source that has it: e.g. the form, then the
 * selection saved on this device (a saved choice the selectors could not show yet still counts as a choice).
 */
export function mergeSelections(...states: MaybeState[]): Partial<ITimeTrackerFormState> {
	const merged: Partial<ITimeTrackerFormState> = {};
	for (const field of FORM_FIELDS) {
		const value = states.find((state) => !!state?.[field])?.[field];
		if (value) {
			merged[field] = value;
		}
	}
	return merged;
}

/** Whether `state` has exactly the selector values of `expected` (a selector missing in `expected` is empty). */
export function sameSelection(state: MaybeState, expected: MaybeState): boolean {
	return SELECTOR_FIELDS.every((field) => (state?.[field] || '') === (expected?.[field] || ''));
}

/** The part of `applied` that `state` still has: what was not changed since. */
export function keptSelection(state: MaybeState, applied: MaybeState): Partial<ITimeTrackerFormState> {
	const kept: Partial<ITimeTrackerFormState> = {};
	for (const field of FORM_FIELDS) {
		if (applied?.[field] && state?.[field] === applied[field]) {
			kept[field] = applied[field];
		}
	}
	return kept;
}
