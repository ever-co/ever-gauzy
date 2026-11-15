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

/**
 * The welcome screen's sketches play a 12-second loop, one step a second, as the Downloads page's drawings do. Each
 * step says where a drawn "You" cursor is and whether it clicks there.
 */
const WELCOME_LOOP_SECONDS = 12;
interface WelcomeCursorStep<T extends string> {
	at: T;
	press?: boolean;
}
/** Channel: the cursor clicks the composer, "types" a message (seconds 2–4), then clicks Send (second 5). */
const CHANNEL_SCRIPT: WelcomeCursorStep<'list' | 'composer' | 'send'>[] = [
	{ at: 'list' },
	{ at: 'composer' },
	{ at: 'composer', press: true },
	{ at: 'composer' },
	{ at: 'send' },
	{ at: 'send', press: true },
	{ at: 'list' },
	{ at: 'list' },
	{ at: 'list' },
	{ at: 'list' },
	{ at: 'list' },
	{ at: 'list' }
];
/** Browse channels: the cursor moves to the second channel's Join button and clicks it (second 5). */
const BROWSE_SCRIPT: WelcomeCursorStep<'search' | 'join'>[] = [
	{ at: 'search' },
	{ at: 'search' },
	{ at: 'search' },
	{ at: 'join' },
	{ at: 'join' },
	{ at: 'join', press: true },
	{ at: 'join' },
	{ at: 'search' },
	{ at: 'search' },
	{ at: 'search' },
	{ at: 'search' },
	{ at: 'search' }
];
/** The second the message is sent, the channel joined and the teammate's reply arrives; all reset on the loop's last second. */
const WELCOME_ACT_STEP = 5;
const WELCOME_RESET_STEP = WELCOME_LOOP_SECONDS - 1;

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
											<!-- Laid out like the Downloads page: a grid of framed tiles, or one wide tile with a drawing when there is nothing. -->
											<div class="simple-scroll">
												<div class="simple-inner">
													<!-- One tile per conversation, as the Downloads page's cards: title, description, then an action row. -->
													<div class="item-tiles">
														@for (conversation of unreads(); track conversation.id) {
															<section class="tile item-tile">
																<div class="tile-inner">
																	<div class="item-head">
																		<h4>{{ cardTitle(conversation) }}</h4>
																		@if (conversation.lastMessageAt) {
																			<time>{{ conversation.lastMessageAt | date: 'short' }}</time>
																		}
																	</div>
																	@if (conversation.topic) {
																		<p class="item-text">{{ conversation.topic }}</p>
																	}
																	<div class="tile-row">
																		<span class="card-icon">
																			@if (conversation.kind === 'channel') {
																				<nb-icon [icon]="conversation.visibility === 'private' ? 'lock-outline' : 'hash-outline'"></nb-icon>
																			} @else if (personOf(conversation); as person) {
																				<ngx-chat-person-avatar [person]="person"></ngx-chat-person-avatar>
																			} @else {
																				<nb-icon icon="people-outline"></nb-icon>
																			}
																		</span>
																		<span class="row-label">
																			{{ 'CHAT.LIST.UNREAD_IN' | translate: { count: conversation.state?.unreadCount } }}
																			@if (conversation.state?.mentionCount) {
																				<span class="count mention">&#64;{{ conversation.state.mentionCount }}</span>
																			}
																		</span>
																		<a class="button" [routerLink]="link(conversation.id)">{{ 'CHAT.WELCOME.OPEN' | translate }} <nb-icon icon="arrow-forward-outline"></nb-icon></a>
																	</div>
																</div>
															</section>
														} @empty {
															<section class="tile wide empty-tile" data-test="unreads-empty">
																<div class="tile-inner">
																	<div class="tile-text">
																		<h4>{{ 'CHAT.UNREADS.EMPTY' | translate }}</h4>
																		<p>{{ 'CHAT.UNREADS.EMPTY_HINT' | translate }}</p>
																	</div>
																	<!-- Every conversation read: a list with a double check on each row. -->
																	<div class="tile-art dotted" aria-hidden="true">
																		<div class="mock window">
																			<div class="mock-bar"><nb-icon icon="radio-button-on-outline"></nb-icon><i class="line w30"></i></div>
																			<div class="mock-rows">
																				@for (width of mockChannels; track $index) {
																					<div class="mock-channel">
																						<nb-icon icon="hash-outline"></nb-icon>
																						<i class="line strong" [style.width.%]="width"></i>
																						<span class="spacer"></span>
																						<nb-icon class="read" icon="done-all-outline"></nb-icon>
																					</div>
																				}
																			</div>
																		</div>
																	</div>
																</div>
															</section>
														}
													</div>
												</div>
											</div>
										</section>
									}
									@case ('threads') {
										<section class="simple" data-test="threads-view">
											<header class="simple-header">
												<a class="back icon-button" [routerLink]="chatLink" [attr.aria-label]="'CHAT.VIEW.BACK' | translate"><nb-icon icon="arrow-back-outline"></nb-icon></a>
												<span class="header-icon"><nb-icon icon="message-square-outline"></nb-icon></span>
												<h5>{{ 'CHAT.THREADS.TITLE' | translate }}</h5>
											</header>
											<div class="simple-scroll">
												<div class="simple-inner">
													<div class="item-tiles">
														@for (thread of threads(); track thread.id) {
															<section class="tile item-tile">
																<div class="tile-inner">
																	<div class="item-head">
																		<h4>{{ titleOf(thread.conversationId) }}</h4>
																		@if (thread.lastReplyAt) {
																			<time>{{ thread.lastReplyAt | date: 'short' }}</time>
																		}
																	</div>
																	<p class="item-text clamp">{{ preview(thread) }}</p>
																	<div class="tile-row">
																		<span class="card-icon"><nb-icon icon="message-square-outline"></nb-icon></span>
																		<span class="row-label">
																			{{ 'CHAT.THREADS.REPLIES' | translate: { count: thread.replyCount } }}
																			@if (thread.unreadReplies > 0) {
																				<span class="count mention">{{ 'CHAT.THREADS.UNREAD_REPLIES' | translate: { count: thread.unreadReplies } }}</span>
																			}
																		</span>
																		<a class="button" [routerLink]="link(thread.conversationId)" [queryParams]="{ thread: thread.id }">{{ 'CHAT.THREADS.VIEW' | translate }} <nb-icon icon="arrow-forward-outline"></nb-icon></a>
																	</div>
																</div>
															</section>
														} @empty {
															<section class="tile wide empty-tile" data-test="threads-empty">
																<div class="tile-inner">
																	<div class="tile-text">
																		<h4>{{ 'CHAT.THREADS.EMPTY_TITLE' | translate }}</h4>
																		<p>{{ 'CHAT.THREADS.EMPTY' | translate }}</p>
																	</div>
																	<!-- A message with its thread under it: the repliers' avatars and the "N replies" link. -->
																	<div class="tile-art dotted" aria-hidden="true">
																		<div class="mock window">
																			<div class="mock-bar"><nb-icon icon="hash-outline"></nb-icon><i class="line w30"></i></div>
																			<div class="mock-rows thread">
																				<div class="mock-message">
																					<span class="dot" data-tone="2"></span>
																					<span class="mock-lines">
																						<span class="name-row"><i class="line strong w30"></i><i class="line time"></i></span>
																						<i class="line w70"></i>
																						<i class="line w45"></i>
																					</span>
																				</div>
																				<div class="mock-thread">
																					<span class="dot mini" data-tone="1"></span>
																					<span class="dot mini" data-tone="3"></span>
																					<i class="line accent w30"></i>
																				</div>
																				<div class="mock-message">
																					<span class="dot" data-tone="3"></span>
																					<span class="mock-lines">
																						<span class="name-row"><i class="line strong w35"></i><i class="line time"></i></span>
																						<i class="line w60"></i>
																					</span>
																				</div>
																			</div>
																		</div>
																	</div>
																</div>
															</section>
														}
													</div>
												</div>
											</div>
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
										<div class="welcome" data-test="pick">
											<div class="welcome-inner">
												<header class="welcome-head">
													<h3>{{ 'CHAT.VIEW.HOME_TITLE' | translate }}</h3>
													<p>{{ 'CHAT.VIEW.PICK' | translate }}</p>
												</header>

												<div class="tiles">
													<!-- Channels: the wide tile, text on the left and a channel window on the right. -->
													<section class="tile wide">
														<div class="tile-inner">
															<div class="tile-text">
																<h4>{{ 'CHAT.LIST.CHANNELS' | translate }}</h4>
																<p>{{ 'CHAT.WELCOME.CHANNELS_TEXT' | translate }}</p>
																<div class="tile-cta">
																	<button type="button" class="button primary" (click)="openNewChannel()"><nb-icon icon="hash-outline"></nb-icon> {{ 'CHAT.LIST.NEW_CHANNEL' | translate }}</button>
																	<p class="kinds">
																		<span>{{ 'CHAT.WELCOME.CHANNELS_KINDS' | translate }}</span>
																		<strong><nb-icon icon="hash-outline"></nb-icon> {{ 'CHAT.WELCOME.PUBLIC' | translate }}</strong>
																		<strong><nb-icon icon="lock-outline"></nb-icon> {{ 'CHAT.LIST.PRIVATE' | translate }}</strong>
																	</p>
																</div>
															</div>
															<div class="tile-art dotted" aria-hidden="true">
																<div class="mock window">
																	<div class="mock-bar">
																		<nb-icon icon="hash-outline"></nb-icon>
																		<i class="line w30"></i>
																		<span class="spacer"></span>
																		<nb-icon icon="minus-outline"></nb-icon>
																		<nb-icon icon="close-outline"></nb-icon>
																	</div>
																	<div class="mock-body">
																		@for (row of mockRows; track $index) {
																			<div class="mock-message">
																				<span class="dot" [attr.data-tone]="row.tone"></span>
																				<span class="mock-lines">
																					<span class="name-row"><i class="line strong" [style.width.%]="row.name"></i><i class="line time"></i></span>
																					<i class="line" [style.width.%]="row.text"></i>
																				</span>
																			</div>
																		}
																		@if (channelSent()) {
																			<div class="mock-message is-new">
																				<span class="dot" [attr.data-tone]="mockSent.tone"></span>
																				<span class="mock-lines">
																					<span class="name-row"><i class="line strong" [style.width.%]="mockSent.name"></i><i class="line time"></i></span>
																					<i class="line" [style.width.%]="mockSent.text"></i>
																				</span>
																			</div>
																		}
																	</div>
																	<div class="mock-composer" [class.is-focused]="channelTyping()">
																		@if (channelTyping()) {
																			<span class="draft"><i class="line"></i><span class="caret"></span></span>
																		} @else {
																			<i class="line faint w40"></i>
																		}
																		<span class="send" [class.is-pressed]="channelCursor().press && channelCursor().at === 'send'"><nb-icon icon="paper-plane-outline"></nb-icon></span>
																	</div>
																	<!-- The "You" cursor; its step comes from the welcome loop. -->
																	<span class="cursor" [attr.data-at]="channelCursor().at" [class.is-pressing]="channelCursor().press">
																		<svg class="cursor-arrow" viewBox="0 0 20 20"><path d="M3 2.5 16.5 9l-5.75 1.75L8 16.5Z" /></svg>
																		<span class="cursor-label">{{ 'CHAT.WELCOME.YOU' | translate }}</span>
																	</span>
																</div>
															</div>
														</div>
													</section>

													<!-- Direct messages. -->
													<section class="tile">
														<div class="tile-inner">
															<div class="tile-text">
																<h4>{{ 'CHAT.LIST.DIRECT' | translate }}</h4>
																<p>{{ 'CHAT.WELCOME.DIRECT_TEXT' | translate }}</p>
															</div>
															<div class="tile-row">
																<nb-icon icon="people-outline"></nb-icon>
																<span>{{ 'CHAT.WELCOME.DIRECT_LABEL' | translate }}</span>
																<button type="button" class="button" (click)="openNewDirect()">{{ 'CHAT.LIST.NEW_MESSAGE' | translate }}</button>
															</div>
															<div class="tile-art bottom" aria-hidden="true">
																<!-- Messages as in Slack or Discord: avatar, name and time, then the text; a follow-up from the same person has no avatar. -->
																<div class="mock direct">
																	@for (row of mockDirect; track $index) {
																		<div class="mock-message" [class.follow-up]="!row.name">
																			@if (row.name) {
																				<span class="dot" [attr.data-tone]="row.tone"></span>
																			}
																			<span class="mock-lines">
																				@if (row.name) {
																					<span class="name-row"><i class="line strong" [style.width.%]="row.name"></i><i class="line time"></i></span>
																				}
																				@for (width of row.lines; track $index) {
																					<i class="line" [style.width.%]="width"></i>
																				}
																			</span>
																		</div>
																	}
																	@if (directTyping()) {
																		<div class="mock-message typing">
																			<span class="dot" [attr.data-tone]="mockReply.tone"></span>
																			<span class="typing-dots"><span></span><span></span><span></span></span>
																		</div>
																	}
																	@if (directReplied()) {
																		<div class="mock-message is-new">
																			<span class="dot" [attr.data-tone]="mockReply.tone"></span>
																			<span class="mock-lines">
																				<span class="name-row"><i class="line strong" [style.width.%]="mockReply.name"></i><i class="line time"></i></span>
																				@for (width of mockReply.lines; track $index) {
																					<i class="line" [style.width.%]="width"></i>
																				}
																			</span>
																		</div>
																	}
																</div>
															</div>
														</div>
													</section>

													<!-- Browse channels. -->
													<section class="tile">
														<div class="tile-inner">
															<div class="tile-text">
																<h4>{{ 'CHAT.LIST.BROWSE' | translate }}</h4>
																<p>{{ 'CHAT.WELCOME.BROWSE_TEXT' | translate }}</p>
															</div>
															<div class="tile-row">
																<nb-icon icon="search-outline"></nb-icon>
																<span>{{ 'CHAT.WELCOME.BROWSE_LABEL' | translate }}</span>
																<button type="button" class="button" (click)="openBrowse()">{{ 'CHAT.WELCOME.OPEN' | translate }} <nb-icon icon="arrow-forward-outline"></nb-icon></button>
															</div>
															<div class="tile-art bottom" aria-hidden="true">
																<div class="mock list">
																	<div class="mock-search"><nb-icon icon="search-outline"></nb-icon><i class="line w40"></i></div>
																	@for (width of mockChannels; track $index; let i = $index) {
																		<!-- The second channel is the one the cursor joins. -->
																		<div class="mock-channel" [class.is-hovered]="i === 1 && browseCursor().at === 'join'">
																			<nb-icon icon="hash-outline"></nb-icon>
																			<i class="line strong" [style.width.%]="width"></i>
																			<span class="spacer"></span>
																			<span class="pill" [class.is-joined]="i === 1 && browseJoined()" [class.is-pressed]="i === 1 && !!browseCursor().press">
																				@if (i === 1 && browseJoined()) {
																					<nb-icon icon="checkmark-outline"></nb-icon>
																				}
																			</span>
																		</div>
																	}
																	<span class="cursor" [attr.data-at]="browseCursor().at" [class.is-pressing]="browseCursor().press">
																		<svg class="cursor-arrow" viewBox="0 0 20 20"><path d="M3 2.5 16.5 9l-5.75 1.75L8 16.5Z" /></svg>
																		<span class="cursor-label">{{ 'CHAT.WELCOME.YOU' | translate }}</span>
																	</span>
																</div>
															</div>
														</div>
													</section>
												</div>
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
			.state-icon.danger {
				color: var(--chat-danger);
			}
			/*
			 * The welcome screen (no conversation open), laid out like the Downloads page: a centred headline,
			 * then tiles in a double frame (an outer ring around the card), the wide one with its text on the
			 * left and a sketch of a channel on the right, two half-width ones with an action row and a sketch
			 * at the bottom. A faint accent glow rises from the bottom of each card; the sketches are drawn with
			 * the theme's tints, so the screen follows the light and the dark themes.
			 */
			.welcome {
				height: 100%;
				overflow-y: auto;
				container-type: inline-size;
			}
			.welcome-inner {
				max-width: 64rem;
				margin: 0 auto;
				padding: 3rem 2rem 2.5rem;
			}
			.welcome-head {
				margin-bottom: 2.25rem;
				text-align: center;
			}
			.welcome-head h3 {
				margin: 0;
				color: var(--chat-text);
				font-size: clamp(1.625rem, 1.2rem + 1.6vw, 2.5rem);
				font-weight: 500;
				line-height: 1.2;
				letter-spacing: -0.015em;
			}
			.welcome-head p {
				margin: 0.625rem 0 0;
				color: var(--chat-muted);
				font-size: 0.9375rem;
			}
			.tiles {
				display: grid;
				grid-template-columns: repeat(2, minmax(0, 1fr));
				gap: 1.25rem;
			}
			.tile {
				padding: 0.375rem;
				border: 1px solid var(--chat-border);
				border-radius: 1.5rem;
			}
			.tile.wide {
				grid-column: 1 / -1;
			}
			.tile-inner {
				position: relative;
				display: flex;
				flex-direction: column;
				height: 100%;
				min-height: 22rem;
				overflow: hidden;
				border: 1px solid var(--chat-border);
				border-radius: 1.125rem;
				background: radial-gradient(130% 70% at 0% 100%, var(--chat-accent-soft-2), transparent 70%), var(--chat-sidebar-bg);
			}
			.tile.wide .tile-inner {
				display: grid;
				grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
				min-height: 21rem;
			}
			.tile-text {
				display: flex;
				flex-direction: column;
				padding: 2.25rem 2.25rem 0;
			}
			.tile.wide .tile-text {
				padding-bottom: 2.25rem;
			}
			.tile-text h4 {
				margin: 0;
				color: var(--chat-text);
				font-size: 1.25rem;
				font-weight: 600;
				line-height: 1.3;
			}
			.tile-text p {
				max-width: 34rem;
				margin: 0.5rem 0 0;
				color: var(--chat-muted);
				font-size: 0.9375rem;
				line-height: 1.6;
			}
			.tile-cta {
				display: flex;
				flex-direction: column;
				align-items: flex-start;
				gap: 1.25rem;
				margin-top: auto;
				padding-top: 2rem;
			}
			.tile-text p.kinds {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.5rem 1rem;
				margin: 0;
				font-size: 0.875rem;
			}
			.kinds strong {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				color: var(--chat-text);
				font-weight: 500;
			}
			.kinds nb-icon {
				font-size: 1rem;
			}
			.tile-row {
				display: flex;
				align-items: center;
				gap: 0.75rem;
				margin: 1.75rem 2.25rem 0;
				color: var(--chat-text);
				font-size: 0.9375rem;
				font-weight: 500;
			}
			.tile-row > nb-icon {
				font-size: 1.25rem;
			}
			.tile-row > span {
				flex: 1 1 auto;
				min-width: 0;
			}
			.tile-row .button {
				flex: 0 0 auto;
			}
			.welcome .button,
			.item-tile .button {
				gap: 0.5rem;
				height: 2.5rem;
				padding: 0 1.125rem;
				border-color: transparent;
				background: var(--chat-hover);
				font-size: 0.9375rem;
				font-weight: 500;
			}
			.welcome .button:hover:not(:disabled),
			.item-tile .button:hover:not(:disabled) {
				background: var(--chat-active-tint);
			}
			.welcome .button.primary {
				background: var(--chat-text);
				color: var(--chat-bg);
			}
			.welcome .button.primary:hover:not(:disabled) {
				background: var(--chat-text);
				filter: none;
				opacity: 0.88;
			}
			.welcome .button:focus-visible,
			.item-tile .button:focus-visible {
				outline: 2px solid var(--chat-accent);
				outline-offset: 2px;
			}

			/* The sketches: lines and dots in the theme's tints, nothing to read. */
			.tile-art {
				position: relative;
				display: flex;
				justify-content: center;
				min-width: 0;
				pointer-events: none;
			}
			.tile-art.dotted {
				align-items: flex-end;
				padding: 2.75rem 2.5rem 0;
				background-image: radial-gradient(var(--chat-border-strong) 1px, transparent 1.5px);
				background-size: 1.125rem 1.125rem;
				background-position: center;
			}
			.tile-art.bottom {
				flex: 1 1 auto;
				align-items: flex-end;
				margin-top: 2.5rem;
				padding: 0 2.25rem;
			}
			.mock {
				width: 100%;
				max-width: 22rem;
				border: 1px solid var(--chat-border-strong);
				background: var(--chat-bg);
				box-shadow: 0 1.25rem 2.5rem rgba(0, 0, 0, 0.18);
			}
			/* The drawings have fixed heights, so a message arriving scrolls the older ones up instead of growing the card. */
			.mock.window {
				position: relative;
				margin-bottom: -1px;
				border-radius: 0.875rem 0.875rem 0 0;
				border-bottom: 0;
			}
			.mock.direct,
			.mock.list {
				position: relative;
				height: 12.5rem;
				border-bottom: 0;
				border-radius: 1rem 1rem 0 0;
			}
			.mock-body,
			.mock.direct {
				justify-content: flex-end;
				overflow: hidden;
			}
			/* The messages scrolling out at the top fade away. */
			.mock-body {
				-webkit-mask-image: linear-gradient(to bottom, transparent, #000 2.5rem);
				mask-image: linear-gradient(to bottom, transparent, #000 2.5rem);
			}
			.mock.direct::before {
				content: '';
				position: absolute;
				inset: 0 0 auto;
				z-index: 1;
				height: 2.5rem;
				background: linear-gradient(var(--chat-bg), transparent);
			}
			.line {
				display: block;
				height: 0.5rem;
				border-radius: 999px;
				background: var(--chat-active-tint);
			}
			.line.strong {
				height: 0.5625rem;
				background: var(--chat-border-strong);
			}
			.w30 {
				width: 30%;
			}
			.w35 {
				width: 35%;
			}
			.w40 {
				width: 40%;
			}
			.w45 {
				width: 45%;
			}
			.w50 {
				width: 50%;
			}
			.w60 {
				width: 60%;
			}
			.w70 {
				width: 70%;
			}
			.spacer {
				flex: 1 1 auto;
			}
			.mock-bar {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				padding: 0.75rem 1rem;
				border-bottom: 1px solid var(--chat-border);
				color: var(--chat-muted);
			}
			.mock-bar nb-icon {
				font-size: 1rem;
			}
			.mock-bar > nb-icon:first-child {
				color: var(--chat-text);
			}
			.mock-body {
				display: flex;
				flex-direction: column;
				gap: 1.125rem;
				height: 12.75rem;
				padding: 1rem 1rem 1.25rem;
			}
			.mock-message {
				display: flex;
				align-items: flex-start;
				gap: 0.75rem;
			}
			.dot {
				width: 1.75rem;
				height: 1.75rem;
				flex: 0 0 auto;
				border-radius: 0.5rem;
				background: var(--chat-accent);
			}
			.dot[data-tone='2'] {
				background: var(--color-success-default, #00b887);
			}
			.dot[data-tone='3'] {
				background: var(--color-warning-default, #ffaa00);
			}
			.mock-lines {
				display: flex;
				flex-direction: column;
				gap: 0.4375rem;
				flex: 1 1 auto;
				padding-top: 0.25rem;
			}
			.mock-composer {
				display: flex;
				align-items: center;
				justify-content: space-between;
				margin: 0 1rem 1rem;
				padding: 0.5rem 0.5rem 0.5rem 0.875rem;
				border: 1px solid var(--chat-border);
				border-radius: 0.625rem;
				transition: border-color 0.2s ease, box-shadow 0.2s ease;
			}
			.mock-composer.is-focused {
				border-color: var(--chat-accent);
				box-shadow: 0 0 0 3px var(--chat-accent-soft);
			}
			.line.faint {
				opacity: 0.6;
			}
			/* What the cursor "types": a line that grows in steps, with a blinking caret after it. */
			.draft {
				display: flex;
				align-items: center;
				gap: 0.1875rem;
				flex: 1 1 auto;
				min-width: 0;
			}
			.draft .line {
				width: 0;
				background: var(--chat-border-strong);
				animation: chat-welcome-type 2.6s steps(14, end) forwards;
			}
			.caret {
				width: 2px;
				height: 0.875rem;
				flex: 0 0 auto;
				border-radius: 1px;
				background: var(--chat-accent);
				animation: chat-welcome-blink 1s steps(1) infinite;
			}
			.send {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1.75rem;
				height: 1.75rem;
				border-radius: 0.5rem;
				background: var(--chat-accent);
				color: var(--chat-on-accent);
			}
			.send nb-icon {
				font-size: 0.875rem;
			}
			.name-row {
				display: flex;
				align-items: center;
				gap: 0.5rem;
			}
			.line.time {
				width: 1.75rem;
				height: 0.375rem;
				flex: 0 0 auto;
				opacity: 0.7;
			}
			.mock.direct {
				display: flex;
				flex-direction: column;
				gap: 1rem;
				padding: 1.25rem 1rem 1rem;
			}
			/* "Someone is typing": three dots bouncing one after another where their message will be. */
			.mock-message.typing {
				align-items: center;
				animation: chat-welcome-rise 0.3s ease-out both;
			}
			.typing-dots {
				display: inline-flex;
				gap: 0.25rem;
				padding: 0.5rem 0.625rem;
				border-radius: 0.625rem;
				background: var(--chat-elevated);
			}
			.typing-dots span {
				width: 0.375rem;
				height: 0.375rem;
				border-radius: 50%;
				background: var(--chat-muted);
				animation: chat-welcome-bounce 1.1s ease-in-out infinite;
			}
			.typing-dots span:nth-child(2) {
				animation-delay: 0.15s;
			}
			.typing-dots span:nth-child(3) {
				animation-delay: 0.3s;
			}
			/* A message that just arrived rises in. */
			.mock-message.is-new {
				animation: chat-welcome-rise 0.45s cubic-bezier(0.2, 0.7, 0.2, 1) both;
			}
			/* A follow-up lines up with the text above it: the avatar's width plus the gap. */
			.mock-message.follow-up {
				margin-top: -0.625rem;
				padding-left: 2.5rem;
			}
			.mock-message.follow-up .mock-lines {
				padding-top: 0;
			}
			.mock.list {
				display: flex;
				flex-direction: column;
				gap: 0.25rem;
				padding: 1rem 0.75rem;
			}
			.mock-search {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				margin-bottom: 0.5rem;
				padding: 0.5rem 0.75rem;
				border: 1px solid var(--chat-border);
				border-radius: 0.5rem;
				color: var(--chat-muted);
			}
			.mock-channel {
				display: flex;
				align-items: center;
				gap: 0.625rem;
				padding: 0.5rem 0.5rem;
				border-radius: 0.5rem;
				color: var(--chat-muted);
				transition: background-color 0.25s ease;
			}
			.mock-channel.is-hovered {
				background: var(--chat-hover);
			}
			.mock-search nb-icon,
			.mock-channel nb-icon {
				font-size: 1rem;
			}
			.pill {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 2.75rem;
				height: 1.375rem;
				border-radius: 0.375rem;
				background: var(--chat-accent-soft-2);
				transition: background-color 0.2s ease, color 0.2s ease;
			}
			.pill.is-joined {
				background: var(--chat-accent);
				color: var(--chat-on-accent);
			}
			.pill nb-icon {
				font-size: 0.875rem;
			}
			.send.is-pressed,
			.pill.is-pressed {
				animation: chat-welcome-flash 0.7s ease-out;
			}

			/*
			 * The "You" cursors, as on the Downloads page: the welcome loop sets each one's data-at (where it is) and
			 * is-pressing (a click this second); it glides between spots and the clicked control answers with a ring.
			 * Spots are measured from the drawings above (from the drawing's top and start edges).
			 */
			.cursor {
				position: absolute;
				z-index: 2;
				top: 0;
				inset-inline-start: 0;
				display: flex;
				align-items: flex-start;
				pointer-events: none;
				transition: inset-inline-start 0.9s cubic-bezier(0.65, 0, 0.35, 1), top 0.9s cubic-bezier(0.65, 0, 0.35, 1);
			}
			.cursor-arrow {
				flex: 0 0 auto;
				width: 1.125rem;
				height: 1.125rem;
				overflow: visible;
				transform-origin: 3px 2.5px;
				fill: var(--chat-accent);
				stroke: var(--chat-on-accent);
				stroke-width: 1.5;
				stroke-linejoin: round;
			}
			.cursor-label {
				margin-top: 0.875rem;
				margin-inline-start: -0.25rem;
				padding: 0.125rem 0.5rem;
				border-radius: 0.375rem;
				background: var(--chat-accent);
				color: var(--chat-on-accent);
				font-size: 0.6875rem;
				font-weight: 600;
				line-height: 1rem;
				white-space: nowrap;
				box-shadow: 0 0.25rem 0.75rem rgba(0, 0, 0, 0.2);
			}
			.cursor.is-pressing .cursor-arrow {
				animation: chat-welcome-press 0.35s ease-out;
			}
			.window .cursor[data-at='list'] {
				inset-inline-start: 64%;
				top: 6.5rem;
			}
			.window .cursor[data-at='composer'] {
				inset-inline-start: 34%;
				top: 16.25rem;
			}
			.window .cursor[data-at='send'] {
				inset-inline-start: calc(100% - 2.75rem);
				top: 16.25rem;
			}
			.list .cursor[data-at='search'] {
				inset-inline-start: 58%;
				top: 1.875rem;
			}
			.list .cursor[data-at='join'] {
				inset-inline-start: calc(100% - 2.875rem);
				top: 7.375rem;
			}

			/* The page opening: the headline and the cards rise in one after another, the sketches' messages too. */
			.welcome-head,
			.tile {
				animation: chat-welcome-rise 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both;
			}
			.tile:nth-child(1) {
				animation-delay: 0.06s;
			}
			.tile:nth-child(2) {
				animation-delay: 0.14s;
			}
			.tile:nth-child(3) {
				animation-delay: 0.22s;
			}
			.mock-body .mock-message,
			.mock.direct .mock-message,
			.mock-channel {
				animation: chat-welcome-rise 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both;
				animation-delay: 0.4s;
			}
			/* (The channel list's first child is its search field, so its channels start at the second.) */
			.mock-body .mock-message:nth-child(2),
			.mock.direct .mock-message:nth-child(2),
			.mock-channel:nth-child(3) {
				animation-delay: 0.48s;
			}
			.mock-body .mock-message:nth-child(3),
			.mock.direct .mock-message:nth-child(3),
			.mock-channel:nth-child(4) {
				animation-delay: 0.56s;
			}
			.mock-body .mock-message:nth-child(4),
			.mock.direct .mock-message:nth-child(4),
			.mock-channel:nth-child(5) {
				animation-delay: 0.64s;
			}
			.mock-body .mock-message.is-new,
			.mock.direct .mock-message.is-new,
			.mock.direct .mock-message.typing {
				animation-delay: 0s;
			}
			@keyframes chat-welcome-rise {
				from {
					opacity: 0;
					transform: translateY(0.75rem);
				}
				to {
					opacity: 1;
					transform: none;
				}
			}
			@keyframes chat-welcome-press {
				40% {
					transform: scale(0.8);
				}
				100% {
					transform: scale(1);
				}
			}
			@keyframes chat-welcome-flash {
				0% {
					box-shadow: 0 0 0 0 var(--chat-accent-soft-2);
				}
				30% {
					box-shadow: 0 0 0 4px var(--chat-accent-soft-2);
				}
				100% {
					box-shadow: 0 0 0 8px transparent;
				}
			}
			@keyframes chat-welcome-type {
				to {
					width: 55%;
				}
			}
			@keyframes chat-welcome-blink {
				50% {
					opacity: 0;
				}
			}
			@keyframes chat-welcome-bounce {
				0%,
				60%,
				100% {
					transform: none;
					opacity: 0.5;
				}
				30% {
					transform: translateY(-0.25rem);
					opacity: 1;
				}
			}
			/* Less motion asked for: the still picture, with no entrances, typing or cursors (the loop does not run either). */
			@media (prefers-reduced-motion: reduce) {
				.welcome *,
				.welcome-head,
				.tile {
					animation: none !important;
					transition: none !important;
				}
				.cursor {
					display: none;
				}
			}
			@container (max-width: 44rem) {
				.welcome-inner {
					padding: 2rem 1rem;
				}
				.tiles {
					grid-template-columns: minmax(0, 1fr);
				}
				.tile.wide .tile-inner {
					grid-template-columns: minmax(0, 1fr);
				}
				.tile.wide .tile-text {
					padding-bottom: 0;
				}
				.tile-art.dotted {
					padding-top: 2rem;
				}
				.tile-text {
					padding: 1.75rem 1.5rem 0;
				}
				.tile-row {
					margin: 1.5rem 1.5rem 0;
				}
				.tile-art.bottom {
					padding: 0 1.5rem;
				}
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
			/* Unreads and Threads follow the welcome screen: soft buttons, medium weights, the rows in a centred column. */
			.simple-header .button {
				height: 2rem;
				border-color: transparent;
				background: var(--chat-hover);
				font-size: 0.8125rem;
				font-weight: 500;
			}
			.simple-header .button:hover:not(:disabled) {
				background: var(--chat-active-tint);
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
				font-weight: 600;
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
			/*
			 * Unreads and Threads, laid out like the Downloads page: under the top bar (which names the page), a grid of
			 * framed tiles (the welcome tiles' ring, without the glow), one per conversation or thread: a title with its
			 * time, a short description, and an action row pinned to the bottom so the rows of a grid line up.
			 */
			.simple-scroll {
				flex: 1 1 auto;
				min-height: 0;
				overflow-y: auto;
				container-type: inline-size;
			}
			.simple-inner {
				max-width: 64rem;
				margin: 0 auto;
				padding: 2rem 2rem 2.5rem;
			}
			.item-tiles {
				display: grid;
				grid-template-columns: repeat(2, minmax(0, 1fr));
				gap: 1.25rem;
			}
			/* A shade off the page, toward the text colour: a little lighter on dark themes, a little darker on light ones. */
			.item-tile .tile-inner,
			.empty-tile .tile-inner {
				background: color-mix(in srgb, var(--chat-text) 3.5%, var(--chat-bg));
			}
			.item-tile .tile-inner {
				min-height: 0;
				padding: 2rem 2.25rem;
			}
			.tile.wide.empty-tile .tile-inner {
				min-height: 17rem;
			}
			.mock-rows {
				display: flex;
				flex-direction: column;
				gap: 0.25rem;
				padding: 0.75rem 0.75rem 1.25rem;
			}
			.mock-rows.thread {
				gap: 1rem;
				padding: 1.25rem 1rem 1.5rem;
			}
			.mock-channel .read {
				color: var(--color-success-default, #00b887);
			}
			/* The thread under a message, lined up with its text: the repliers' small avatars and the replies link. */
			.mock-thread {
				display: flex;
				align-items: center;
				gap: 0.375rem;
				margin-top: -0.5rem;
				padding-inline-start: 2.5rem;
			}
			.dot.mini {
				width: 1rem;
				height: 1rem;
				border-radius: 0.3125rem;
			}
			.line.accent {
				margin-inline-start: 0.25rem;
				background: var(--chat-accent);
			}
			.item-head {
				display: flex;
				align-items: baseline;
				gap: 1rem;
			}
			.item-head h4 {
				flex: 1 1 auto;
				min-width: 0;
				margin: 0;
				overflow: hidden;
				color: var(--chat-text);
				font-size: 1.25rem;
				font-weight: 600;
				line-height: 1.3;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.item-head time {
				flex: 0 0 auto;
				color: var(--chat-muted);
				font-size: 0.8125rem;
			}
			.item-text {
				margin: 0.5rem 0 0;
				color: var(--chat-muted);
				font-size: 0.9375rem;
				line-height: 1.6;
				overflow-wrap: anywhere;
			}
			.item-text.clamp {
				overflow: hidden;
				display: -webkit-box;
				-webkit-line-clamp: 2;
				-webkit-box-orient: vertical;
			}
			.item-tile .tile-row {
				margin: auto 0 0;
				padding-top: 1.75rem;
			}
			.item-tile .tile-row > .card-icon {
				flex: 0 0 auto;
			}
			.row-label {
				display: inline-flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.5rem;
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
			@container (max-width: 40rem) {
				.simple-inner {
					padding: 2rem 1rem;
				}
				.item-tiles {
					grid-template-columns: minmax(0, 1fr);
				}
				.item-tile .tile-inner {
					padding: 1.5rem;
				}
			}
			.count {
				min-width: 1.375rem;
				height: 1.25rem;
				padding: 0 0.4375rem;
				border-radius: 999px;
				background: var(--chat-active-tint);
				color: var(--chat-text);
				font-size: 0.6875rem;
				font-weight: 600;
				line-height: 1.25rem;
				text-align: center;
				white-space: nowrap;
			}
			.count.mention {
				background: var(--chat-danger);
				color: var(--chat-on-accent);
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
				.welcome-head {
					margin-bottom: 1.5rem;
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

	/** The welcome screen's sketches: a few messages in a channel (avatar tone, line widths in %) and a few channels. */
	protected readonly mockRows = [
		{ tone: 1, name: 28, text: 82 },
		{ tone: 2, name: 22, text: 64 },
		{ tone: 3, name: 34, text: 74 },
		{ tone: 1, name: 28, text: 48 }
	];
	protected readonly mockChannels = [38, 52, 30, 44];
	/** The direct-message sketch: a row with no name is a follow-up from the same person (no avatar, no name). */
	protected readonly mockDirect = [
		{ tone: 2, name: 26, lines: [80, 52] },
		{ tone: 1, name: 20, lines: [66] },
		{ tone: 0, name: 0, lines: [44] },
		{ tone: 2, name: 26, lines: [72] }
	];
	/** The message "I" send in the channel sketch, and the teammate's reply in the direct-message one. */
	protected readonly mockSent = { tone: 1, name: 22, text: 58 };
	protected readonly mockReply = { tone: 2, name: 26, lines: [62, 38] };

	/** The welcome sketches' loop (see {@link WELCOME_LOOP_SECONDS}); it stays on its first frame for reduced motion. */
	private readonly welcomeStep = signal(0);
	protected readonly channelCursor = computed(() => CHANNEL_SCRIPT[this.welcomeStep()]);
	protected readonly channelTyping = computed(() => this.welcomeStep() >= 2 && this.welcomeStep() < WELCOME_ACT_STEP);
	protected readonly channelSent = computed(() => this.welcomeStep() >= WELCOME_ACT_STEP && this.welcomeStep() < WELCOME_RESET_STEP);
	/** The teammate types while I type in the channel, and replies when my message goes out. */
	protected readonly directTyping = computed(() => this.welcomeStep() >= 2 && this.welcomeStep() < WELCOME_ACT_STEP);
	protected readonly directReplied = computed(() => this.welcomeStep() >= WELCOME_ACT_STEP && this.welcomeStep() < WELCOME_RESET_STEP);
	protected readonly browseCursor = computed(() => BROWSE_SCRIPT[this.welcomeStep()]);
	protected readonly browseJoined = computed(() => this.welcomeStep() >= WELCOME_ACT_STEP && this.welcomeStep() < WELCOME_RESET_STEP);

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
		this.playWelcome();
	}

	/**
	 * The welcome sketches' one-second clock. It advances only while the welcome screen is shown and the tab is
	 * visible, so an open conversation or a background tab costs nothing. The interval runs outside Angular's zone
	 * so it does not run change detection for the whole app; the signal write refreshes only this view. For reduced
	 * motion it does not start: the sketches stay on their first frame and the cursors are hidden by the styles.
	 */
	private playWelcome(): void {
		if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
		const timer = this.zone.runOutsideAngular(() =>
			setInterval(() => {
				if (this.state() !== 'ready' || this.view() !== 'home' || !isTabVisible()) return;
				this.welcomeStep.update((step) => (step + 1) % WELCOME_LOOP_SECONDS);
			}, 1000)
		);
		this.destroyRef.onDestroy(() => clearInterval(timer));
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
