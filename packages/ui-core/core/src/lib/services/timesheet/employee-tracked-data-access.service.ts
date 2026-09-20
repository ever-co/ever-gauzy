import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, combineLatest, Observable, of } from 'rxjs';
import { catchError, distinctUntilChanged, map, retry, startWith, switchMap } from 'rxjs/operators';
import { IOrganization, IRolePermission, IUser, PermissionsEnum } from '@gauzy/contracts';
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
				map(([organization, user, permissions]: [IOrganization, IUser, IRolePermission[]]) =>
					// Until the permissions are loaded the admin exemption cannot be evaluated, so decide nothing yet
					permissions?.length && this.isHiddenByOrganization(organization, user)
						? { organization, userId: user.id }
						: null
				),
				distinctUntilChanged((a, b) => a?.organization.id === b?.organization.id && a?.userId === b?.userId),
				switchMap((restricted) =>
					restricted ? this.fetchAccess(restricted.organization) : of('allowed' as const)
				)
			)
			.subscribe((access) => this._access$.next(access));
	}

	/**
	 * Whether navigation to tracked-data pages should be hidden. Only a settled answer hides anything: a
	 * user the API allows never loses menu entries while the probe is in flight.
	 */
	get hidden(): boolean {
		return this._access$.value === 'hidden';
	}

	/**
	 * Whether an HTTP error is a 403 raised while the organization hides tracked data from this employee.
	 * It reads the selected organization synchronously, so callers can stay quiet about it even before
	 * {@link access$} has settled — at the cost of also absorbing any other 403 they hit meanwhile.
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
				params: { tenantId: organization.tenantId }
			})
			.pipe(
				map((response): EmployeeTrackedDataAccess => (response?.allowed === true ? 'allowed' : 'hidden')),
				retry({ count: 2, delay: 2000 }),
				// A failed probe leaves navigation as it is: the API enforces the setting on every request, so a
				// network error must not hide pages from a manager or redirect anyone
				catchError(() => of('pending' as const)),
				startWith('pending' as const)
			);
	}
}
