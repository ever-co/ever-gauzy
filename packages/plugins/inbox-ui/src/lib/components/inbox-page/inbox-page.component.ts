import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbSelectModule,
	NbSpinnerModule
} from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { EMPTY, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import {
	IInboxItemWithState,
	IInboxRecipientStateInput,
	IInboxReplyInput,
	InboxItemKindEnum,
	InboxItemSourceEnum
} from '@gauzy/contracts';
import { INBOX_MY_MAILBOX_LINK, INBOX_UI_PAGE_SIZE } from '../../inbox-ui.constants';
import {
	apiTabOf,
	INBOX_UI_TABS,
	InboxUiTab,
	isSnoozed,
	isTranslationKey,
	isUnread,
	replaceItem,
	sourceLabelOf
} from '../../inbox-ui.helpers';
import { InboxEmailAvailabilityService } from '../../services/inbox-email-availability.service';
import { InboxUiService } from '../../services/inbox-ui.service';
import { InboxItemDetailComponent } from '../inbox-item-detail/inbox-item-detail.component';
import { InboxNotificationsComponent } from '../inbox-notifications/inbox-notifications.component';

/** What the page shows. */
export type InboxPageView = 'loading' | 'ready' | 'unavailable' | 'error';

/** The message of an API refusal, for the reply pane ("Already decided in Ever Works", …). */
export function apiMessage(error: unknown): string | null {
	const body = (error as HttpErrorResponse)?.error;
	const message = body?.message ?? (error as HttpErrorResponse)?.message;
	if (Array.isArray(message)) return message.join(' ');
	return typeof message === 'string' && message.trim() ? message : null;
}

/**
 * `/pages/inbox` (plan 04 §1, G-P3-2): everything addressed to me. Tabs All, Decisions, Email, Notifications
 * and Archived; filters (kind, source, unread only, text); a list and the detail pane of the selected item.
 *
 * The page asks the API first. A 404 means this installation's API does not load the Inbox
 * (`GAUZY_INBOX_ENABLED` is not `true`, the default): the page says so and makes no other request.
 */
@Component({
	selector: 'ngx-inbox-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		DatePipe,
		FormsModule,
		NbAlertModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbIconModule,
		NbInputModule,
		NbListModule,
		NbSelectModule,
		NbSpinnerModule,
		RouterLink,
		TranslatePipe,
		InboxItemDetailComponent,
		InboxNotificationsComponent
	],
	template: `
		<nb-card class="inbox" data-test="inbox-page">
			<nb-card-header class="inbox-header">
				<h4>{{ 'INBOX.TITLE' | translate }}</h4>
				<span class="header-actions">
				@if (emailAvailable()) {
					<a nbButton ghost size="small" data-test="my-mailbox" [routerLink]="myMailboxLink">{{
						'INBOX.MY_MAILBOX.LINK' | translate
					}}</a>
				}
				@if (view() === 'ready' && tab() !== 'notifications') {
					<button
						nbButton
						size="small"
						status="basic"
						data-test="mark-all-read"
						[disabled]="loading() || !hasUnread()"
						(click)="markAllRead()"
					>
						{{ 'INBOX.ACTIONS.MARK_ALL_READ' | translate }}
					</button>
				}
				</span>
			</nb-card-header>
			<nb-card-body>
				@switch (view()) {
					@case ('unavailable') {
						<p data-test="unavailable">{{ 'INBOX.UNAVAILABLE' | translate }}</p>
					}
					@case ('error') {
						<nb-alert status="danger" role="alert" data-test="error">{{
							'INBOX.ERROR' | translate
						}}</nb-alert>
						<button nbButton size="small" (click)="reload()">{{ 'INBOX.RETRY' | translate }}</button>
					}
					@case ('loading') {
						<div class="loading" data-test="loading" [nbSpinner]="true"></div>
					}
					@default {
						@if (actionError(); as message) {
							<nb-alert
								status="danger"
								role="alert"
								closable
								data-test="action-error"
								(close)="actionError.set(null)"
								>{{ isKey(message) ? (message | translate) : message }}</nb-alert
							>
						}
						<div class="tabs" role="tablist">
							@for (entry of tabs; track entry) {
								<button
									nbButton
									ghost
									size="small"
									role="tab"
									[attr.aria-selected]="tab() === entry"
									[attr.data-test]="'tab-' + entry"
									[class.active]="tab() === entry"
									(click)="selectTab(entry)"
								>
									{{ 'INBOX.TABS.' + entry | translate }}
								</button>
							}
						</div>

						@if (tab() === 'notifications') {
							<ngx-inbox-notifications></ngx-inbox-notifications>
						} @else {
							<div class="filters" data-test="filters">
								<nb-select
									size="small"
									data-test="filter-kind"
									[placeholder]="'INBOX.FILTERS.KIND' | translate"
									[selected]="kind()"
									(selectedChange)="setKind($event)"
								>
									<nb-option [value]="null">{{ 'INBOX.FILTERS.ALL_KINDS' | translate }}</nb-option>
									@for (value of kindOptions; track value) {
										<nb-option [value]="value">{{ 'INBOX.KIND.' + value | translate }}</nb-option>
									}
								</nb-select>
								<nb-select
									size="small"
									data-test="filter-source"
									[placeholder]="'INBOX.FILTERS.SOURCE' | translate"
									[selected]="source()"
									(selectedChange)="setSource($event)"
								>
									<nb-option [value]="null">{{ 'INBOX.FILTERS.ALL_SOURCES' | translate }}</nb-option>
									@for (value of sourceOptions; track value) {
										<nb-option [value]="value">{{ sourceLabel(value) | translate }}</nb-option>
									}
								</nb-select>
								<nb-checkbox
									data-test="filter-unread"
									[checked]="unreadOnly()"
									(checkedChange)="setUnread($event)"
								>
									{{ 'INBOX.FILTERS.UNREAD' | translate }}
								</nb-checkbox>
								<input
									nbInput
									fieldSize="small"
									type="search"
									data-test="filter-q"
									maxlength="200"
									[placeholder]="'INBOX.FILTERS.SEARCH' | translate"
									[ngModel]="query()"
									(ngModelChange)="search$.next($event)"
								/>
							</div>

							<div class="panes">
								<nb-list class="list" data-test="list" [nbSpinner]="loading()">
									@for (item of items(); track item.id) {
										<nb-list-item
											class="row"
											role="button"
											tabindex="0"
											[class.selected]="item.id === selectedId()"
											[class.unread]="unread(item)"
											[attr.data-test]="'item-' + item.id"
											(click)="open(item)"
											(keydown.enter)="open(item)"
										>
											<div class="row-title">{{ item.title }}</div>
											<div class="row-meta">
												<span>{{ 'INBOX.KIND.' + item.kind | translate }}</span>
												<span>·</span>
												<span>{{
													isKey(sourceLabel(item.source))
														? (sourceLabel(item.source) | translate)
														: item.source
												}}</span>
												<span class="when">{{ item.createdAt | date: 'short' }}</span>
											</div>
										</nb-list-item>
									} @empty {
										@if (!loading()) {
											<nb-list-item data-test="empty">{{
												'INBOX.EMPTY' | translate
											}}</nb-list-item>
										}
									}
								</nb-list>
								@if (nextCursor()) {
									<button
										nbButton
										ghost
										size="small"
										data-test="load-more"
										[disabled]="loading()"
										(click)="more()"
									>
										{{ 'INBOX.LOAD_MORE' | translate }}
									</button>
								}
								<div class="detail-pane">
									@if (selected(); as item) {
										<ngx-inbox-item-detail
											[item]="item"
											[busy]="busy()"
											[error]="replyError()"
											(replied)="reply(item, $event)"
											(stateChanged)="changeState(item, $event)"
										></ngx-inbox-item-detail>
									} @else {
										<p class="hint" data-test="no-selection">{{ 'INBOX.SELECT' | translate }}</p>
									}
								</div>
							</div>
						}
					}
				}
			</nb-card-body>
		</nb-card>
	`,
	styles: [
		`
			.inbox-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
			}
			.inbox-header h4 {
				margin: 0;
			}
			.header-actions {
				display: flex;
				gap: 0.5rem;
				align-items: center;
			}
			.tabs {
				display: flex;
				flex-wrap: wrap;
				gap: 0.25rem;
				margin-bottom: 0.75rem;
			}
			.tabs .active {
				border-bottom: 2px solid var(--color-primary-default, #3366ff);
			}
			.filters {
				display: flex;
				flex-wrap: wrap;
				gap: 0.5rem;
				align-items: center;
				margin-bottom: 0.75rem;
			}
			.panes {
				display: grid;
				grid-template-columns: minmax(16rem, 2fr) 3fr;
				grid-template-rows: auto auto;
				gap: 1rem;
			}
			.list {
				grid-column: 1;
				max-height: 70vh;
				overflow: auto;
			}
			.detail-pane {
				grid-column: 2;
				grid-row: 1 / span 2;
			}
			.row {
				display: block;
				cursor: pointer;
			}
			.row.selected {
				background: var(--background-basic-color-3, #edf1f7);
			}
			.row.unread .row-title {
				font-weight: 600;
			}
			.row-meta {
				display: flex;
				gap: 0.3rem;
				font-size: 0.8rem;
				opacity: 0.8;
			}
			.row-meta .when {
				margin-left: auto;
			}
			.hint {
				opacity: 0.7;
			}
			.loading {
				min-height: 8rem;
			}
			@media (max-width: 960px) {
				.panes {
					grid-template-columns: 1fr;
				}
				.list,
				.detail-pane {
					grid-column: 1;
					grid-row: auto;
				}
			}
		`
	]
})
export class InboxPageComponent implements OnInit {
	private readonly api = inject(InboxUiService);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly destroyRef = inject(DestroyRef);

