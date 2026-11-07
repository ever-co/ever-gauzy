import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ID, IEmployeeNotificationSetting, IPagination } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

const SETTINGS = `${API_PREFIX}/employee-notification-setting`;

/** What a save sends: the per-kind switches and / or the preferences (`employeeId` is the caller's own, set by the API). */
export type IInboxNotificationSettingInput = Partial<
	Pick<IEmployeeNotificationSetting, 'payment' | 'assignment' | 'invitation' | 'mention' | 'comment' | 'message' | 'preferences'>
>;

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

	update(id: ID, scope: IInboxNotificationSettingScope, input: IInboxNotificationSettingInput): Observable<IEmployeeNotificationSetting> {
		return this.http.put<IEmployeeNotificationSetting>(`${SETTINGS}/${encodeURIComponent(String(id))}`, {
			...input,
			tenantId: scope.tenantId,
			organizationId: scope.organizationId
		});
	}
}
