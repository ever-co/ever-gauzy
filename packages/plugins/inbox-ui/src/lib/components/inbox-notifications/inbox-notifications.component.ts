import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NbAlertModule, NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { combineLatest, EMPTY, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { IEmployeeNotification } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { INBOX_UI_PAGE_SIZE } from '../../inbox-ui.constants';
import {
	groupByDate,
	InboxSender,
	listDateFormat,
	notificationIconOf,
	notificationTypeLabelOf,
	senderOf
} from '../../inbox-ui.helpers';
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
	imports: [DatePipe, NbAlertModule, NbIconModule, NbSpinnerModule, NbTooltipModule, TranslatePipe],
	template: `
		<!-- A slim bar over the list, as a mail app's: what is unread on one side, "Mark all read" on the other. -->
		<div class="toolbar">
			<span class="summary" data-test="notifications-summary">
				@if (unreadCount(); as count) {
					{{ 'INBOX.UNREAD_SUMMARY' | translate: { count: count } }}
				} @else {
					{{ 'INBOX.NOTIFICATIONS.ALL_READ' | translate }}
				}
			</span>
			<button
				type="button"
				class="toolbar-action"
				data-test="notifications-mark-all"
				[disabled]="loading() || !hasUnread()"
				(click)="markAllRead()"
			>
				<nb-icon icon="done-all-outline"></nb-icon>
				{{ 'INBOX.ACTIONS.MARK_ALL_READ' | translate }}
			</button>
		</div>
		@if (noEmployee()) {
			<div class="state" data-test="notifications-no-employee">
				<span class="state-icon"><nb-icon icon="person-outline"></nb-icon></span>
				<span class="hint">{{ 'INBOX.NOTIFICATIONS.NO_EMPLOYEE' | translate }}</span>
			</div>
		} @else if (error()) {
			<div class="alert">
				<nb-alert status="danger" role="alert" data-test="notifications-error">{{
					'INBOX.NOTIFICATIONS.ERROR' | translate
				}}</nb-alert>
			</div>
		} @else {
			<div
				class="notifications"
				[class.is-loading]="loading() && !notifications().length"
				[nbSpinner]="loading()"
				nbSpinnerSize="small"
			>
				@for (section of sections(); track section.group) {
					<div class="group-label" [attr.data-test]="'notifications-group-' + section.group">
						{{ 'INBOX.GROUP.' + section.group | translate }}
					</div>
					@for (notification of section.items; track notification.id) {
						@let sender = senderOf(notification);
						@let typeLabel = typeLabelOf(notification.type);
						<div
							class="notification"
							[class.unread]="!notification.isRead"
							[attr.data-test]="'notification-' + notification.id"
						>
							<span class="unread-dot" aria-hidden="true"></span>
							<!-- The sender's picture (or initials), with the notification's type in a badge; the type alone without a sender. -->
							<span class="avatar" [class.person]="!!sender" [attr.data-type]="notification.type" aria-hidden="true">
								@if (sender) {
									@if (sender.imageUrl) {
										<img [src]="sender.imageUrl" alt="" loading="lazy" />
									} @else {
										<span class="initials">{{ sender.initials }}</span>
									}
									<span class="type-badge"><nb-icon [icon]="iconOf(notification.type)"></nb-icon></span>
								} @else {
									<nb-icon [icon]="iconOf(notification.type)"></nb-icon>
								}
							</span>
							<div class="text">
								<div class="top">
									<span class="title">{{ notification.title }}</span>
									<time
										class="when"
										[attr.datetime]="notification.createdAt"
										[nbTooltip]="notification.createdAt | date: 'medium'"
										nbTooltipPlacement="top"
										>{{ notification.createdAt | date: listDate(notification.createdAt) }}</time
									>
								</div>
								@if (notification.message) {
									<div class="message">{{ notification.message }}</div>
								}
								@if (sender || typeLabel) {
									<div class="meta" [attr.data-test]="'notification-meta-' + notification.id">
										@if (typeLabel) {
											<span class="type">{{ typeLabel | translate }}</span>
										}
										@if (sender) {
											<span class="from">{{ 'INBOX.NOTIFICATIONS.FROM' | translate: { name: sender.name } }}</span>
										}
									</div>
								}
							</div>
							@if (!notification.isRead) {
								<button
									type="button"
									class="read"
									[nbTooltip]="'INBOX.ACTIONS.MARK_READ' | translate"
									nbTooltipPlacement="top"
									[attr.aria-label]="'INBOX.ACTIONS.MARK_READ' | translate"
									[attr.data-test]="'notification-read-' + notification.id"
									(click)="markRead(notification)"
								>
									<nb-icon icon="checkmark-outline"></nb-icon>
									<span>{{ 'INBOX.ACTIONS.MARK_READ' | translate }}</span>
								</button>
							}
						</div>
					}
				} @empty {
					@if (!loading()) {
						<div class="state" data-test="notifications-empty">
							<span class="state-icon"><nb-icon icon="bell-outline"></nb-icon></span>
							<strong>{{ 'INBOX.NOTIFICATIONS.EMPTY' | translate }}</strong>
							<span class="hint">{{ 'INBOX.EMPTY_HINT' | translate }}</span>
						</div>
					}
				}
			</div>
			@if (total() > notifications().length) {
				<div class="more">
					<button
						type="button"
						class="toolbar-action"
						data-test="notifications-more"
						[disabled]="loading()"
						(click)="more()"
					>
						{{ 'INBOX.LOAD_MORE' | translate }}
					</button>
				</div>
			}
		}
	`,
	styles: [
		`
			:host {
				display: block;
			}

			/* The bar over the list */
			.toolbar {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.75rem;
				min-height: 2.75rem;
				padding: 0.5rem 1.25rem;
				border-bottom: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.18));
			}
			.summary {
				font-size: 0.75rem;
				font-weight: 500;
				line-height: 1rem;
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			.toolbar-action {
				display: inline-flex;
				align-items: center;
				gap: 0.3rem;
				height: 1.75rem;
				padding: 0 0.625rem;
				border: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.32));
				border-radius: 0.375rem;
				background: transparent;
				color: var(--gauzy-text-color-1, #222b45);
				font: inherit;
				font-size: 0.75rem;
				font-weight: 500;
				line-height: 1rem;
				white-space: nowrap;
				cursor: pointer;
				transition:
					background-color 0.12s ease,
					border-color 0.12s ease;
			}
			.toolbar-action nb-icon {
				width: 0.875rem;
				height: 0.875rem;
				font-size: 0.875rem;
			}
			.toolbar-action:hover:not(:disabled) {
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.12));
			}
			.toolbar-action:disabled {
				opacity: 0.45;
				cursor: default;
			}
			.toolbar-action:focus-visible,
			.read:focus-visible {
				outline: 2px solid var(--gauzy-action-info-text, #0095ff);
				outline-offset: 1px;
			}
			.alert {
				padding: 0.75rem 1.25rem;
			}

			/* The list: full width, one hairline between rows */
			.notifications.is-loading {
				min-height: 8rem;
			}
			.notification {
				position: relative;
				display: flex;
				align-items: flex-start;
				gap: 0.625rem;
				padding: 0.625rem 1.25rem 0.625rem 1.5rem;
				transition: background-color 0.12s ease;
			}
			.notification + .notification {
				border-top: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.18));
			}
			.notification:hover {
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.08));
			}
			.notification.unread {
				background: var(--color-primary-transparent-100, rgba(110, 73, 232, 0.06));
			}
			.unread-dot {
				position: absolute;
				left: 0.625rem;
				top: 1.25rem;
				width: 0.375rem;
				height: 0.375rem;
				border-radius: 50%;
				background: var(--color-primary-500, #6e49e8);
				opacity: 0;
			}
			.notification.unread .unread-dot {
				opacity: 1;
			}
			/* Day sections: a small label over each, as the message list has. */
			.group-label {
				padding: 0.375rem 1.25rem 0.25rem 1.5rem;
				border-bottom: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.18));
				background: var(--background-basic-color-1, #fff);
				font-size: 0.6875rem;
				font-weight: 600;
				line-height: 1rem;
				letter-spacing: 0.02em;
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			.notification + .group-label {
				border-top: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.18));
			}

			/* The type's icon in a tinted circle, or the sender's picture with the type in a badge. */
			.avatar {
				--tone: var(--color-warning-500, #ffaa00);
				--tone-bg: var(--color-warning-transparent-100, rgba(255, 170, 0, 0.12));
				position: relative;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				flex-shrink: 0;
				width: 1.75rem;
				height: 1.75rem;
				border-radius: 50%;
				color: var(--tone);
				background: var(--tone-bg);
			}
			.avatar[data-type='Assignment'],
			.avatar[data-type='TaskUpdate'] {
				--tone: var(--color-primary-500, #6e49e8);
				--tone-bg: var(--color-primary-transparent-100, rgba(110, 73, 232, 0.12));
			}
			.avatar[data-type='Mention'],
			.avatar[data-type='Comment'],
			.avatar[data-type='Message'] {
				--tone: var(--color-info-500, #0095ff);
				--tone-bg: var(--color-info-transparent-100, rgba(0, 149, 255, 0.12));
			}
			.avatar[data-type='Payment'],
			.avatar[data-type='RateChangeRequest'] {
				--tone: var(--color-success-500, #00d68f);
				--tone-bg: var(--color-success-transparent-100, rgba(0, 214, 143, 0.12));
			}
			.avatar > nb-icon {
				width: 0.875rem;
				height: 0.875rem;
				font-size: 0.875rem;
			}
			.avatar.person {
				color: var(--gauzy-text-color-1, #222b45);
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.16));
			}
			.avatar img {
				width: 100%;
				height: 100%;
				border-radius: 50%;
				object-fit: cover;
			}
			.initials {
				font-size: 0.6875rem;
				font-weight: 600;
				line-height: 1;
			}
			.type-badge {
				position: absolute;
				right: -0.25rem;
				bottom: -0.25rem;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1rem;
				height: 1rem;
				border-radius: 50%;
				border: 2px solid var(--background-basic-color-1, #fff);
				color: var(--text-control-color, #fff);
				background: var(--tone);
			}
			.type-badge nb-icon {
				width: 0.5625rem;
				height: 0.5625rem;
				font-size: 0.5625rem;
			}
			.meta {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.375rem;
				margin-top: 0.125rem;
				font-size: 0.6875rem;
				line-height: 1rem;
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			.meta .type {
				padding: 0 0.375rem;
				border-radius: 0.1875rem;
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.12));
				font-weight: 500;
			}
			.text {
				flex: 1;
				min-width: 0;
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
			}
			.top {
				display: flex;
				align-items: baseline;
				gap: 0.75rem;
				min-width: 0;
			}
			.title {
				flex: 1;
				min-width: 0;
				font-size: 0.8125rem;
				font-weight: 500;
				line-height: 1.125rem;
				color: var(--gauzy-text-color-1, #222b45);
				overflow-wrap: anywhere;
			}
			.notification.unread .title {
				font-weight: 600;
			}
			.when {
				flex-shrink: 0;
				font-size: 0.6875rem;
				line-height: 1rem;
				color: var(--gauzy-text-color-2, #8f9bb3);
				white-space: nowrap;
				font-variant-numeric: tabular-nums;
			}
			.notification.unread .when {
				color: var(--color-primary-500, #6e49e8);
				font-weight: 600;
			}
			.message {
				font-size: 0.75rem;
				line-height: 1.125rem;
				color: var(--gauzy-text-color-2, #8f9bb3);
				white-space: pre-wrap;
				overflow-wrap: anywhere;
			}

			/* "Mark read" shows on the row under the pointer or the keyboard. */
			.read {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				flex-shrink: 0;
				align-self: center;
				height: 1.5rem;
				padding: 0 0.5rem;
				border: 0;
				border-radius: 0.375rem;
				background: none;
				color: var(--color-primary-500, #6e49e8);
				font: inherit;
				font-size: 0.6875rem;
				font-weight: 600;
				white-space: nowrap;
				cursor: pointer;
				opacity: 0;
				transition: opacity 0.12s ease;
			}
			.read nb-icon {
				width: 0.75rem;
				height: 0.75rem;
				font-size: 0.75rem;
			}
			.notification:hover .read,
			.read:focus-visible {
				opacity: 1;
			}
			.read:hover {
				background: var(--color-primary-transparent-100, rgba(110, 73, 232, 0.12));
			}

			.state {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 0.5rem;
				padding: 2.5rem 1.5rem;
				text-align: center;
				font-size: 0.8125rem;
			}
			.state-icon {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 2.75rem;
				height: 2.75rem;
				border-radius: 50%;
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.12));
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			.state-icon nb-icon {
				width: 1.25rem;
				height: 1.25rem;
				font-size: 1.25rem;
			}
			.hint {
				max-width: 24rem;
				font-size: 0.75rem;
				line-height: 1.125rem;
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			.more {
				display: flex;
				justify-content: center;
				padding: 0.625rem;
				border-top: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.18));
			}

			/* Touch screens have no hover: "Mark read" stays visible, as an icon. */
			@media (hover: none), (max-width: 600px) {
				.read {
					opacity: 1;
				}
			}
			@media (max-width: 600px) {
				.toolbar,
				.notification {
					padding-right: 0.75rem;
				}
				.read span {
					display: none;
				}
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
	/** The notifications in their day sections (Today, Yesterday, …). */
	readonly sections = computed(() => groupByDate(this.notifications()));
	/** The unread notifications listed, for the bar over the list. */
	readonly unreadCount = computed(() => this.notifications().filter((notification) => !notification.isRead).length);
	readonly total = signal(0);
	readonly loading = signal(false);
	readonly error = signal(false);
	readonly noEmployee = signal(false);
	private scope: NotificationScope = { tenantId: null, organizationId: null, employeeId: null };
	/** "Mark all read" went through for this employee: the notifications not loaded are read too (#11098 review). */
	private readonly markedAll = signal(false);

	/** A row's time, as the message list shows it (the full date and time on hover). */
	listDate(createdAt: Date | string | null | undefined): string {
		return listDateFormat(createdAt);
	}

	/** The icon of a notification's type. */
	iconOf(type: string | null | undefined): string {
		return notificationIconOf(type);
	}

	/** A notification's type, as a translation key (`null` for a type the plugin does not know). */
	typeLabelOf(type: string | null | undefined): string | null {
		return notificationTypeLabelOf(type);
	}

	/** Who sent a notification (`null`: the system, or a sender the API did not join). */
	senderOf(notification: IEmployeeNotification): InboxSender | null {
		return senderOf(notification);
	}

	/** Something to mark read: an unread notification listed, or more of them not loaded yet (review F69). */
	hasUnread(): boolean {
		return (
			this.notifications().some((notification) => !notification.isRead) ||
			(!this.markedAll() && this.total() > this.notifications().length)
		);
	}

	ngOnInit(): void {
		// The page stream first: the scope emits at once, and its first reload must find a subscriber.
		this.setUpPageStream();
		this.followScope();
	}

	/** One request at a time: a newer page (or scope) replaces the one in flight. */
	private setUpPageStream(): void {
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
	}

	/** The signed-in user's employee in the selected organization: a new one starts over. */
	private followScope(): void {
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
				this.markedAll.set(false);
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

	/**
	 * Marks every notification of my employee read. An employee record belongs to one organization, so this is
	 * the selected organization's list; it is read again afterwards rather than patched locally.
	 */
	markAllRead(): void {
		const scope = this.scope;
		this.api.markAllRead().subscribe({
			next: () => {
				// Another employee or organization since it was sent: that one's notifications were not marked.
				if (this.scope === scope) this.markedAll.set(true);
				this.reload$.next(0);
			},
			error: () => this.error.set(true)
		});
	}
}