	protected readonly tabs = INBOX_UI_TABS;
	protected readonly myMailboxLink = INBOX_MY_MAILBOX_LINK;
	/** "My mailbox" is linked only where the API serves the Inbox email features. */
	readonly emailAvailable = toSignal(inject(InboxEmailAvailabilityService).available$, { initialValue: false });
	protected readonly kindOptions = Object.values(InboxItemKindEnum);
	protected readonly sourceOptions = Object.values(InboxItemSourceEnum);

	readonly view = signal<InboxPageView>('loading');
	readonly tab = signal<InboxUiTab>('all');
	readonly kind = signal<InboxItemKindEnum | null>(null);
	readonly source = signal<string | null>(null);
	readonly unreadOnly = signal(false);
	readonly query = signal('');
	readonly items = signal<IInboxItemWithState[]>([]);
	readonly nextCursor = signal<string | null>(null);
	readonly loading = signal(false);
	readonly selectedId = signal<string | null>(null);
	readonly busy = signal(false);
	readonly replyError = signal<string | null>(null);
	/** Why the last read / archive / snooze failed (the API's message, or a translation key). */
	readonly actionError = signal<string | null>(null);

	/**
	 * The open item, kept here as well: an item read under "unread only" leaves the list but stays open (its
	 * body and reply form must not vanish while the user reads it).
	 */
	private readonly opened = signal<IInboxItemWithState | null>(null);
	readonly selected = computed(() => {
		const id = this.selectedId();
		if (!id) return null;
		const opened = this.opened();
		return this.items().find((item) => item.id === id) ?? (opened?.id === id ? opened : null);
	});
	readonly hasUnread = computed(() => this.items().some((item) => isUnread(item)));

