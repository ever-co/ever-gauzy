import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { combineLatest, concat, defer, Observable, of, throwError, timer } from 'rxjs';
import { catchError, distinctUntilChanged, map, retry, shareReplay, switchMap } from 'rxjs/operators';
import { IOrganization, IUser, TaskBuiltInViewEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { TaskViewsApiService, TaskViewsScope } from './task-views-api.service';

/** Attempts after a temporary failure, and the first delay (doubled each time: 5 s … 80 s). */
export const TASK_VIEWS_AVAILABILITY_RETRIES = 5;
export const TASK_VIEWS_AVAILABILITY_RETRY_MS = 5_000;
/**
 * Once those attempts ran out on a temporary failure, the API is asked again later, every 5 minutes, at most 6
 * times (about three quarters of an hour in all): an API that recovers meanwhile shows the views without a reload,
 * and one that stays down is not asked for ever.
 */
export const TASK_VIEWS_AVAILABILITY_REPROBES = 6;
export const TASK_VIEWS_AVAILABILITY_REPROBE_MS = 5 * 60_000;

/**
 * A failure that asking again can change: no answer at all (the network, status 0), a server error (5xx), a timeout
 * (408) or too many requests (429). Every other refusal is final: 404 (the extensions are off), 401 and 403 (not for
 * this user), any other 4xx (the same request would be refused again), and an error that is no HTTP answer.
 */
export function isTemporaryFailure(error: unknown): boolean {
	const status = (error as { status?: unknown } | null | undefined)?.status;
	if (typeof status !== 'number') return false;
	return status === 0 || status === 408 || status === 429 || status >= 500;
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
						...(organization.tenantId || user.tenantId
							? { tenantId: (organization.tenantId ?? user.tenantId) as string }
							: {})
					}
				: null
		),
		distinctUntilChanged(
			(a, b) => a?.userId === b?.userId && a?.organizationId === b?.organizationId && a?.tenantId === b?.tenantId
		),
		shareReplay({ bufferSize: 1, refCount: false })
	);

	/**
	 * `true` once the API answered for the scope. A final refusal is `false` at once; a temporary failure (network,
	 * 5xx, 408, 429) is retried with a growing delay, then asked again every few minutes for a while, so an API that
	 * recovers after the app started still shows the views. A new scope cancels a request in flight, so a late answer
	 * never applies to the next user.
	 */
	readonly available$: Observable<boolean> = this.scope$.pipe(
		switchMap((scope) =>
			!scope
				? of(false)
				: // `false` first: a new scope (another organization) is not served until it has answered itself.
					concat(
						of(false),
						defer(() => this.api.builtIn(TaskBuiltInViewEnum.MINE, scope, 0, 1)).pipe(
							retry({
								count: TASK_VIEWS_AVAILABILITY_RETRIES,
								delay: (error: HttpErrorResponse, attempt: number) =>
									isTemporaryFailure(error)
										? timer(TASK_VIEWS_AVAILABILITY_RETRY_MS * 2 ** (attempt - 1))
										: throwError(() => error)
							}),
							// The attempts ran out on a temporary failure: another round later, a bounded number of times.
							retry({
								count: TASK_VIEWS_AVAILABILITY_REPROBES,
								delay: (error: HttpErrorResponse) =>
									isTemporaryFailure(error)
										? timer(TASK_VIEWS_AVAILABILITY_REPROBE_MS)
										: throwError(() => error)
							}),
							map(() => true),
							catchError(() => of(false))
						)
					)
		),
		distinctUntilChanged(),
		shareReplay({ bufferSize: 1, refCount: false })
	);
}
