import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, combineLatest, Observable, of } from 'rxjs';
import { catchError, distinctUntilChanged, map, startWith, switchMap } from 'rxjs/operators';
import { IOrganization, IUser, PermissionsEnum } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { Store } from '../store/store.service';

/**
 * Visibility of tracked data for the current user in the selected organization:
 * - `allowed`: visible (the default).
 * - `pending`: the organization hides it from employees and the API has not answered yet.
 * - `hidden`: hidden from the current user.
 */
export type EmployeeTrackedDataAccess = 'allowed' | 'pending' | 'hidden';

/**
 * Mirrors the API's `EmployeeTrackedDataGuard` for the UI: whether the organization setting
 * `allowEmployeeToSeeTrackedData` hides tracked data (screenshots, activity, app/URL history,
 * time logs) from the current user.
 *
 * Only an organization with the setting off costs a request. The API applies the guard's exemptions
 * (admins, users without an employee record, managers of a team or project in the organization),
 * which the user payload cannot tell on its own.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeTrackedDataAccessService {
	private readonly _http = inject(HttpClient);
	private readonly _store = inject(Store);
	private readonly _access$ = new BehaviorSubject<EmployeeTrackedDataAccess>('allowed');

	/** The current visibility; see {@link EmployeeTrackedDataAccess}. */
	readonly access$: Observable<EmployeeTrackedDataAccess> = this._access$.pipe(distinctUntilChanged());

	constructor() {
		combineLatest([this._store.selectedOrganization$, this._store.user$, this._store.userRolePermissions$])
			.pipe(
				map(([organization, user]) =>
					this.isHiddenByOrganization(organization, user) ? { organization, userId: user.id } : null
				),
				distinctUntilChanged((a, b) => a?.organization.id === b?.organization.id && a?.userId === b?.userId),
				switchMap((restricted) =>
					restricted ? this.fetchAccess(restricted.organization) : of('allowed' as const)
				)
			)
			.subscribe((access) => this._access$.next(access));
	}

	/** Whether navigation to tracked-data pages should be hidden (also while the API has not answered). */
	get hidden(): boolean {
		return this._access$.value !== 'allowed';
	}

	/**
	 * Whether an HTTP error is the 403 the API returns while the setting hides tracked data.
	 * Checks the selected organization synchronously, so callers can stay quiet about it even before
	 * {@link access$} has settled.
	 */
	isHiddenDataError(error: unknown): boolean {
		return (
			(error as { status?: number })?.status === 403 &&
			this.isHiddenByOrganization(this._store.selectedOrganization, this._store.user)
		);
	}

	/**
	 * The setting is off and the user is an employee without CHANGE_SELECTED_EMPLOYEE,
	 * so only the API can tell whether a manager exemption applies.
	 */
	private isHiddenByOrganization(organization: IOrganization | null, user: IUser | null): boolean {
		return (
			organization?.allowEmployeeToSeeTrackedData === false &&
			!!(user?.employee?.id || user?.employeeId) &&
			!this._store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
		);
	}

	private fetchAccess(organization: IOrganization): Observable<EmployeeTrackedDataAccess> {
		return this._http
			.get<{ allowed: boolean }>(`${API_PREFIX}/timesheet/statistics/tracked-data-access`, {
				params: { organizationId: organization.id, tenantId: organization.tenantId }
			})
			.pipe(
				map((response): EmployeeTrackedDataAccess => (response?.allowed === true ? 'allowed' : 'hidden')),
				catchError(() => of('hidden' as const)),
				startWith('pending' as const)
			);
	}
}
