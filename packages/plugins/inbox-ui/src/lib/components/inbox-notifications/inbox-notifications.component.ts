import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NbAlertModule, NbButtonModule, NbIconModule, NbListModule, NbSpinnerModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { combineLatest, EMPTY, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { IEmployeeNotification } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { INBOX_UI_PAGE_SIZE } from '../../inbox-ui.constants';
import { InboxNotificationsService } from '../../services/inbox-ui.service';

/** Who the tab reads for: the signed-in user's employee, in the selected organization. */
interface NotificationScope {
	tenantId: string | null;
	organizationId: string | null;
	employeeId: string | null;
}

/**
 * The Notifications tab (plan 04 §1): Gauzy's own `EmployeeNotification`s (mentions, assignments, comments),
 * read live from `/api/employee-notification` — the first Angular UI for them. Nothing is copied into the
 * inbox. A user without an employee record has no notifications.
 */
@Component({
	selector: 'ngx-inbox-notifications',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, NbAlertModule, NbButtonModule, NbIconModule, NbListModule, NbSpinnerModule, TranslatePipe],
	template: `
		<div class="toolbar">
			<button
				nbButton
				size="small"
				status="basic"
				data-test="notifications-mark-all"
				[disabled]="loading() || !hasUnread()"
				(click)="markAllRead()"
			>
				{{ 'INBOX.ACTIONS.MARK_ALL_READ' | translate }}
			</button>
		</div>
		@if (noEmployee()) {
			<p data-test="notifications-no-employee">{{ 'INBOX.NOTIFICATIONS.NO_EMPLOYEE' | translate }}</p>
		} @else if (error()) {
			<nb-alert status="danger" role="alert" data-test="notifications-error">{{
				'INBOX.NOTIFICATIONS.ERROR' | translate
			}}</nb-alert>
		} @else {
			<nb-list [nbSpinner]="loading()" class="notifications">
				@for (notification of notifications(); track notification.id) {
					<nb-list-item
						class="notification"
						[class.unread]="!notification.isRead"
						[attr.data-test]="'notification-' + notification.id"
					>
						<div class="text">
							<div class="title">{{ notification.title }}</div>
							@if (notification.message) {
								<div class="message">{{ notification.message }}</div>
							}
							<div class="when">{{ notification.createdAt | date: 'medium' }}</div>
						</div>
						@if (!notification.isRead) {
							<button
								nbButton
								ghost
								size="small"
								[attr.data-test]="'notification-read-' + notification.id"
								(click)="markRead(notification)"
							>
								{{ 'INBOX.ACTIONS.MARK_READ' | translate }}
							</button>
						}
					</nb-list-item>
				} @empty {
					@if (!loading()) {
						<nb-list-item data-test="notifications-empty">{{
							'INBOX.NOTIFICATIONS.EMPTY' | translate
						}}</nb-list-item>
					}
				}
			</nb-list>
			@if (total() > notifications().length) {
				<button
					nbButton
					ghost
					size="small"
					data-test="notifications-more"
					[disabled]="loading()"
					(click)="more()"
				>
					{{ 'INBOX.LOAD_MORE' | translate }}
				</button>
			}
		}
	`,
	styles: [
		`
			.toolbar {
				display: flex;
				justify-content: flex-end;
				margin-bottom: 0.5rem;
			}
			.notification {
				display: flex;
				justify-content: space-between;
				gap: 0.5rem;
			}
			.notification.unread .title {
				font-weight: 600;
			}
			.message {
				white-space: pre-wrap;
				overflow-wrap: anywhere;
			}
			.when {
				font-size: 0.8rem;
				opacity: 0.7;
			}
		`
	]
})
export class InboxNotificationsComponent implements OnInit {
	private readonly api = inject(InboxNotificationsService);
	private readonly store = inject(Store);
	private readonly destroyRef = inject(DestroyRef);
	private readonly reload$ = new Subject<number>();

	readonly notifications = signal<IEmployeeNotification[]>([]);
	readonly total = signal(0);
	readonly loading = signal(false);
	readonly error = signal(false);
	readonly noEmployee = signal(false);
	private scope: NotificationScope = { tenantId: null, organizationId: null, employeeId: null };

	hasUnread(): boolean {
		return this.notifications().some((notification) => !notification.isRead);
	}

	ngOnInit(): void {
		// One request at a time: a newer page (or scope) replaces the one in flight.
		this.reload$
			.pipe(
				switchMap((skip) => {
					const { tenantId, organizationId, employeeId } = this.scope;
					this.error.set(false);
					this.noEmployee.set(!employeeId);
					if (!tenantId || !employeeId) return EMPTY;
					this.loading.set(true);
					return this.api
						.list({
							tenantId,
							organizationId,
							receiverEmployeeId: employeeId,
							skip,
							take: INBOX_UI_PAGE_SIZE
						})
						.pipe(
							map((page) => ({ page, skip })),
							// Caught here, so a failed page leaves the stream alive for the next one.
							catchError(() => {
								this.loading.set(false);
								this.error.set(true);
								return EMPTY;
							})
						);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe(({ page, skip }) => {
				this.loading.set(false);
				const items = page?.items ?? [];
				this.notifications.set(skip === 0 ? items : [...this.notifications(), ...items]);
				this.total.set(page?.total ?? items.length);
			});

		// After the page stream: the scope emits at once, and its first reload must find a subscriber.
		combineLatest([this.store.user$, this.store.selectedOrganization$])
			.pipe(
				map(([user, organization]) => ({
					tenantId: user?.tenantId ?? null,
					organizationId: organization?.id ?? null,
					employeeId: user?.employee?.id ?? user?.employeeId ?? null
				})),
				distinctUntilChanged(
					(a, b) =>
						a.tenantId === b.tenantId &&
						a.organizationId === b.organizationId &&
						a.employeeId === b.employeeId
				),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((scope) => {
				this.scope = scope;
				this.notifications.set([]);
				this.total.set(0);
				this.reload$.next(0);
			});
	}

	more(): void {
		this.reload$.next(this.notifications().length);
	}

	markRead(notification: IEmployeeNotification): void {
		if (!notification.id) return;
		this.api.markRead(notification.id).subscribe({
			next: () =>
				this.notifications.set(
					this.notifications().map((entry) =>
						entry.id === notification.id ? { ...entry, isRead: true } : entry
					)
				),
			error: () => this.error.set(true)
		});
	}

	markAllRead(): void {
		this.api.markAllRead().subscribe({
			next: () => this.notifications.set(this.notifications().map((entry) => ({ ...entry, isRead: true }))),
			error: () => this.error.set(true)
		});
	}
}
