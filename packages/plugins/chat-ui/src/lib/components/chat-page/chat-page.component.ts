import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NbAlertModule, NbButtonModule, NbCardModule, NbDialogService, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { combineLatest, EMPTY, forkJoin, merge, Observable, of, timer } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, switchMap } from 'rxjs/operators';
import { IChatCategory, IChatConversationWithState, IChatMemberState, IChatMessageWithRelations, IChatStates, IOrganization, IUser, PermissionsEnum } from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { CHAT_LINK, CHAT_LIST_POLL_MS } from '../../chat-ui.constants';
import { conversationTitle, isUnread, plainBody, sortConversations } from '../../chat-ui.helpers';
import { ChatPeople, ChatPeopleService, EMPTY_PEOPLE } from '../../services/chat-people.service';
import { ChatFollowedThread, ChatUiService } from '../../services/chat-ui.service';
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
 * Threads), the open conversation in the middle, and a thread on the right. The lists refresh every 30 s while the
 * tab is visible and at once after a write; the open conversation polls for newer messages on its own.
 *
 * The page asks the API first (`/chat/states`): a 404 means this installation does not serve the chat, and the
 * page says so and makes no other request.
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
												[untitled]="'CHAT.UNNAMED' | translate"
												[highlightId]="highlightId()"
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
				background: #e4493f;
				color: #fff;
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
	private readonly peopleService = inject(ChatPeopleService);
	private readonly store = inject(Store);
	private readonly toastr = inject(ToastrService);
	private readonly dialog = inject(NbDialogService);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly destroyRef = inject(DestroyRef);

	protected readonly chatLink = CHAT_LINK;

	readonly state = signal<ChatPageState>('loading');
	readonly conversations = signal<IChatConversationWithState[]>([]);
	readonly categories = signal<IChatCategory[]>([]);
	readonly states = signal<IChatStates | null>(null);
	readonly threads = signal<ChatFollowedThread[]>([]);
	/** A conversation opened by link that is not in my list (a public channel I am not in). */
	readonly extra = signal<IChatConversationWithState | null>(null);
	readonly notFound = signal(false);
	readonly busy = signal(false);
	readonly undoSnapshot = signal<string | null>(null);

	/** `:conversationId`, `?thread=`, `?message=` and the route's view, as signals. */
	readonly conversationId = toSignal(this.route.paramMap.pipe(map((params) => params.get('conversationId')), distinctUntilChanged()), { initialValue: null });
	readonly threadId = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('thread')), distinctUntilChanged()), { initialValue: null });
	readonly highlightId = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('message')), distinctUntilChanged()), { initialValue: null });
	private readonly routeView = toSignal(this.route.data.pipe(map((data) => (data['view'] as string | undefined) ?? null)), { initialValue: null });

	readonly view = computed<'home' | 'conversation' | 'unreads' | 'threads'>(() => {
		if (this.routeView() === 'unreads') return 'unreads';
		if (this.routeView() === 'threads') return 'threads';
		return this.conversationId() ? 'conversation' : 'home';
	});
	readonly listView = computed<ChatListView>(() => (this.view() === 'unreads' || this.view() === 'threads' ? this.view() : 'conversation') as ChatListView);

	private readonly organization = toSignal(this.store.selectedOrganization$ as Observable<IOrganization | null>, { initialValue: null });
	private readonly user = toSignal(this.store.user$ as Observable<IUser | null>, { initialValue: null });
	readonly meEmployeeId = computed(() => {
		const user = this.user() as (IUser & { employeeId?: string; employee?: { id?: string } }) | null;
		return user?.employee?.id ? String(user.employee.id) : user?.employeeId ? String(user.employeeId) : null;
	});
	readonly meUserId = computed(() => (this.user()?.id ? String(this.user()!.id) : null));
	readonly isAdmin = computed(() => this.store.hasPermission(PermissionsEnum.CHAT_MANAGE));

	readonly people = toSignal(
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

	readonly conversationNames = computed(() => {
		const names = new Map<string, string>();
		for (const conversation of this.conversations()) if (conversation.name) names.set(String(conversation.id), conversation.name);
		return names;
	});
	readonly selected = computed(() => {
		const id = this.conversationId();
		if (!id) return null;
		return this.conversations().find((conversation) => String(conversation.id) === id) ?? (String(this.extra()?.id) === id ? this.extra() : null);
	});
	readonly unreads = computed(() =>
		sortConversations(this.conversations().filter(isUnread)).sort((a, b) => {
			const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
			const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
			return bt - at;
		})
	);
	readonly threadUnreadCount = computed(() => (this.states()?.threads ?? []).filter((thread) => thread.unreadReplies > 0).length);

	private listScope = 0;

	ngOnInit(): void {
		this.checkAvailability();
		// A conversation opened by link that the list does not hold: read it on its own.
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

	private checkAvailability(): void {
		this.api
			.states()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (states) => {
					this.states.set(states);
					this.state.set('ready');
					this.startListPolling();
				},
				error: (error: HttpErrorResponse) => this.state.set(error?.status === 404 || error?.status === 403 ? 'unavailable' : 'error')
			});
	}

	reload(): void {
		this.state.set('loading');
		this.checkAvailability();
	}

	private startListPolling(): void {
		const tick$ = timer(0, CHAT_LIST_POLL_MS).pipe(filter(() => typeof document === 'undefined' || !document.hidden));
		merge(tick$, this.api.changed$)
			.pipe(
				switchMap(() => {
					const scope = ++this.listScope;
					return forkJoin({ list: this.api.listMine(), states: this.api.states(), threads: this.api.threads().pipe(catchError(() => of([] as ChatFollowedThread[]))) }).pipe(
						map((answer) => ({ ...answer, scope })),
						catchError(() => EMPTY)
					);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe(({ list, states, threads, scope }) => {
				if (scope !== this.listScope) return;
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
		this.api
			.getConversation(id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (conversation) => {
					if (this.conversationId() === id) this.extra.set(conversation);
				},
				error: () => {
					if (this.conversationId() === id) this.notFound.set(true);
				}
			});
	}

	// ---------------------------------------------------------------- list changes

	/** Puts a conversation into the list (new or changed) and keeps the order. */
	upsert(conversation: IChatConversationWithState): void {
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

	protected onRootChanged(_root: IChatMessageWithRelations): void {
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
		this.busy.set(true);
		this.api
			.readAll()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (result) => {
					this.busy.set(false);
					this.toastr.success('CHAT.UNREADS.MARKED', { count: result.updated });
					this.undoSnapshot.set(result.snapshotId);
					timer(UNDO_MS)
						.pipe(takeUntilDestroyed(this.destroyRef))
						.subscribe(() => {
							if (this.undoSnapshot() === result.snapshotId) this.undoSnapshot.set(null);
						});
					this.api.notifyChanged();
				},
				error: () => {
					this.busy.set(false);
					this.toastr.danger('CHAT.DIALOG.FAILED');
				}
			});
	}

	protected undoReadAll(snapshotId: string): void {
		this.busy.set(true);
		this.api
			.readRestore(snapshotId)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: () => {
					this.busy.set(false);
					this.undoSnapshot.set(null);
					this.toastr.success('CHAT.UNREADS.RESTORED');
					this.api.notifyChanged();
				},
				error: () => {
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
		return conversationTitle(conversation, this.people().byEmployee, this.meEmployeeId(), 'Conversation');
	}

	protected titleOf(conversationId: string): string {
		const conversation = this.conversations().find((item) => String(item.id) === String(conversationId));
		return conversation ? this.title(conversation) : 'Conversation';
	}

	protected preview(thread: ChatFollowedThread): string {
		return plainBody(thread.body ?? '', this.people().byEmployee, this.conversationNames());
	}

	protected link(conversationId: string): string {
		return `${CHAT_LINK}/${encodeURIComponent(String(conversationId))}`;
	}
}
