import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { combineLatest, defer, Observable, of, throwError, timer } from 'rxjs';
import { catchError, distinctUntilChanged, map, retry, shareReplay, switchMap } from 'rxjs/operators';
import { IOrganization, IUser, TaskBuiltInViewEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { TaskViewsApiService, TaskViewsScope } from './task-views-api.service';

/** Attempts after a temporary failure, and the first delay (doubled each time: 5 s … 80 s). */
export const TASK_VIEWS_AVAILABILITY_RETRIES = 5;
export const TASK_VIEWS_AVAILABILITY_RETRY_MS = 5_000;

/** A refusal that retrying does not change: 404 (the extensions are off), 401 and 403 (not for this user). */
export function isFinalRefusal(error: HttpErrorResponse | null | undefined): boolean {
	return error?.status === 404 || error?.status === 401 || error?.status === 403;
}

/** The signed-in user in the selected organization: what the views are asked for. */
export interface TaskViewsUserScope extends TaskViewsScope {
	userId: string;
}

/**
 * Whether the API serves the task views extensions to the signed-in user in the selected organization: asked once
 * per scope with one task of the built-in "mine" view (`GET /tasks/built-in/mine`), again when the user or the
 * organization changes. The platform answers that route only when `GAUZY_TASK_VIEWS_ENABLED=true`; elsewhere (the
 * default) it answers 404 and the app shows no Views entry, no keyboard shortcuts and no reference chip.
 */
@Injectable({ providedIn: 'root' })
export class TaskViewsAvailabilityService {
	private readonly store = inject(Store);
	private readonly api = inject(TaskViewsApiService);

	/** The current scope, or null before sign-in or without an organization. */
	readonly scope$: Observable<TaskViewsUserScope | null> = combineLatest([
		this.store.user$ as Observable<IUser | null | undefined>,
		this.store.selectedOrganization$ as Observable<IOrganization | null | undefined>
	]).pipe(
		map(([user, organization]) =>
			user?.id && organization?.id
				? {
						userId: String(user.id),
						organizationId: organization.id,
						...(organization.tenantId || user.tenantId ? { tenantId: (organization.tenantId ?? user.tenantId) as string } : {})
					}
				: null
		),
		distinctUntilChanged((a, b) => a?.userId === b?.userId && a?.organizationId === b?.organizationId && a?.tenantId === b?.tenantId),
		shareReplay({ bufferSize: 1, refCount: false })
	);

	/**
	 * `true` once the API answered for the scope. A final refusal is `false` at once; a temporary failure (5xx,
	 * network) is retried with a growing delay, so an API that recovers after the app started still shows the views.
	 * A new scope cancels a request in flight, so a late answer never applies to the next user.
	 */
	readonly available$: Observable<boolean> = this.scope$.pipe(
		switchMap((scope) =>
			!scope
				? of(false)
				: defer(() => this.api.builtIn(TaskBuiltInViewEnum.MINE, scope, 0, 1)).pipe(
						retry({
							count: TASK_VIEWS_AVAILABILITY_RETRIES,
							delay: (error: HttpErrorResponse, attempt: number) =>
								isFinalRefusal(error) ? throwError(() => error) : timer(TASK_VIEWS_AVAILABILITY_RETRY_MS * 2 ** (attempt - 1))
						}),
						map(() => true),
						catchError(() => of(false))
					)
		),
		distinctUntilChanged(),
		shareReplay({ bufferSize: 1, refCount: false })
	);
}