	/** The search box, debounced into `query`. */
	readonly search$ = new Subject<string>();
	/** `false`: a fresh first page; `true`: the next page after `nextCursor`. */
	private readonly load$ = new Subject<boolean>();

	ngOnInit(): void {
		this.readRequestedTab();
		this.setUpListStream();
		this.setUpSearch();
		this.checkAvailability();
	}

	/** `?tab=` of the URL, when it names one of the tabs. */
	private readRequestedTab(): void {
		const requested = this.route.snapshot.queryParamMap.get('tab') as InboxUiTab | null;
		if (requested && INBOX_UI_TABS.includes(requested)) this.tab.set(requested);
	}

	/**
	 * Asks the API first (the counts route): only where it serves the Inbox does the page show anything else,
	 * the Notifications tab included. 404 / 403 → the "off" notice.
	 */
	private checkAvailability(): void {
		this.api
			.counts()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: () => {
					this.view.set('ready');
					this.reload();
				},
				error: (error: HttpErrorResponse) =>
					this.view.set(error?.status === 404 || error?.status === 403 ? 'unavailable' : 'error')
			});
	}

	/** One list request at a time: a new tab, filter or page replaces the one in flight. */
	private setUpListStream(): void {
		this.load$
			.pipe(
				switchMap((append) => {
					const apiTab = apiTabOf(this.tab());
					if (!apiTab || this.view() !== 'ready') return EMPTY;
					this.loading.set(true);
					return this.api
						.list({
							tab: apiTab,
							kind: this.kind() ?? undefined,
							source: this.source() ?? undefined,
							unread: this.unreadOnly() || undefined,
							q: this.query().trim() || undefined,
							cursor: append ? (this.nextCursor() ?? undefined) : undefined,
							limit: INBOX_UI_PAGE_SIZE
						})
						.pipe(
							// Paired with the page it asked for.
							map((page) => ({ page, append })),
							// Caught here, so the stream stays alive for a retry.
							catchError((error: HttpErrorResponse) => {
								this.loading.set(false);
								this.view.set(error?.status === 404 || error?.status === 403 ? 'unavailable' : 'error');
								return EMPTY;
							})
						);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe(({ page, append }) => {
				this.loading.set(false);
				const items = page?.items ?? [];
				this.items.set(append ? [...this.items(), ...items] : items);
				this.nextCursor.set(page?.nextCursor ?? null);
				// A fresh page without the selected item closes it, unless it is the item I have open (read under
				// "unread only", then the list started over): that one stays open.
				const id = this.selectedId();
				if (!append && id && !items.some((item) => item.id === id) && this.opened()?.id !== id) {
					this.selectedId.set(null);
				}
			});
	}

	/** The search box, debounced. */
	private setUpSearch(): void {
		this.search$
			.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
			.subscribe((value) => {
				this.query.set(value ?? '');
				this.reload();
			});
	}

	reload(): void {
		if (this.view() === 'error') {
			// A retry after a failure starts over with the availability check.
			this.view.set('loading');
			this.checkAvailability();
			return;
		}
		this.load$.next(false);
	}

	more(): void {
		if (this.nextCursor()) this.load$.next(true);
	}

	selectTab(tab: InboxUiTab): void {
		if (tab === this.tab()) return;
		this.tab.set(tab);
		this.items.set([]);
		this.nextCursor.set(null);
		this.selectedId.set(null);
		void this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, replaceUrl: true });
		this.reload();
	}

	setKind(kind: InboxItemKindEnum | null): void {
		this.kind.set(kind);
		this.reload();
	}

	setSource(source: string | null): void {
		this.source.set(source);
		this.reload();
	}

	setUnread(unread: boolean): void {
		this.unreadOnly.set(!!unread);
		this.reload();
	}

	unread(item: IInboxItemWithState): boolean {
		return isUnread(item);
	}

	sourceLabel(source: string): string {
		return sourceLabelOf(source);
	}

	isKey(label: string): boolean {
		return isTranslationKey(label);
	}

	/** Opens an item; an unread one becomes read. */
	open(item: IInboxItemWithState): void {
		this.selectedId.set(item.id ?? null);
		this.opened.set(item);
		this.replyError.set(null);
		if (item.id && isUnread(item)) this.changeState(item, { isRead: true });
	}

	reply(item: IInboxItemWithState, input: IInboxReplyInput): void {
		if (!item.id || this.busy()) return;
		this.busy.set(true);
		this.replyError.set(null);
		this.api.reply(item.id, input).subscribe({
			next: (next) => {
				this.busy.set(false);
				this.items.set(replaceItem(this.items(), next));
				if (this.opened()?.id === next.id) this.opened.set(next);
				this.api.notifyChanged();
			},
			error: (error: HttpErrorResponse) => {
				this.busy.set(false);
				this.replyError.set(apiMessage(error));
				// "Already decided" (409): show what the source decided.
				if (error?.status === 409) this.refresh(item.id as string);
			}
		});
	}

	changeState(item: IInboxItemWithState, change: IInboxRecipientStateInput): void {
		if (!item.id) return;
		this.busy.set(true);
		this.actionError.set(null);
		this.api.setState(item.id, change).subscribe({
			next: (next) => {
				this.busy.set(false);
				if (this.opened()?.id === next.id) this.opened.set(next);
				if (this.leavesList(change, next)) {
					this.items.set(this.items().filter((entry) => entry.id !== next.id));
					// Archived, snoozed or woken: it is gone from this view. Only read: it stays open.
					const onlyRead =
						change.isRead !== undefined &&
						change.isArchived === undefined &&
						change.snoozedUntil === undefined;
					if (this.selectedId() === next.id && !onlyRead) this.selectedId.set(null);
					// The API pages by offset: with an item gone, the next page would skip one. Start over.
					if (this.nextCursor()) this.reload();
				} else {
					this.items.set(replaceItem(this.items(), next));
				}
				this.api.notifyChanged();
			},
			error: (error: HttpErrorResponse) => {
				this.busy.set(false);
				this.actionError.set(apiMessage(error) ?? 'INBOX.ACTION_FAILED');
			}
		});
	}

	/** Whether an item no longer belongs to the list shown after a change of my state. */
	private leavesList(change: IInboxRecipientStateInput, next: IInboxItemWithState): boolean {
		const tab = this.tab();
		if (change.isArchived !== undefined && (tab === 'archived') !== !!change.isArchived) return true;
		if (change.snoozedUntil !== undefined && tab !== 'archived') {
			// Snoozed leaves the open tabs; woken leaves the Snoozed tab.
			return tab === 'snoozed' ? !isSnoozed(next) : isSnoozed(next);
		}
		return this.unreadOnly() && !isUnread(next);
	}

	markAllRead(): void {
		const tab = apiTabOf(this.tab());
		if (!tab) return;
		this.actionError.set(null);
		this.api.markAllRead(tab).subscribe({
			next: () => {
				this.api.notifyChanged();
				this.reload();
			},
			error: (error: HttpErrorResponse) => this.actionError.set(apiMessage(error) ?? 'INBOX.ACTION_FAILED')
		});
	}

	private refresh(id: string): void {
		this.api.get(id).subscribe({
			next: (next) => {
				this.items.set(replaceItem(this.items(), next));
				if (this.opened()?.id === next.id) this.opened.set(next);
			}
		});
	}
}
