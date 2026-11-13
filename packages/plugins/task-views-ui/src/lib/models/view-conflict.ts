import { HttpErrorResponse } from '@angular/common/http';
import { ITaskView, ITaskViewOrderInput, ITaskViewUpdateInput } from '@gauzy/contracts';
import { versionOf } from './view-definition';

/** The code the platform refuses a stale save with. */
export const TASK_VIEW_VERSION_CONFLICT = 'TASK_VIEW_VERSION_CONFLICT';

/**
 * A save (or an order) refused because the view moved on since it was read: the latest view the platform answered
 * with, and what was being saved, so the person can reload (take the latest, drop the edit) or overwrite (send the
 * edit again on the latest version).
 */
export interface TaskViewConflict<
	T extends ITaskViewUpdateInput | ITaskViewOrderInput = ITaskViewUpdateInput | ITaskViewOrderInput
> {
	latest: ITaskView;
	attempted: T;
	/** What the save was: the definition, the order, or the name / visibility. */
	kind: 'save' | 'order' | 'placement';
}

/** The latest view of a 409 version conflict, or null when the error is something else. */
export function latestViewOfConflict(error: unknown): ITaskView | null {
	if (!(error instanceof HttpErrorResponse) && !(error && typeof error === 'object' && 'status' in error))
		return null;
	const response = error as Pick<HttpErrorResponse, 'status' | 'error'>;
	if (response.status !== 409) return null;
	const body = (response.error ?? {}) as { code?: unknown; message?: unknown; view?: unknown };
	const isVersionConflict =
		body.code === TASK_VIEW_VERSION_CONFLICT || String(body.message ?? '').startsWith(TASK_VIEW_VERSION_CONFLICT);
	if (!isVersionConflict) return null;
	const view = body.view as ITaskView | undefined;
	return view && typeof view === 'object' && typeof view.id === 'string' ? view : null;
}

/** The conflict a refused save makes, or null when it was refused for another reason. */
export function conflictOf<T extends ITaskViewUpdateInput | ITaskViewOrderInput>(
	error: unknown,
	attempted: T,
	kind: TaskViewConflict['kind']
): TaskViewConflict<T> | null {
	const latest = latestViewOfConflict(error);
	return latest ? { latest, attempted, kind } : null;
}

/**
 * The same save on the latest version: what Overwrite sends. Only the fields that were being saved go again, so
 * whatever else changed in the latest view (its name, another client's keys) is kept.
 */
export function overwriteInput<T extends ITaskViewUpdateInput | ITaskViewOrderInput>(conflict: TaskViewConflict<T>): T {
	return { ...conflict.attempted, expectedVersion: versionOf(conflict.latest) };
}

/** Whether an error is a refusal that says the view is gone or hidden (deleted, or another person's personal view). */
export function isViewGone(error: unknown): boolean {
	return !!error && typeof error === 'object' && (error as { status?: number }).status === 404;
}
