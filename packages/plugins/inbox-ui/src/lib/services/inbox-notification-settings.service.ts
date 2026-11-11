import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ID, IEmployeeNotificationSetting, IInboxDeliveryStatus, IPagination } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

const SETTINGS = `${API_PREFIX}/employee-notification-setting`;
const DELIVERY_STATUS = `${API_PREFIX}/inbox/delivery/status`;

/** What a save sends: the per-kind switches and / or the preferences (`employeeId` is the caller's own, set by the API). */
export type IInboxNotificationSettingInput = Partial<
	Pick<IEmployeeNotificationSetting, 'payment' | 'assignment' | 'invitation' | 'mention' | 'comment' | 'message' | 'preferences'>
>;

/** Whether an API answer is the row (TypeORM) rather than an update count (MikroORM). */
export function isSettingRow(answer: unknown): answer is IEmployeeNotificationSetting {
	return !!answer && typeof answer === 'object' && typeof (answer as { id?: unknown }).id === 'string' && !!(answer as { id: string }).id;
}

/** Where a row lives. */
export interface IInboxNotificationSettingScope {
	tenantId: ID;
	organizationId: ID;
	employeeId: ID;
}

/**
 * The employee notification setting (`/api/employee-notification-setting`): one row per employee, the per-kind
 * switches and the delivery preferences the Inbox's email delivery reads. A missing row means every kind is on and
 * every email goes at once.
 */
@Injectable({ providedIn: 'root' })
export class InboxNotificationSettingsService {
	private readonly http = inject(HttpClient);

	/**
	 * Which channels the Inbox can deliver through for the selected organization (`GET /inbox/delivery/status`), or
	 * null when the server does not say: an older one, or one without the delivery plugin (404), or a failed read.
	 * Null changes nothing on the page. The organization is the request's own (its header, checked by the API), so the
	 * caller asks again whenever the selected organization changes.
	 */
	deliveryStatus(): Observable<IInboxDeliveryStatus | null> {
		return this.http
			.get<IInboxDeliveryStatus>(DELIVERY_STATUS)
			.pipe(
				// Both email fields are needed: a partial answer is "unknown", never "off".
				map((status) =>
					status && typeof status === 'object' && typeof status.email?.enabled === 'boolean' && typeof status.email?.available === 'boolean'
						? status
						: null
				),
				catchError(() => of(null))
			);
	}

	/** The employee's row, or null when they never changed a preference. */
	forEmployee(scope: IInboxNotificationSettingScope): Observable<IEmployeeNotificationSetting | null> {
		return this.http
			.get<IPagination<IEmployeeNotificationSetting>>(SETTINGS, {
				params: toParams({
					where: { tenantId: scope.tenantId, organizationId: scope.organizationId, employeeId: scope.employeeId },
					take: 1
				})
			})
			.pipe(map((page) => page?.items?.[0] ?? null));
	}

	/** Files the row for the caller's own employee (`preferences` is required by the API's DTO). */
	create(scope: IInboxNotificationSettingScope, input: IInboxNotificationSettingInput): Observable<IEmployeeNotificationSetting> {
		return this.http.post<IEmployeeNotificationSetting>(SETTINGS, {
			...input,
			preferences: input.preferences ?? {},
			tenantId: scope.tenantId,
			organizationId: scope.organizationId
		});
	}

	/**
	 * Updates the row and answers it: the API answers the row on TypeORM and `{ affected }` on MikroORM, so an answer
	 * that is no row is followed by a read of the row (gone meanwhile: an error, as a refused save).
	 */
	update(id: ID, scope: IInboxNotificationSettingScope, input: IInboxNotificationSettingInput): Observable<IEmployeeNotificationSetting> {
		return this.http
			.put<IEmployeeNotificationSetting | { affected?: number }>(`${SETTINGS}/${encodeURIComponent(String(id))}`, {
				...input,
				tenantId: scope.tenantId,
				organizationId: scope.organizationId
			})
			.pipe(
				switchMap((answer) =>
					isSettingRow(answer)
						? of(answer)
						: this.forEmployee(scope).pipe(
								switchMap((row) => (row ? of(row) : throwError(() => new Error('The notification setting is gone.'))))
						  )
				)
			);
	}
}
