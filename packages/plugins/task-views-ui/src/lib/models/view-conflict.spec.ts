import { HttpErrorResponse } from '@angular/common/http';
import { ID, ITaskView, ITaskViewOrderInput, ITaskViewUpdateInput } from '@gauzy/contracts';
import {
	conflictOf,
	isViewGone,
	latestViewOfConflict,
	overwriteInput,
	TASK_VIEW_VERSION_CONFLICT
} from './view-conflict';
import { definitionOf, saveInput } from './view-definition';

const latest: ITaskView = {
	id: 'v1' as ID,
	name: 'Backend bugs',
	version: 7,
	filterOptions: { filter: { op: 'and', conditions: [] }, teamsKey: ['kept'] },
	organizationId: 'org' as ID
};

const conflictError = (body: unknown) => new HttpErrorResponse({ status: 409, error: body, url: '/api/task-views/v1' });

describe('version conflicts', () => {
	it('reads the latest view from a 409 version conflict', () => {
		expect(
			latestViewOfConflict(conflictError({ code: TASK_VIEW_VERSION_CONFLICT, message: 'stale', view: latest }))
		).toBe(latest);
		// Older servers name the code in the message only.
		expect(
			latestViewOfConflict(
				conflictError({
					message: `${TASK_VIEW_VERSION_CONFLICT}: the view is at version 7, not 6.`,
					view: latest
				})
			)
		).toBe(latest);
	});

	it('is no conflict for another 409, another status, or a conflict without the latest view', () => {
		expect(latestViewOfConflict(conflictError({ code: 'PROJECT_KEY_TAKEN', view: latest }))).toBeNull();
		expect(
			latestViewOfConflict(
				new HttpErrorResponse({ status: 400, error: { code: TASK_VIEW_VERSION_CONFLICT, view: latest } })
			)
		).toBeNull();
		expect(latestViewOfConflict(conflictError({ code: TASK_VIEW_VERSION_CONFLICT }))).toBeNull();
		expect(latestViewOfConflict(new Error('network'))).toBeNull();
		expect(latestViewOfConflict(null)).toBeNull();
	});

	it('keeps what was being saved beside the latest view', () => {
		const attempted: ITaskViewUpdateInput = { name: 'Mine', expectedVersion: 6 };
		expect(
			conflictOf(conflictError({ code: TASK_VIEW_VERSION_CONFLICT, view: latest }), attempted, 'placement')
		).toEqual({ latest, attempted, kind: 'placement' });
		expect(conflictOf(conflictError({ code: 'OTHER' }), attempted, 'save')).toBeNull();
	});

	it('overwrites with the same fields on the latest version', () => {
		const attempted: ITaskViewOrderInput = {
			taskIds: ['b', 'a'] as ID[],
			expectedVersion: 6,
			organizationId: 'org' as ID
		};
		expect(overwriteInput({ latest, attempted, kind: 'order' })).toEqual({
			taskIds: ['b', 'a'],
			expectedVersion: 7,
			organizationId: 'org'
		});
		expect(
			overwriteInput({ latest: { ...latest, version: undefined }, attempted, kind: 'order' }).expectedVersion
		).toBe(1);
	});

	it('rebuilds a save on the latest view so the keys other clients keep in it survive an overwrite', () => {
		const mine = { ...definitionOf(latest), groupBy: 'status' as const };
		const input = saveInput(latest, mine, { organizationId: 'org' as ID });
		expect(input.expectedVersion).toBe(7);
		expect(input.filterOptions).toEqual({
			filter: null,
			groupBy: 'status',
			orderBy: { field: 'createdAt', direction: 'desc' },
			teamsKey: ['kept']
		});
	});

	it('says a view is gone on 404', () => {
		expect(isViewGone(new HttpErrorResponse({ status: 404 }))).toBe(true);
		expect(isViewGone(new HttpErrorResponse({ status: 500 }))).toBe(false);
	});
});
