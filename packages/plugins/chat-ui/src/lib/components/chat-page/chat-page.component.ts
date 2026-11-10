import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NbCardModule, NbDialogService, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { combineLatest, EMPTY, forkJoin, merge, Observable, of, Subscription, timer } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, switchMap } from 'rxjs/operators';
import { ChatConversationKindEnum, IChatCategory, IChatConversationWithState, IChatMemberState, IChatMessageWithRelations, IChatStates, IOrganization, IUser, PermissionsEnum } from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { CHAT_LINK, CHAT_LIST_POLL_MS } from '../../chat-ui.constants';
import { ChatPerson, conversationPerson, conversationTitle, isUnread, plainBody, sortConversations } from '../../chat-ui.helpers';
import { ChatAvailabilityService, isFinalRefusal } from '../../services/chat-availability.service';
import { ChatPeople, ChatPeopleService, EMPTY_PEOPLE } from '../../services/chat-people.service';
import { ChatFollowedThread, ChatMessagePatch, ChatUiService } from '../../services/chat-ui.service';
import { BrowseChannelsDialogComponent, NewChannelDialogComponent, NewDirectDialogComponent } from '../../dialogs/chat-dialogs.component';
import { ChatListView, ConversationListComponent } from '../conversation-list/conversation-list.component';
import { ConversationViewComponent } from '../conversation-view/conversation-view.component';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';
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
		NbCardModule,
		NbIconModule,
		NbSpinnerModule,
		TranslatePipe,
		ConversationListComponent,
		ConversationViewComponent,
		ThreadPaneComponent,
		PersonAvatarComponent
	],
	template: `
		<nb-card class="chat" data-test="chat-page">
			<nb-card-body class="body">
				@switch (state()) {
					@case ('unavailable') {
						<div class="state" data-test="unavailable">
							<span class="state-icon"><nb-icon icon="slash-outline"></nb-icon></span>
							<p>{{ 'CHAT.UNAVAILABLE' | translate }}</p>
						</div>
					}
					@case ('error') {
						<div class="state" role="alert" data-test="error">
							<span class="state-icon danger"><nb-icon icon="alert-triangle-outline"></nb-icon></span>
							<p>{{ 'CHAT.ERROR' | translate }}</p>
							<button type="button" class="button primary" (click)="reload()">{{ 'CHAT.RETRY' | translate }}</button>
						</div>
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
												<a class="back icon-button" [routerLink]="chatLink" [attr.aria-label]="'CHAT.VIEW.BACK' | translate"><nb-icon icon="arrow-back-outline"></nb-icon></a>
												<span class="header-icon"><nb-icon icon="radio-button-on-outline"></nb-icon></span>
												<h5>{{ 'CHAT.UNREADS.TITLE' | translate }}</h5>
												@if (undoSnapshot(); as snapshot) {
													<button type="button" class="button" data-test="undo-read-all" (click)="undoReadAll(snapshot)">
														<nb-icon icon="undo-outline"></nb-icon> {{ 'CHAT.UNREADS.UNDO' | translate }}
													</button>
												} @else {
													<button type="button" class="button" data-test="read-all" [disabled]="unreads().length === 0 || busy()" (click)="readAll()">
														<nb-icon icon="done-all-outline"></nb-icon> {{ 'CHAT.UNREADS.MARK_ALL_READ' | translate }}
													</button>
												}
											</header>
											<ul class="rows">
												@for (conversation of unreads(); track conversation.id) {
													<li>
														<a class="card" [routerLink]="link(conversation.id)">
															<span class="card-icon">
																@if (conversation.kind === 'channel') {
																	<nb-icon [icon]="conversation.visibility === 'private' ? 'lock-outline' : 'hash-outline'"></nb-icon>
																} @else if (personOf(conversation); as person) {
																	<ngx-chat-person-avatar [person]="person"></ngx-chat-person-avatar>
																} @else {
																	<nb-icon icon="people-outline"></nb-icon>
																}
															</span>
															<span class="card-main">
																<strong>{{ cardTitle(conversation) }}</strong>
																@if (conversation.lastMessageAt) {
																	<time>{{ conversation.lastMessageAt | date: 'medium' }}</time>
																}
															</span>
															<span class="meta">
																@if (conversation.state?.mentionCount) {
																	<span class="count mention">&#64;{{ conversation.state.mentionCount }}</span>
																}
																<span class="count">{{ conversation.state?.unreadCount }}</span>
																<nb-icon class="go" icon="arrow-ios-forward-outline"></nb-icon>
															</span>
														</a>
													</li>
												} @empty {
													<li class="caught-up">
														<span class="state-icon success"><nb-icon icon="checkmark-circle-2-outline"></nb-icon></span>
														<p>{{ 'CHAT.UNREADS.EMPTY' | translate }}</p>
													</li>
												}
											</ul>
										</section>
									}
									@case ('threads') {
										<section class="simple" data-test="threads-view">
											<header class="simple-header">
												<a class="back icon-button" [routerLink]="chatLink" [attr.aria-label]="'CHAT.VIEW.BACK' | translate"><nb-icon icon="arrow-back-outline"></nb-icon></a>
												<span class="header-icon"><nb-icon icon="message-square-outline"></nb-icon></span>
												<h5>{{ 'CHAT.THREADS.TITLE' | translate }}</h5>
											</header>
											<ul class="rows">
												@for (thread of threads(); track thread.id) {
													<li>
														<a class="card thread-card" [class.unread]="thread.unreadReplies > 0" [routerLink]="link(thread.conversationId)" [queryParams]="{ thread: thread.id }">
															<span class="card-icon"><nb-icon icon="message-square-outline"></nb-icon></span>
															<span class="card-main">
																<strong>{{ titleOf(thread.conversationId) }}</strong>
																<span class="preview">{{ preview(thread) }}</span>
																<span class="thread-meta">
																	<span class="replies">{{ 'CHAT.THREADS.REPLIES' | translate: { count: thread.replyCount } }}</span>
																	@if (thread.lastReplyAt) {
																		<time>{{ 'CHAT.THREADS.LAST_REPLY' | translate: { time: (thread.lastReplyAt | date: 'short') } }}</time>
																	}
																</span>
															</span>
															<span class="meta">
																@if (thread.unreadReplies > 0) {
																	<span class="count mention">{{ 'CHAT.THREADS.UNREAD_REPLIES' | translate: { count: thread.unreadReplies } }}</span>
																}
																<nb-icon class="go" icon="arrow-ios-forward-outline"></nb-icon>
															</span>
														</a>
													</li>
												} @empty {
													<li class="caught-up">
														<span class="state-icon"><nb-icon icon="message-square-outline"></nb-icon></span>
														<p>{{ 'CHAT.THREADS.EMPTY' | translate }}</p>
													</li>
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
												[patch]="rootPatch()"
												(openThread)="openThread($event)"
												(stateChanged)="onStateChanged(conversation.id, $event)"
												(conversationChanged)="upsert($event)"
												(left)="onLeft(conversation.id)"
											></ngx-chat-conversation-view>
										} @else if (notFound()) {
											<div class="state" data-test="not-found">
												<span class="state-icon"><nb-icon icon="question-mark-circle-outline"></nb-icon></span>
												<p>{{ 'CHAT.VIEW.NOT_FOUND' | translate }}</p>
												<a class="button" [routerLink]="chatLink">{{ 'CHAT.VIEW.BACK' | translate }}</a>
											</div>
										} @else {
											<div class="loading" [nbSpinner]="true"></div>
										}
									}
									@default {
										<div class="state home" data-test="pick">
											<span class="state-icon accent"><nb-icon icon="message-circle-outline"></nb-icon></span>
											<h3>{{ 'CHAT.VIEW.HOME_TITLE' | translate }}</h3>
											<p>{{ 'CHAT.VIEW.PICK' | translate }}</p>
											<div class="home-actions">
												<button type="button" class="button primary" (click)="openNewChannel()"><nb-icon icon="hash-outline"></nb-icon> {{ 'CHAT.LIST.NEW_CHANNEL' | translate }}</button>
												<button type="button" class="button" (click)="openNewDirect()"><nb-icon icon="edit-2-outline"></nb-icon> {{ 'CHAT.LIST.NEW_MESSAGE' | translate }}</button>
												<button type="button" class="button" (click)="openBrowse()"><nb-icon icon="search-outline"></nb-icon> {{ 'CHAT.LIST.BROWSE' | translate }}</button>
											</div>
										</div>
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
			/*
			 * The chat's own tokens, from the theme's: every part of the page (the sidebar, the conversation, the
			 * thread, the messages, the composer) reads these, so the page follows the light and the dark themes.
			 */
			:host {
				display: block;
				--chat-bg: var(--gauzy-card-1, var(--card-background-color, #fff));
				--chat-raised: var(--gauzy-card-1, var(--card-background-color, #fff));
				--chat-sidebar-bg: var(--gauzy-sidebar-background-2, var(--background-basic-color-2, #f7f9fc));
				--chat-border: var(--gauzy-border-default-color, rgba(127, 127, 127, 0.18));
				--chat-border-strong: var(--border-basic-color-4, rgba(127, 127, 127, 0.35));
				--chat-hover: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.12));
				--chat-active-tint: var(--gauzy-active-tint, rgba(126, 126, 143, 0.2));
				--chat-elevated: var(--gauzy-sidebar-background-3, rgba(126, 126, 143, 0.1));
				--chat-message-hover: var(--gauzy-sidebar-background-4, rgba(126, 126, 143, 0.05));
				--chat-composer-bar: var(--gauzy-sidebar-background-4, rgba(126, 126, 143, 0.05));
				--chat-reaction-bg: var(--gauzy-sidebar-background-3, rgba(126, 126, 143, 0.1));
				--chat-code-bg: var(--gauzy-sidebar-background-3, rgba(126, 126, 143, 0.1));
				--chat-text: var(--text-basic-color, inherit);
				--chat-text-soft: var(--text-hint-color, rgba(127, 127, 127, 0.8));
				--chat-muted: var(--text-hint-color, rgba(127, 127, 127, 0.9));
				--chat-accent: var(--color-primary-default, #3366ff);
				--chat-accent-soft: var(--color-primary-transparent-100, rgba(51, 102, 255, 0.08));
				--chat-accent-soft-2: var(--color-primary-transparent-200, rgba(51, 102, 255, 0.16));
				--chat-on-accent: var(--text-control-color, #fff);
				--chat-send: var(--color-primary-default, #3366ff);
				--chat-link: var(--text-primary-color, #3366ff);
				--chat-mention-chip-bg: var(--color-primary-transparent-200, rgba(51, 102, 255, 0.16));
				--chat-mention-chip-text: var(--text-primary-color, #3366ff);
				--chat-danger: var(--color-danger-default, #e4493f);
				--chat-header-height: 3.5rem;
			}
			.chat {
				height: calc(100vh - 9rem);
				min-height: 30rem;
				margin-bottom: 0;
				border: 1px solid var(--chat-border);
				border-radius: 0.75rem;
				overflow: hidden;
			}
			.body {
				height: 100%;
				padding: 0;
				overflow: hidden;
				background: var(--chat-bg);
			}
			.panes {
				display: grid;
				grid-template-columns: 17.5rem minmax(0, 1fr);
				height: 100%;
				min-height: 0;
			}
			.panes.with-thread {
				grid-template-columns: 17.5rem minmax(0, 1fr) minmax(20rem, 26rem);
			}
			.pane {
				min-height: 0;
				height: 100%;
			}
			.list-pane {
				border-right: 1px solid var(--chat-border);
				overflow: hidden;
			}
			.main-pane {
				display: flex;
				flex-direction: column;
				min-width: 0;
			}
			.main-pane > * {
				flex: 1 1 auto;
				min-height: 0;
			}
			.loading {
				min-height: 8rem;
				height: 100%;
				flex: 1 1 auto;
			}
			.state {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: 0.5rem;
				height: 100%;
				padding: 2rem 1.5rem;
				text-align: center;
			}
			.state h3 {
				margin: 0.5rem 0 0;
				color: var(--chat-text);
				font-size: 1.25rem;
				font-weight: 800;
				letter-spacing: -0.01em;
			}
			.state p {
				max-width: 28rem;
				margin: 0;
				color: var(--chat-muted);
				font-size: 0.8125rem;
			}
			.state-icon {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 3.25rem;
				height: 3.25rem;
				border-radius: 1rem;
				background: var(--chat-elevated);
				color: var(--chat-muted);
			}
			.state-icon nb-icon {
				font-size: 1.625rem;
			}
			.state-icon.accent {
				background: var(--chat-accent-soft);
				color: var(--chat-accent);
			}
			.state-icon.danger {
				color: var(--chat-danger);
			}
			.state-icon.success {
				color: var(--color-success-default, #00b887);
			}
			.home-actions {
				display: flex;
				flex-wrap: wrap;
				justify-content: center;
				gap: 0.5rem;
				margin-top: 1rem;
			}
			.button {
				display: inline-flex;
				align-items: center;
				gap: 0.375rem;
				height: 2rem;
				padding: 0 0.875rem;
				border: 1px solid var(--chat-border-strong);
				border-radius: 0.5rem;
				background: transparent;
				color: var(--chat-text);
				font: inherit;
				font-size: 0.8125rem;
				font-weight: 700;
				text-decoration: none;
				cursor: pointer;
				transition: background-color 0.1s ease, filter 0.1s ease;
			}
			.button nb-icon {
				font-size: 1rem;
			}
			.button:hover:not(:disabled) {
				background: var(--chat-hover);
				text-decoration: none;
			}
			.button.primary {
				border-color: transparent;
				background: var(--chat-accent);
				color: var(--chat-on-accent);
			}
			.button.primary:hover:not(:disabled) {
				background: var(--chat-accent);
				filter: brightness(1.08);
			}
			.button:disabled {
				opacity: 0.5;
				cursor: default;
			}
			.simple-header .button {
				height: 1.875rem;
				font-size: 0.75rem;
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
				min-height: var(--chat-header-height);
				padding: 0.375rem 0.75rem 0.375rem 1.25rem;
				border-bottom: 1px solid var(--chat-border);
				flex: 0 0 auto;
			}
			.header-icon {
				display: inline-flex;
				color: var(--chat-text);
			}
			.header-icon nb-icon {
				font-size: 1rem;
			}
			.simple-header h5 {
				flex: 1 1 auto;
				margin: 0;
				color: var(--chat-text);
				font-size: 0.9375rem;
				font-weight: 800;
			}
			.icon-button {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 2rem;
				height: 2rem;
				border-radius: 0.5rem;
				color: var(--chat-muted);
			}
			.icon-button:hover {
				background: var(--chat-hover);
				color: var(--chat-text);
			}
			.back {
				display: none;
				margin-left: -0.5rem;
			}
			.rows {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
				flex: 1 1 auto;
				min-height: 0;
				overflow-y: auto;
				margin: 0;
				padding: 1rem 1.25rem;
				list-style: none;
			}
			.card {
				display: flex;
				align-items: center;
				gap: 0.875rem;
				padding: 0.75rem 1rem;
				border: 1px solid var(--chat-border);
				border-radius: 0.625rem;
				background: var(--chat-bg);
				color: inherit;
				text-decoration: none;
				transition: background-color 0.1s ease, border-color 0.1s ease, box-shadow 0.1s ease;
			}
			.card:hover {
				border-color: var(--chat-border-strong);
				background: var(--chat-message-hover);
				box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.06);
				text-decoration: none;
			}
			.card.thread-card {
				align-items: flex-start;
			}
			.card.thread-card.unread {
				box-shadow: inset 3px 0 0 var(--chat-accent);
			}
			.card-icon {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 2.25rem;
				height: 2.25rem;
				flex: 0 0 auto;
				border-radius: 0.5rem;
				background: var(--chat-elevated);
				color: var(--chat-text);
			}
			.card-icon nb-icon {
				font-size: 1.125rem;
			}
			.card-main {
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
				flex: 1 1 auto;
				min-width: 0;
			}
			.card-main strong {
				color: var(--chat-text);
				font-size: 0.8125rem;
				font-weight: 800;
			}
			.card-main time,
			.thread-meta {
				color: var(--chat-muted);
				font-size: 0.6875rem;
			}
			.thread-meta {
				display: flex;
				gap: 0.5rem;
				margin-top: 0.25rem;
			}
			.replies {
				color: var(--chat-link);
				font-weight: 700;
			}
			.preview {
				overflow: hidden;
				display: -webkit-box;
				-webkit-line-clamp: 2;
				-webkit-box-orient: vertical;
				color: var(--chat-text);
				font-size: 0.8125rem;
				line-height: 1.4;
			}
			.meta {
				display: flex;
				align-items: center;
				gap: 0.375rem;
				flex: 0 0 auto;
				align-self: center;
			}
			.go {
				color: var(--chat-muted);
				font-size: 1rem;
			}
			.count {
				min-width: 1.375rem;
				height: 1.25rem;
				padding: 0 0.4375rem;
				border-radius: 999px;
				background: var(--chat-active-tint);
				color: var(--chat-text);
				font-size: 0.6875rem;
				font-weight: 800;
				line-height: 1.25rem;
				text-align: center;
				white-space: nowrap;
			}
			.count.mention {
				background: var(--chat-danger);
				color: #fff;
			}
			.caught-up {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 0.75rem;
				padding: 3rem 1rem;
				text-align: center;
			}
			.caught-up p {
				max-width: 24rem;
				margin: 0;
				color: var(--chat-muted);
				font-size: 0.8125rem;
			}
			@media (max-width: 1200px) {
				.panes.with-thread {
					grid-template-columns: 15rem minmax(0, 1fr) 20rem;
				}
			}
			@media (max-width: 960px) {
				.chat {
					height: calc(100vh - 7rem);
				}
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
				.panes.with-thread .main-pane,
				.panes:not(.conversation-open) .main-pane {
					display: none;
				}
				.back {
					display: inline-flex;
				}
			}
			@media (max-width: 600px) {
				.rows {
					padding: 0.75rem;
				}
				.simple-header {
					padding-left: 0.75rem;
				}
				.simple-header .button {
					padding: 0 0.625rem;
				}
			}
		`
	]
})
export class ChatPageComponent implements OnInit {
	private readonly api = inject(ChatUiService);
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
	protected readonly isAdmin = computed(() => this.store.hasPermission(PermissionsEnum.CHAT_MANAGE));

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

	/** The lists on a timer while the tab is visible, and at once after every write of the page. */
	private startListPolling(): void {
		this.listPolling?.unsubscribe();
		const token = this.scopeToken;
		const tick$ = timer(0, CHAT_LIST_POLL_MS).pipe(filter(() => typeof document === 'undefined' || !document.hidden));
		this.listPolling = merge(tick$, this.api.changed$)
			.pipe(
				switchMap(() => {
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

	/** A channel's title without its `#`, beside the card's own `#` or lock icon. */
	protected cardTitle(conversation: IChatConversationWithState): string {
		const title = this.title(conversation);
		return conversation.kind === ChatConversationKindEnum.CHANNEL ? title.replace(/^#/, '') : title;
	}

	protected personOf(conversation: IChatConversationWithState): ChatPerson | null {
		return conversationPerson(conversation, this.people().byEmployee, this.meEmployeeId());
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
