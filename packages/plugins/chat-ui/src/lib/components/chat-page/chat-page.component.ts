import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, Signal, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NbAlertModule, NbButtonModule, NbCardModule, NbDialogService, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { combineLatest, EMPTY, forkJoin, merge, Observable, of, Subscription, timer } from 'rxjs';
import { auditTime, catchError, distinctUntilChanged, filter, map, switchMap } from 'rxjs/operators';
import { IChatCategory, IChatConversationWithState, IChatMemberState, IChatMessageWithRelations, IChatStates, IOrganization, IUser, PermissionsEnum } from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { CHAT_LINK, CHAT_LIST_POLL_MS, CHAT_LIVE_LIST_AUDIT_MS } from '../../chat-ui.constants';
import { conversationTitle, isUnread, plainBody, sortConversations } from '../../chat-ui.helpers';
import { ChatAvailabilityService, isFinalRefusal } from '../../services/chat-availability.service';
import { coalesceReads } from '../../services/chat-live';
import { ChatLiveService, isTabVisible } from '../../services/chat-live.service';
import { ChatPeople, ChatPeopleService, EMPTY_PEOPLE } from '../../services/chat-people.service';
import { ChatFollowedThread, ChatMessagePatch, ChatUiService } from '../../services/chat-ui.service';
import { BrowseChannelsDialogComponent, NewChannelDialogComponent, NewDirectDialogComponent } from '../../dialogs/chat-dialogs.component';
import { ChatListView, ConversationListComponent } from '../conversation-list/conversation-list.component';
import { ConversationViewComponent } from '../conversation-view/conversation-view.component';
import { ThreadPaneComponent } from '../thread-pane/thread-pane.component';

/** What the page shows. */
export type ChatPageState = 'loading' | 'ready' | 'unavailable' | 'error';

/** The undo of a mark-all-read lasts this long (the API keeps the snapshot a minute). */
const UNDO_MS = 55_000;

/**
 * `/pages/chat`: the conversations on the left (channels by category, direct messages, favourites, Unreads and
 * Threads), the open conversation in the middle, and a thread on the right. The lists refresh when a chat event
 * arrives (live, `ChatLiveService`), at once after a write, and every 30 s while the tab is visible as the fallback
 * (once a minute while the events arrive live); the open conversation follows its own messages.
 *
 * The page asks the API first (`/chat/states`) for the signed-in user in the selected organization: a 404 means
 * this installation does not serve the chat, and the page says so and makes no other request. When the user or
 * the organization changes, everything shown is dropped and asked again for the new scope.
 */
