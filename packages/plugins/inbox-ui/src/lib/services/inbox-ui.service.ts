import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import {
	IEmployeeNotification,
	IInboxItemCounts,
	IInboxItemFindInput,
	IInboxItemPage,
	IInboxItemWithState,
	IInboxRecipientStateInput,
	IInboxReplyInput,
	IMarkAllAsReadResponse,
	IPagination,
	InboxTabEnum
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { INBOX_UI_PAGE_SIZE } from '../inbox-ui.constants';

const INBOX = `${API_PREFIX}/inbox/items`;
const NOTIFICATIONS = `${API_PREFIX}/employee-notification`;

/**
 * The Inbox routes of the API (`@gauzy/plugin-inbox`, `/api/inbox/items*`). They exist only where the API
 * loads the plugin (`GAUZY_INBOX_ENABLED=true`): elsewhere every call answers 404. The recipient is always the
 * signed-in user, taken by the API from the credential.
 */
@Injectable({ providedIn: 'root' })
export class InboxUiService {
	private readonly http = inject(HttpClient);
	private readonly changes = new Subject<void>();

	/** Emits when the page changed my items (read, archived, answered), so the badge counts again at once. */
	readonly changed$: Observable<void> = this.changes.asObservable();

	notifyChanged(): void {
		this.changes.next();
	}

	/** A page of my items for a tab and filters, newest first. */
	list(input: IInboxItemFindInput = {}): Observable<IInboxItemPage> {
		let params = new HttpParams();
		for (const [key, value] of Object.entries(input)) {
			if (value === undefined || value === null || value === '' || value === false) continue;
			params = params.set(key, String(value));
		}
		return this.http.get<IInboxItemPage>(INBOX, { params });
	}

	/** My unread and open-decision counts (the header badge). */
	counts(): Observable<IInboxItemCounts> {
		return this.http.get<IInboxItemCounts>(`${INBOX}/counts`);
	}

	get(id: string): Observable<IInboxItemWithState> {
		return this.http.get<IInboxItemWithState>(`${INBOX}/${encodeURIComponent(id)}`);
	}

	/** Answers a question, an approval or an escalation; the API delivers it to the item's source first. */
	reply(id: string, input: IInboxReplyInput): Observable<IInboxItemWithState> {
		return this.http.post<IInboxItemWithState>(`${INBOX}/${encodeURIComponent(id)}/reply`, input);
	}

	/** My read / archive / snooze state of one item. */
	setState(id: string, input: IInboxRecipientStateInput): Observable<IInboxItemWithState> {
		return this.http.patch<IInboxItemWithState>(`${INBOX}/${encodeURIComponent(id)}/state`, input);
	}

	markAllRead(tab?: InboxTabEnum): Observable<{ updated: number }> {
		return this.http.post<{ updated: number }>(`${INBOX}/mark-all-read`, tab ? { tab } : {});
	}
}

/**
 * Gauzy's own notifications (mentions, assignments, comments: `EmployeeNotification`), read live from
 * `/api/employee-notification` for the Notifications tab — not copied into the inbox (plan 04 §1).
 */
@Injectable({ providedIn: 'root' })
export class InboxNotificationsService {
	private readonly http = inject(HttpClient);

	/**
	 * A page of the notifications addressed to my employee, newest first. The receiver is stated, because a
	 * holder of CHANGE_SELECTED_EMPLOYEE would otherwise read the whole tenant's.
	 */
	list(input: {
		tenantId: string;
		organizationId?: string | null;
		receiverEmployeeId: string;
		skip?: number;
		take?: number;
	}): Observable<IPagination<IEmployeeNotification>> {
		// Strings only: this route parses no booleans out of the query string on every database.
		const where: Record<string, string> = {
			tenantId: input.tenantId,
			receiverEmployeeId: input.receiverEmployeeId
		};
		if (input.organizationId) where['organizationId'] = input.organizationId;
		return this.http.get<IPagination<IEmployeeNotification>>(NOTIFICATIONS, {
			params: toParams({
				where,
				order: { createdAt: 'DESC' },
				skip: input.skip ?? 0,
				take: input.take ?? INBOX_UI_PAGE_SIZE
			})
		});
	}

	markRead(id: string): Observable<IEmployeeNotification> {
		return this.http.put<IEmployeeNotification>(`${NOTIFICATIONS}/${encodeURIComponent(id)}`, {
			isRead: true,
			readAt: new Date()
		});
	}

	markAllRead(): Observable<IMarkAllAsReadResponse> {
		return this.http.put<IMarkAllAsReadResponse>(`${NOTIFICATIONS}/mark-all-read`, {});
	}
}
