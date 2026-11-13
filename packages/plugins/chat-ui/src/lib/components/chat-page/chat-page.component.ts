import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, NgZone, OnInit, type Signal, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, NavigationStart, Router, RouterLink } from '@angular/router';
import { NbCardModule, NbDialogService, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { combineLatest, EMPTY, forkJoin, merge, Observable, of, Subscription, timer } from 'rxjs';
import { auditTime, catchError, distinctUntilChanged, filter, map, startWith, switchMap, takeUntil } from 'rxjs/operators';
import { ChatConversationKindEnum, IChatCategory, IChatConversationWithState, IChatMemberState, IChatMessageWithRelations, IChatStates, IOrganization, IUser, PermissionsEnum } from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { CHAT_DIRECT_WITH_PARAM, CHAT_LINK, CHAT_LIST_POLL_MS, CHAT_LIVE_LIST_AUDIT_MS } from '../../chat-ui.constants';
import {
	cardPlace,
	ChatPerson,
	conversationPerson,
	conversationTitle,
	isUnread,
	memberEmployeeIds,
	membershipOf,
	messagePreview,
	newNonce,
	personTriggerOf,
	sortConversations
} from '../../chat-ui.helpers';
import { ChatAvailabilityService, isFinalRefusal } from '../../services/chat-availability.service';
import { coalesceReads } from '../../services/chat-live';
import { ChatLiveService, isTabVisible } from '../../services/chat-live.service';
import { ChatPeople, ChatPeopleService, EMPTY_PEOPLE } from '../../services/chat-people.service';
import { ChatFollowedThread, ChatMessagePatch, ChatUiService } from '../../services/chat-ui.service';
import { BrowseChannelsDialogComponent, NewChannelContext, NewChannelDialogComponent, NewDirectDialogComponent } from '../../dialogs/chat-dialogs.component';
import { CategoriesDialogComponent } from '../../dialogs/chat-settings-dialogs.component';
import { ChatListView, ConversationListComponent } from '../conversation-list/conversation-list.component';
import { ConversationViewComponent } from '../conversation-view/conversation-view.component';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';
import { PersonCardComponent, PersonCardMembership } from '../person-card/person-card.component';
import { ThreadPaneComponent } from '../thread-pane/thread-pane.component';

/** What the page shows. */
export type ChatPageState = 'loading' | 'ready' | 'unavailable' | 'error';

/** The undo of a mark-all-read lasts this long (the API keeps the snapshot a minute). */
const UNDO_MS = 55_000;

/** The profile card opens after the pointer rests this long on a person, sooner when moving from an open card's person to another. */
const CARD_OPEN_DELAY_MS = 450;
const CARD_SWITCH_DELAY_MS = 150;
/** Time for the pointer to travel from the person to their card before it closes. */
const CARD_CLOSE_DELAY_MS = 250;
/** A first guess of the card's height, before it is drawn (its place is measured again once it is). */
const CARD_HEIGHT_GUESS_PX = 300;

/** The window's size, for placing the card. */
function viewportSize(): { width: number; height: number } {
	return { width: window.innerWidth, height: window.innerHeight };
}

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
	host: {
		'(mouseover)': 'onPointerOver($event)',
		'(mouseout)': 'onPointerOut($event)',
		'(focusin)': 'onFocusIn($event)',
		'(focusout)': 'onFocusOut($event)',
		'(keydown)': 'onTriggerKey($event)',
		'(document:mousedown)': 'onDocumentPressForCard($event)',
		'(document:keydown.escape)': 'onEscapeForCard()'
	},
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
		PersonAvatarComponent,
		PersonCardComponent
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
						<div class="panes" [class.with-thread]="!!threadId() && !!conversationId()" [class.conversation-open]="view() !== 'home'">
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
									[canManageCategories]="isAdmin()"
									(manageCategories)="openCategories()"
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
												[canAttach]="canAttach()"
												[canCreateTask]="canCreateTask()"
												[categories]="categories()"
												[organizationId]="organizationId()"
												[tenantId]="tenantId()"
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
											[memberIds]="selectedMemberIds()"
											[canAttach]="canAttach()"
											[canCreateTask]="canCreateTask()"
											[organizationId]="organizationId()"
											[tenantId]="tenantId()"
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

		<!-- The profile card of the person under the pointer (an avatar, a name, a mention): one for the whole page. -->
		@if (card(); as shown) {
			<div class="person-card-host" [style.top.px]="shown.top" [style.left.px]="shown.left" (mouseenter)="keepCard()" (mouseleave)="hideCardSoon()">
				<ngx-chat-person-card
					#personCard
					[person]="shown.person"
					[isMe]="shown.person.employeeId === meEmployeeId()"
					[membership]="cardMembership()"
					[inConversation]="cardInConversation()"
					[inCommon]="cardInCommon()"
					[canViewProfile]="canViewProfiles()"
					[sending]="cardSending()"
					(message)="messageFromCard(shown.person, $event)"
					(openDirect)="openDirectWith(shown.person)"
				></ngx-chat-person-card>
			</div>
		}
	`,
	styles: [
		`
			/*
			 * The chat's own tokens, from the theme's: every part of the page (the sidebar, the conversation, the
			 * thread, the messages, the composer) reads these, so the page follows the light and the dark themes.
			 */
			.person-card-host {
				position: fixed;
				z-index: 1040;
				animation: person-card-in 0.12s ease-out;
			}
			@keyframes person-card-in {
				from {
					opacity: 0;
					transform: translateY(0.25rem);
				}
			}
			@media (prefers-reduced-motion: reduce) {
				.person-card-host {
					animation: none;
				}
			}
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
			/* Bootstrap's global .card stacks its content (flex-direction: column): these cards are one line. */
			.card {
				display: flex;
				flex-direction: row;
				min-width: 0;
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
				color: var(--chat-on-accent);
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

	/**
	 * The active view below the page (`CHAT_VIEW_ROUTES`), read again after every navigation. The page is ONE route
	 * above its views, so it lives on while the person moves between conversations, Unreads and Threads; the view's
	 * `:conversationId` and `data.view` are on that child, not on the page's own route. Read through the page's own
	 * snapshot: the child route may exist before its snapshot is assigned (opening the chat from another page).
	 */
	private readonly activeView$ = this.router.events.pipe(
		filter((event): event is NavigationEnd => event instanceof NavigationEnd),
		startWith(null),
		map(() => this.route.snapshot.firstChild ?? this.route.snapshot)
	);

	/** `:conversationId`, `?thread=`, `?message=` and the view's name, as signals. */
	protected readonly conversationId = toSignal(this.activeView$.pipe(map((view) => view.paramMap.get('conversationId')), distinctUntilChanged()), {
		initialValue: null
	});
	protected readonly threadId = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('thread')), distinctUntilChanged()), { initialValue: null });
	protected readonly highlightId = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('message')), distinctUntilChanged()), { initialValue: null });
	private readonly routeView = toSignal(this.activeView$.pipe(map((view) => (view.data['view'] as string | undefined) ?? null), distinctUntilChanged()), {
		initialValue: null
	});

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
	/** A task is created from a message with `ORG_TASK_ADD` (the API checks it too). */
	protected readonly canCreateTask = this.permission(PermissionsEnum.ORG_TASK_ADD);
	private readonly organization = toSignal(this.store.selectedOrganization$ as Observable<IOrganization | null>, { initialValue: null });
	protected readonly organizationId = computed(() => {
		const id = this.organization()?.id;
		return id ? String(id) : null;
	});
	protected readonly tenantId = computed(() => {
		const tenantId = this.organization()?.tenantId ?? this.user()?.tenantId;
		return tenantId ? String(tenantId) : null;
	});

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
	/** The open conversation's members, for the thread's `@` list. */
	protected readonly selectedMemberIds = computed(() => memberEmployeeIds(this.selected()));

	// ---------------------------------------------------------------- the profile card's state

	/** The person whose card shows, and where (viewport pixels). */
	protected readonly card = signal<{ person: ChatPerson; top: number; left: number } | null>(null);
	protected readonly cardSending = signal(false);
	/** The employee profile page needs `ORG_EMPLOYEES_VIEW` (as on the Teams dashboard). */
	protected readonly canViewProfiles = this.permission(PermissionsEnum.ORG_EMPLOYEES_VIEW);
	/** Their role in the open conversation and since when, when they are in it. */
	protected readonly cardMembership = computed<PersonCardMembership | null>(() => {
		const id = this.card()?.person.employeeId;
		const member = id ? this.selected()?.members?.find((item) => String(item.employeeId) === id) : null;
		return member ? { role: member.role, joinedAt: member.joinedAt ?? null } : null;
	});
	/** In the open conversation, known not to be, or null when its member list cannot tell (a summary of it). */
	protected readonly cardInConversation = computed(() => {
		const id = this.card()?.person.employeeId;
		return id ? membershipOf(this.selectedMemberIds(), id) : null;
	});
	/** The channels and groups of my list they are in too (only those whose members the list carries). */
	protected readonly cardInCommon = computed(() => {
		const id = this.card()?.person.employeeId;
		if (!id || id === this.meEmployeeId()) return null;
		const count = this.conversations().filter(
			(conversation) => conversation.kind !== ChatConversationKindEnum.DIRECT && !!conversation.members?.some((member) => String(member.employeeId) === id)
		).length;
		return count || null;
	});
	private readonly personCard = viewChild<PersonCardComponent>('personCard');
	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
	private readonly zone = inject(NgZone);
	/** The avatar, name or mention the card belongs to. */
	private cardTrigger: Element | null = null;
	private cardOpenTimer: ReturnType<typeof setTimeout> | null = null;
	private cardCloseTimer: ReturnType<typeof setTimeout> | null = null;
	/** The card's request (a direct message, opening our conversation): dropped when the scope changes. */
	private cardRequest: Subscription | null = null;
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
		this.followScrollForCard();
	}

	/** Every user / organization change drops what is shown and asks the API again for the new scope. */
	private followScope(): void {
		this.availability.scope$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((scope) => {
			this.resetForScope();
			if (scope) this.checkAvailability();
		});
	}

	/** The route of the active view (the page's child), or the page's own before a child exists. */
	private viewRoute(): ActivatedRoute {
		return this.route.firstChild ?? this.route;
	}

	/** A conversation opened by link that the list does not hold: read it on its own. */
	private followRoute(): void {
		this.activeView$
			.pipe(
				map((view) => view.paramMap.get('conversationId')),
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
		// The card belongs to the old scope: its person, its draft and its request go with it.
		this.cardRequest?.unsubscribe();
		this.cardRequest = null;
		this.cardSending.set(false);
		this.hideCard();
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
					this.openDirectFromLink();
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
		void this.router.navigate([], { relativeTo: this.viewRoute(), queryParams: { thread: message.id }, queryParamsHandling: 'merge' });
	}

	protected closeThread(): void {
		void this.router.navigate([], { relativeTo: this.viewRoute(), queryParams: { thread: null }, queryParamsHandling: 'merge' });
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
		const context: NewChannelContext = {
			organizationId: this.organizationId(),
			tenantId: this.tenantId(),
			channelNames: this.conversations()
				.filter((conversation) => conversation.kind === ChatConversationKindEnum.CHANNEL)
				.map((conversation) => conversation.name ?? '')
		};
		this.dialog
			.open(NewChannelDialogComponent, { context })
			.onClose.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((conversation: IChatConversationWithState | null) => this.open(conversation));
	}

	protected openNewDirect(): void {
		this.dialog
			.open(NewDirectDialogComponent, { context: { people: this.people(), meEmployeeId: this.meEmployeeId() } })
			.onClose.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((conversation: IChatConversationWithState | null) => this.open(conversation));
	}

	/** The categories of the channels (`CHAT_MANAGE`); the lists are read again after a change. */
	protected openCategories(): void {
		this.dialog
			.open(CategoriesDialogComponent, { context: { categories: this.categories() } })
			.onClose.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((changed: boolean | undefined) => {
				if (changed) this.api.notifyChanged();
			});
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

	// ---------------------------------------------------------------- the profile card

	/** The pointer rests on a person (an avatar, a name, a mention): their card opens after a short pause. */
	protected onPointerOver(event: MouseEvent): void {
		const trigger = personTriggerOf(event.target);
		if (!trigger || !this.people().byEmployee.has(trigger.employeeId)) return;
		if (trigger.element === this.cardTrigger) {
			this.keepCard();
			return;
		}
		// Someone typing in the open card keeps it: passing over another person must not change who it writes to.
		if (this.cardHasFocus()) return;
		this.clearCardOpen();
		// Quicker from one person to the next while a card is already open.
		const delay = this.card() ? CARD_SWITCH_DELAY_MS : CARD_OPEN_DELAY_MS;
		this.cardOpenTimer = setTimeout(() => this.showCard(trigger.element, trigger.employeeId), delay);
	}

	/** The pointer left a person: a pending card does not open, an open one closes unless the pointer reaches it. */
	protected onPointerOut(event: MouseEvent): void {
		const trigger = personTriggerOf(event.target);
		if (!trigger) return;
		const to = event.relatedTarget as Node | null;
		if (to && trigger.element.contains(to)) return;
		this.clearCardOpen();
		if (trigger.element === this.cardTrigger) this.hideCardSoon();
	}

	/** The keyboard reaches a person (a focusable avatar or name): their card opens, without taking the focus. */
	protected onFocusIn(event: FocusEvent): void {
		const trigger = personTriggerOf(event.target);
		if (!trigger || !this.people().byEmployee.has(trigger.employeeId) || this.cardHasFocus()) return;
		if (trigger.element !== this.cardTrigger) this.showCard(trigger.element, trigger.employeeId);
		else this.keepCard();
	}

	/** The focus left a person or the card: the card closes, unless the focus went from one of them to the other. */
	protected onFocusOut(event: FocusEvent): void {
		if (!this.card()) return;
		const from = event.target as Node | null;
		const fromCard = !!from && !!this.cardElement()?.contains(from);
		const fromTrigger = !!from && !!this.cardTrigger?.contains(from);
		if (!fromCard && !fromTrigger) return;
		const to = event.relatedTarget as Node | null;
		if (to && (this.cardElement()?.contains(to) || this.cardTrigger?.contains(to))) return;
		this.hideCardSoon();
	}

	/** Enter or Space on a person opens their card and moves the focus into it (the card is drawn apart from them). */
	protected onTriggerKey(event: KeyboardEvent): void {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		const trigger = personTriggerOf(event.target);
		if (!trigger || trigger.element !== event.target || !this.people().byEmployee.has(trigger.employeeId)) return;
		event.preventDefault();
		if (trigger.element !== this.cardTrigger) this.showCard(trigger.element, trigger.employeeId);
		setTimeout(() => this.cardElement()?.querySelector<HTMLElement>('input, button, a[href]')?.focus());
	}

	protected onDocumentPressForCard(event: MouseEvent): void {
		if (this.card() && !this.cardElement()?.contains(event.target as Node)) this.hideCard();
	}

	/**
	 * Escape closes the card; when the focus was in it, it goes back to the person the card belongs to. The focus moves
	 * first, while the card still belongs to that person (their focusin then only keeps it), and the card closes after.
	 */
	protected onEscapeForCard(): void {
		if (!this.card()) return;
		const trigger = this.cardHasFocus() ? this.cardTrigger : null;
		if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
		this.hideCard();
	}

	/**
	 * A scroll anywhere moves the person away from their card: it closes (unless I am typing in it). The listener runs
	 * outside Angular's zone: every scroll of the message list would otherwise run change detection; closing the card
	 * is a signal write, which renders on its own.
	 */
	private followScrollForCard(): void {
		if (typeof document === 'undefined') return;
		const onScroll = (event: Event) => {
			if (!this.card() || this.cardHasFocus() || this.cardElement()?.contains(event.target as Node)) return;
			this.hideCard();
		};
		this.zone.runOutsideAngular(() => document.addEventListener('scroll', onScroll, true));
		this.destroyRef.onDestroy(() => {
			document.removeEventListener('scroll', onScroll, true);
			this.clearCardOpen();
			this.clearCardClose();
			this.cardRequest?.unsubscribe();
		});
	}

	private showCard(trigger: Element, employeeId: string): void {
		this.cardOpenTimer = null;
		const person = this.people().byEmployee.get(employeeId);
		if (!person || !trigger.isConnected) return;
		// The card writes to its person: it never changes person while someone types in it.
		if (this.cardHasFocus() && this.card()?.person.employeeId !== employeeId) return;
		this.clearCardClose();
		this.cardTrigger = trigger;
		this.card.set({ person, ...cardPlace(trigger.getBoundingClientRect(), CARD_HEIGHT_GUESS_PX, viewportSize()) });
		// Placed again once drawn, with its real height (it must not run off the bottom of the window).
		setTimeout(() => this.fitCard());
	}

	private fitCard(): void {
		const shown = this.card();
		const element = this.cardElement();
		if (!shown || !element || !this.cardTrigger?.isConnected) return;
		const place = cardPlace(this.cardTrigger.getBoundingClientRect(), element.offsetHeight, viewportSize());
		if (place.top !== shown.top || place.left !== shown.left) this.card.set({ ...shown, ...place });
	}

	/** The pointer is on the card (or back on its person): it stays. */
	protected keepCard(): void {
		this.clearCardClose();
	}

	/** Closes the card after a moment, so the pointer can travel from the person to it; not while I type in it. */
	protected hideCardSoon(): void {
		this.clearCardClose();
		this.cardCloseTimer = setTimeout(() => {
			this.cardCloseTimer = null;
			if (!this.cardHasFocus()) this.hideCard();
		}, CARD_CLOSE_DELAY_MS);
	}

	protected hideCard(): void {
		this.clearCardOpen();
		this.clearCardClose();
		this.cardTrigger = null;
		this.card.set(null);
	}

	private clearCardOpen(): void {
		if (this.cardOpenTimer) clearTimeout(this.cardOpenTimer);
		this.cardOpenTimer = null;
	}

	private clearCardClose(): void {
		if (this.cardCloseTimer) clearTimeout(this.cardCloseTimer);
		this.cardCloseTimer = null;
	}

	private cardElement(): HTMLElement | null {
		return this.host.nativeElement.querySelector('.person-card-host');
	}

	private cardHasFocus(): boolean {
		const element = this.cardElement();
		return !!element && typeof document !== 'undefined' && element.contains(document.activeElement);
	}

	/**
	 * The card's box: a direct message to the person (our direct conversation, created when there is none). The
	 * request belongs to the scope it was made in: a change of organization cancels it, and a late answer is dropped.
	 */
	protected messageFromCard(person: ChatPerson, body: string): void {
		const token = this.scopeToken;
		this.cardRequest?.unsubscribe();
		this.cardSending.set(true);
		this.cardRequest = this.api
			.direct([person.employeeId])
			.pipe(
				switchMap((answer) => this.api.send(answer.conversation.id, { body, nonce: newNonce() }).pipe(map(() => answer.conversation))),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe({
				next: (conversation) => {
					if (token !== this.scopeToken) return;
					this.cardSending.set(false);
					this.personCard()?.clear();
					this.hideCard();
					this.upsert(conversation);
					this.api.notifyChanged();
					this.toastr.success('CHAT.PROFILE.SENT', { name: person.name });
				},
				error: () => {
					if (token !== this.scopeToken) return;
					this.cardSending.set(false);
					this.toastr.danger('CHAT.COMPOSER.SEND_FAILED');
				}
			});
	}

	/** The card's message button: opens our direct conversation (created when there is none), in the scope it was asked in. */
	protected openDirectWith(person: ChatPerson): void {
		const token = this.scopeToken;
		this.hideCard();
		this.cardRequest?.unsubscribe();
		this.cardRequest = this.api
			.direct([person.employeeId])
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (answer) => {
					if (token === this.scopeToken) this.open(answer.conversation);
				},
				error: () => {
					if (token === this.scopeToken) this.toastr.danger('CHAT.DIALOG.FAILED');
				}
			});
	}

	/**
	 * Arrived by `?with=<employeeId>` (the Teams dashboard's member card): opens my direct conversation with them,
	 * created when there is none. The link is replaced in the history (by the conversation, or by the page without
	 * the parameter), so Back does not ask again. Myself, or a failure, leaves the page as it is. Any navigation meanwhile
	 * (another conversation, Unreads) drops the request: the page stays mounted across those, so a late answer must not
	 * take the person back.
	 */
	private openDirectFromLink(): void {
		const employeeId = this.route.snapshot.queryParamMap.get(CHAT_DIRECT_WITH_PARAM);
		if (!employeeId) return;
		const dropParam = () =>
			void this.router.navigate([], {
				relativeTo: this.viewRoute(),
				queryParams: { [CHAT_DIRECT_WITH_PARAM]: null },
				queryParamsHandling: 'merge',
				replaceUrl: true
			});
		if (employeeId === this.meEmployeeId()) {
			dropParam();
			return;
		}
		const token = this.scopeToken;
		this.api
			.direct([employeeId])
			.pipe(
				takeUntil(this.router.events.pipe(filter((event) => event instanceof NavigationStart))),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe({
				next: (answer) => {
					if (token !== this.scopeToken || !answer.conversation) return;
					this.upsert(answer.conversation);
					this.api.notifyChanged();
					void this.router.navigate([CHAT_LINK, String(answer.conversation.id)], { replaceUrl: true });
				},
				error: () => {
					if (token !== this.scopeToken) return;
					this.toastr.danger('CHAT.DIALOG.FAILED');
					dropParam();
				}
			});
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
		return messagePreview(thread, this.people().byEmployee, this.conversationNames());
	}

	protected link(conversationId: string): string {
		return `${CHAT_LINK}/${encodeURIComponent(String(conversationId))}`;
	}
}