@Component({
	selector: 'ngx-chat-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		DatePipe,
		RouterLink,
		NbAlertModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbSpinnerModule,
		TranslatePipe,
		ConversationListComponent,
		ConversationViewComponent,
		ThreadPaneComponent
	],
	template: `
		<nb-card class="chat" data-test="chat-page">
			<nb-card-body class="body">
				@switch (state()) {
					@case ('unavailable') {
						<p class="notice" data-test="unavailable">{{ 'CHAT.UNAVAILABLE' | translate }}</p>
					}
					@case ('error') {
						<nb-alert status="danger" role="alert" data-test="error">{{ 'CHAT.ERROR' | translate }}</nb-alert>
						<button nbButton size="small" type="button" (click)="reload()">{{ 'CHAT.RETRY' | translate }}</button>
					}
					@case ('loading') {
						<div class="loading" data-test="loading" [nbSpinner]="true"></div>
					}
					@default {
						<div class="panes" [class.with-thread]="threadId()" [class.conversation-open]="view() !== 'home'">
							<div class="pane list-pane">
								<ngx-chat-conversation-list
									[conversations]="conversations()"
									[categories]="categories()"
									[people]="people()"
									[meEmployeeId]="meEmployeeId()"
									[activeId]="conversationId()"
									[view]="listView()"
									[threadCount]="threadUnreadCount()"
									[untitled]="'CHAT.UNNAMED' | translate"
									(newChannel)="openNewChannel()"
									(newDirect)="openNewDirect()"
									(browse)="openBrowse()"
								></ngx-chat-conversation-list>
							</div>

							<div class="pane main-pane">
								@switch (view()) {
									@case ('unreads') {
										<section class="simple" data-test="unreads-view">
											<header class="simple-header">
												<a class="back" [routerLink]="chatLink"><nb-icon icon="arrow-back-outline"></nb-icon></a>
												<h5>{{ 'CHAT.UNREADS.TITLE' | translate }}</h5>
												@if (undoSnapshot(); as snapshot) {
													<button nbButton size="tiny" status="basic" type="button" data-test="undo-read-all" (click)="undoReadAll(snapshot)">
														{{ 'CHAT.UNREADS.UNDO' | translate }}
													</button>
												} @else {
													<button nbButton size="tiny" status="basic" type="button" data-test="read-all" [disabled]="unreads().length === 0 || busy()" (click)="readAll()">
														{{ 'CHAT.UNREADS.MARK_ALL_READ' | translate }}
													</button>
												}
											</header>
											<ul class="rows">
												@for (conversation of unreads(); track conversation.id) {
													<li>
														<a class="row" [routerLink]="link(conversation.id)">
															<strong>{{ title(conversation) }}</strong>
															<span class="meta">
																@if (conversation.state?.mentionCount) {
																	<span class="count mention">{{ conversation.state.mentionCount }}</span>
																}
																<span class="count">{{ conversation.state?.unreadCount }}</span>
																@if (conversation.lastMessageAt) {
																	<time>{{ conversation.lastMessageAt | date: 'short' }}</time>
																}
															</span>
														</a>
													</li>
												} @empty {
													<li class="empty">{{ 'CHAT.UNREADS.EMPTY' | translate }}</li>
												}
											</ul>
										</section>
									}
									@case ('threads') {
										<section class="simple" data-test="threads-view">
											<header class="simple-header">
												<a class="back" [routerLink]="chatLink"><nb-icon icon="arrow-back-outline"></nb-icon></a>
												<h5>{{ 'CHAT.THREADS.TITLE' | translate }}</h5>
											</header>
											<ul class="rows">
												@for (thread of threads(); track thread.id) {
													<li>
														<a class="row" [routerLink]="link(thread.conversationId)" [queryParams]="{ thread: thread.id }">
															<strong>{{ titleOf(thread.conversationId) }}</strong>
															<span class="preview">{{ preview(thread) }}</span>
															<span class="meta">
																@if (thread.unreadReplies > 0) {
																	<span class="count mention">{{ 'CHAT.THREADS.UNREAD_REPLIES' | translate: { count: thread.unreadReplies } }}</span>
																}
																<span>{{ 'CHAT.THREADS.REPLIES' | translate: { count: thread.replyCount } }}</span>
																@if (thread.lastReplyAt) {
																	<time>{{ thread.lastReplyAt | date: 'short' }}</time>
																}
															</span>
														</a>
													</li>
												} @empty {
													<li class="empty">{{ 'CHAT.THREADS.EMPTY' | translate }}</li>
												}
											</ul>
										</section>
									}
									@case ('conversation') {
										@if (selected(); as conversation) {
											<ngx-chat-conversation-view
												[conversation]="conversation"
												[people]="people()"
												[conversationNames]="conversationNames()"
												[meEmployeeId]="meEmployeeId()"
												[meUserId]="meUserId()"
												[isAdmin]="isAdmin()"
												[canAttach]="canAttach()"
												[untitled]="'CHAT.UNNAMED' | translate"
												[highlightId]="highlightId()"
												[patch]="rootPatch()"
												(openThread)="openThread($event)"
												(stateChanged)="onStateChanged(conversation.id, $event)"
												(conversationChanged)="upsert($event)"
												(left)="onLeft(conversation.id)"
											></ngx-chat-conversation-view>
										} @else if (notFound()) {
											<p class="notice" data-test="not-found">{{ 'CHAT.VIEW.NOT_FOUND' | translate }}</p>
										} @else {
											<div class="loading" [nbSpinner]="true"></div>
										}
									}
									@default {
										<p class="notice" data-test="pick">{{ 'CHAT.VIEW.PICK' | translate }}</p>
									}
								}
							</div>

							@if (threadId(); as rootId) {
								@if (conversationId(); as cid) {
									<div class="pane thread-pane-host">
										<ngx-chat-thread-pane
											[rootMessageId]="rootId"
											[conversationId]="cid"
											[people]="people()"
											[conversationNames]="conversationNames()"
											[meEmployeeId]="meEmployeeId()"
											[meUserId]="meUserId()"
											[readOnly]="!!selected()?.archivedAt || !selected()?.state"
											[canAttach]="canAttach()"
											(closed)="closeThread()"
											(rootChanged)="onRootChanged($event)"
										></ngx-chat-thread-pane>
									</div>
								}
							}
						</div>
					}
				}
			</nb-card-body>
		</nb-card>
	`,
	styles: [
		`
			.chat {
				height: calc(100vh - 9rem);
				min-height: 30rem;
			}
			.body {
				padding: 0;
				overflow: hidden;
			}
			.panes {
				display: grid;
				grid-template-columns: 16rem minmax(0, 1fr);
				height: 100%;
				min-height: 0;
			}
			.panes.with-thread {
				grid-template-columns: 16rem minmax(0, 1fr) 22rem;
			}
			.pane {
				min-height: 0;
				height: 100%;
			}
			.list-pane {
				border-right: 1px solid rgba(127, 127, 127, 0.2);
				overflow: hidden;
			}
			.main-pane {
				display: flex;
				flex-direction: column;
				min-width: 0;
			}
			.notice {
				margin: 2rem 1rem;
				font-size: 0.875rem;
				opacity: 0.7;
			}
			.loading {
				min-height: 8rem;
				flex: 1 1 auto;
			}
			.simple {
				display: flex;
				flex-direction: column;
				height: 100%;
				min-height: 0;
			}
			.simple-header {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				padding: 0.5rem 0.75rem;
				border-bottom: 1px solid rgba(127, 127, 127, 0.2);
			}
			.simple-header h5 {
				flex: 1 1 auto;
				margin: 0;
				font-size: 1rem;
			}
			.back {
				display: none;
				color: inherit;
			}
			.rows {
				flex: 1 1 auto;
				min-height: 0;
				overflow-y: auto;
				margin: 0;
				padding: 0.5rem;
				list-style: none;
			}
			.row {
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
				padding: 0.5rem;
				border-radius: 0.375rem;
				color: inherit;
				text-decoration: none;
				font-size: 0.875rem;
			}
			.row:hover {
				background: rgba(127, 127, 127, 0.12);
			}
			.preview {
				opacity: 0.8;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.meta {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				font-size: 0.75rem;
				opacity: 0.8;
			}
			.count {
				padding: 0 0.375rem;
				border-radius: 999px;
				background: rgba(127, 127, 127, 0.25);
				font-weight: 700;
			}
			.count.mention {
				background: var(--color-danger-default, #e4493f);
				color: var(--text-control-color, #fff);
			}
			.empty {
				padding: 1rem 0.5rem;
				font-size: 0.875rem;
				opacity: 0.7;
			}
			@media (max-width: 960px) {
				.panes,
				.panes.with-thread {
					grid-template-columns: 1fr;
				}
				.list-pane {
					border-right: 0;
				}
				.panes.conversation-open .list-pane {
					display: none;
				}
				.panes.with-thread .main-pane {
					display: none;
				}
				.back {
					display: inline-flex;
				}
			}
		`
	]
})
export class ChatPageComponent implements OnInit {
	private readonly api = inject(ChatUiService);
	private readonly live = inject(ChatLiveService);
	private readonly availability = inject(ChatAvailabilityService);
	private readonly peopleService = inject(ChatPeopleService);
	private readonly store = inject(Store);
	private readonly toastr = inject(ToastrService);
	private readonly translate = inject(TranslateService);
	private readonly dialog = inject(NbDialogService);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly destroyRef = inject(DestroyRef);

	protected readonly chatLink = CHAT_LINK;

	protected readonly state = signal<ChatPageState>('loading');
	protected readonly conversations = signal<IChatConversationWithState[]>([]);
	protected readonly categories = signal<IChatCategory[]>([]);
	protected readonly states = signal<IChatStates | null>(null);
	protected readonly threads = signal<ChatFollowedThread[]>([]);
	/** A conversation opened by link that is not in my list (a public channel I am not in). */
	protected readonly extra = signal<IChatConversationWithState | null>(null);
	protected readonly notFound = signal(false);
	protected readonly busy = signal(false);
	protected readonly undoSnapshot = signal<string | null>(null);
	/** The last change of a thread's root (its thread fields, or the whole message after an edit there): the open conversation applies it to its copy. */
	protected readonly rootPatch = signal<ChatMessagePatch | null>(null);

	/** `:conversationId`, `?thread=`, `?message=` and the route's view, as signals. */
	protected readonly conversationId = toSignal(this.route.paramMap.pipe(map((params) => params.get('conversationId')), distinctUntilChanged()), { initialValue: null });
	protected readonly threadId = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('thread')), distinctUntilChanged()), { initialValue: null });
	protected readonly highlightId = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('message')), distinctUntilChanged()), { initialValue: null });
	private readonly routeView = toSignal(this.route.data.pipe(map((data) => (data['view'] as string | undefined) ?? null)), { initialValue: null });

	protected readonly view = computed<'home' | 'conversation' | 'unreads' | 'threads'>(() => {
		if (this.routeView() === 'unreads') return 'unreads';
		if (this.routeView() === 'threads') return 'threads';
		return this.conversationId() ? 'conversation' : 'home';
	});
	protected readonly listView = computed<ChatListView>(() => (this.view() === 'unreads' || this.view() === 'threads' ? this.view() : 'conversation') as ChatListView);

	private readonly user = toSignal(this.store.user$ as Observable<IUser | null>, { initialValue: null });
	protected readonly meEmployeeId = computed(() => {
		const user = this.user() as (IUser & { employeeId?: string; employee?: { id?: string } }) | null;
		return user?.employee?.id ? String(user.employee.id) : user?.employeeId ? String(user.employeeId) : null;
	});
	protected readonly meUserId = computed(() => (this.user()?.id ? String(this.user()!.id) : null));
	protected readonly isAdmin = this.permission(PermissionsEnum.CHAT_MANAGE);
	/** Attachments are stored as documents: uploading them needs `DOCS_CREATE`. */
	protected readonly canAttach = this.permission(PermissionsEnum.DOCS_CREATE);

	protected readonly people = toSignal(
		combineLatest([
			this.store.selectedOrganization$ as Observable<IOrganization | null>,
			this.store.user$ as Observable<IUser | null>
		]).pipe(
			map(([organization, user]) => ({ organizationId: organization?.id ?? null, tenantId: organization?.tenantId ?? user?.tenantId ?? null })),
			distinctUntilChanged((a, b) => a.organizationId === b.organizationId && a.tenantId === b.tenantId),
			switchMap(({ organizationId, tenantId }) => (organizationId && tenantId ? this.peopleService.people(organizationId, tenantId) : of(EMPTY_PEOPLE)))
		),
		{ initialValue: EMPTY_PEOPLE as ChatPeople }
	);

	protected readonly conversationNames = computed(() => {
		const names = new Map<string, string>();
		for (const conversation of this.conversations()) if (conversation.name) names.set(String(conversation.id), conversation.name);
		return names;
	});
	protected readonly selected = computed(() => {
		const id = this.conversationId();
		if (!id) return null;
		return this.conversations().find((conversation) => String(conversation.id) === id) ?? (String(this.extra()?.id) === id ? this.extra() : null);
	});
	protected readonly unreads = computed(() =>
		sortConversations(this.conversations().filter(isUnread)).sort((a, b) => {
			const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
			const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
			return bt - at;
		})
	);
	protected readonly threadUnreadCount = computed(() => (this.states()?.threads ?? []).filter((thread) => thread.unreadReplies > 0).length);

	/** Whether I hold a permission, following my role's permissions as they load and change. */
	private permission(permission: PermissionsEnum): Signal<boolean> {
		return toSignal(
			(this.store.userRolePermissions$ as Observable<unknown>).pipe(
				map(() => this.store.hasPermission(permission)),
				distinctUntilChanged()
			),
			{ initialValue: this.store.hasPermission(permission) }
		);
	}

	/** Counts up at every scope change and every list refresh, so a late answer of an earlier one is dropped. */
	private scopeToken = 0;
	private listScope = 0;
	private listPolling: Subscription | null = null;

	ngOnInit(): void {
		this.followScope();
		this.followRoute();
	}

	/** Every user / organization change drops what is shown and asks the API again for the new scope. */
	private followScope(): void {
		this.availability.scope$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((scope) => {
			this.resetForScope();
			if (scope) this.checkAvailability();
		});
	}

	/** A conversation opened by link that the list does not hold: read it on its own. */
	private followRoute(): void {
		this.route.paramMap
			.pipe(
				map((params) => params.get('conversationId')),
				distinctUntilChanged(),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((id) => {
				this.notFound.set(false);
				this.extra.set(null);
				if (id && this.state() === 'ready') this.fetchIfMissing(id);
			});
	}

	private resetForScope(): void {
		this.scopeToken += 1;
		this.listScope += 1;
		this.listPolling?.unsubscribe();
		this.listPolling = null;
		this.state.set('loading');
		this.conversations.set([]);
		this.categories.set([]);
		this.states.set(null);
		this.threads.set([]);
		this.extra.set(null);
		this.notFound.set(false);
		this.busy.set(false);
		this.undoSnapshot.set(null);
	}

	private checkAvailability(): void {
		const token = this.scopeToken;
		this.api
			.states()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (states) => {
					if (token !== this.scopeToken) return;
					this.states.set(states);
					this.state.set('ready');
					this.startListPolling();
				},
				error: (error: HttpErrorResponse) => {
					if (token !== this.scopeToken) return;
					this.state.set(isFinalRefusal(error) ? 'unavailable' : 'error');
				}
			});
	}

	protected reload(): void {
		this.state.set('loading');
		this.checkAvailability();
	}

	/**
	 * The lists: at once, after every write of the page, for the chat events (any of them can move a conversation,
	 * a count or a followed thread; a burst is read once; none while the tab is hidden, which catches up when shown),
	 * after a reconnect, and on the poll's ticks. A read under way is never cancelled by the next trigger: triggers that
	 * come meanwhile ask for one more read after it.
	 */
	private startListPolling(): void {
		this.listPolling?.unsubscribe();
		const token = this.scopeToken;
		const events$ = this.live.hints$.pipe(
			filter(() => isTabVisible()),
			auditTime(CHAT_LIVE_LIST_AUDIT_MS)
		);
		this.listPolling = merge(timer(0), this.live.ticks(CHAT_LIST_POLL_MS), this.api.changed$, events$, this.live.catchUp$)
			.pipe(
				coalesceReads(() => {
					const scope = ++this.listScope;
					return forkJoin({ list: this.api.listMine(), states: this.api.states(), threads: this.api.threads().pipe(catchError(() => of([] as ChatFollowedThread[]))) }).pipe(
						map((answer) => ({ ...answer, scope })),
						catchError((error: HttpErrorResponse) => {
							// The chat went away for this scope (switched off, or no longer this user's): the page says so.
							if (isFinalRefusal(error) && token === this.scopeToken) this.state.set('unavailable');
							return EMPTY;
						})
					);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe(({ list, states, threads, scope }) => {
				if (scope !== this.listScope || token !== this.scopeToken) return;
				this.conversations.set(sortConversations(list.conversations));
				this.categories.set(list.categories);
				this.states.set(states);
				this.threads.set(threads);
				const id = this.conversationId();
				if (id) this.fetchIfMissing(id);
			});
	}

	private fetchIfMissing(id: string): void {
		if (this.conversations().some((conversation) => String(conversation.id) === id) || String(this.extra()?.id) === id) return;
		const token = this.scopeToken;
		this.api
			.getConversation(id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (conversation) => {
					if (token === this.scopeToken && this.conversationId() === id) this.extra.set(conversation);
				},
				error: () => {
					if (token === this.scopeToken && this.conversationId() === id) this.notFound.set(true);
				}
			});
	}

	// ---------------------------------------------------------------- list changes

	/** Puts a conversation into the list (new or changed) and keeps the order. */
	protected upsert(conversation: IChatConversationWithState): void {
		const others = this.conversations().filter((item) => String(item.id) !== String(conversation.id));
		this.conversations.set(sortConversations([...others, conversation]));
		if (String(this.extra()?.id) === String(conversation.id)) this.extra.set(null);
	}

	protected onStateChanged(conversationId: string, state: IChatMemberState): void {
		this.conversations.set(
			sortConversations(this.conversations().map((item) => (String(item.id) === String(conversationId) ? { ...item, state } : item)))
		);
	}

	protected onLeft(conversationId: string): void {
		this.conversations.set(this.conversations().filter((item) => String(item.id) !== String(conversationId)));
		void this.router.navigate([CHAT_LINK]);
	}

	protected onRootChanged(patch: ChatMessagePatch): void {
		this.rootPatch.set(patch);
		this.api.notifyChanged();
	}

	// ---------------------------------------------------------------- threads

	protected openThread(message: IChatMessageWithRelations): void {
		void this.router.navigate([], { relativeTo: this.route, queryParams: { thread: message.id }, queryParamsHandling: 'merge' });
	}

	protected closeThread(): void {
		void this.router.navigate([], { relativeTo: this.route, queryParams: { thread: null }, queryParamsHandling: 'merge' });
	}

	// ---------------------------------------------------------------- unreads

	protected readAll(): void {
		const token = this.scopeToken;
		this.busy.set(true);
		this.api
			.readAll()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (result) => {
					this.api.notifyChanged();
					if (token !== this.scopeToken) return;
					this.busy.set(false);
					this.toastr.success('CHAT.UNREADS.MARKED', { count: result.updated });
					this.undoSnapshot.set(result.snapshotId);
					timer(UNDO_MS)
						.pipe(takeUntilDestroyed(this.destroyRef))
						.subscribe(() => {
							if (this.undoSnapshot() === result.snapshotId) this.undoSnapshot.set(null);
						});
				},
				error: () => {
					if (token !== this.scopeToken) return;
					this.busy.set(false);
					this.toastr.danger('CHAT.DIALOG.FAILED');
				}
			});
	}

	protected undoReadAll(snapshotId: string): void {
		const token = this.scopeToken;
		this.busy.set(true);
		this.api
			.readRestore(snapshotId)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: () => {
					this.api.notifyChanged();
					if (token !== this.scopeToken) return;
					this.busy.set(false);
					this.undoSnapshot.set(null);
					this.toastr.success('CHAT.UNREADS.RESTORED');
				},
				error: () => {
					if (token !== this.scopeToken) return;
					this.busy.set(false);
					this.undoSnapshot.set(null);
					this.toastr.danger('CHAT.DIALOG.FAILED');
				}
			});
	}

	// ---------------------------------------------------------------- dialogs

	protected openNewChannel(): void {
		this.dialog
			.open(NewChannelDialogComponent)
			.onClose.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((conversation: IChatConversationWithState | null) => this.open(conversation));
	}

	protected openNewDirect(): void {
		this.dialog
			.open(NewDirectDialogComponent, { context: { people: this.people(), meEmployeeId: this.meEmployeeId() } })
			.onClose.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((conversation: IChatConversationWithState | null) => this.open(conversation));
	}

	protected openBrowse(): void {
		this.dialog
			.open(BrowseChannelsDialogComponent)
			.onClose.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((conversation: IChatConversationWithState | null) => this.open(conversation));
	}

	private open(conversation: IChatConversationWithState | null): void {
		if (!conversation) return;
		this.upsert(conversation);
		this.api.notifyChanged();
		void this.router.navigate([CHAT_LINK, String(conversation.id)]);
	}

	// ---------------------------------------------------------------- labels

	protected title(conversation: IChatConversationWithState): string {
		return conversationTitle(conversation, this.people().byEmployee, this.meEmployeeId(), this.translate.instant('CHAT.UNNAMED'));
	}

	protected titleOf(conversationId: string): string {
		const conversation = this.conversations().find((item) => String(item.id) === String(conversationId));
		return conversation ? this.title(conversation) : this.translate.instant('CHAT.UNNAMED');
	}

	protected preview(thread: ChatFollowedThread): string {
		return plainBody(thread.body ?? '', this.people().byEmployee, this.conversationNames());
	}

	protected link(conversationId: string): string {
		return `${CHAT_LINK}/${encodeURIComponent(String(conversationId))}`;
	}
}
