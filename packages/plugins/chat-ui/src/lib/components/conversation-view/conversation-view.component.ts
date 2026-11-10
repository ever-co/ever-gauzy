import { formatDate } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	effect,
	ElementRef,
	inject,
	input,
	LOCALE_ID,
	output,
	signal,
	untracked,
	viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EMPTY, Subscription, timer } from 'rxjs';
import { catchError, filter, switchMap } from 'rxjs/operators';
import {
	ChatConversationKindEnum,
	ChatMemberRoleEnum,
	ChatNotifyLevelEnum,
	ChatVisibilityEnum,
	IChatConversationWithState,
	IChatMemberState,
	IChatMessageWithRelations
} from '@gauzy/contracts';
import { ToastrService } from '@gauzy/ui-core/core';
import { CHAT_LINK, CHAT_MESSAGES_POLL_MS } from '../../chat-ui.constants';
import { apiErrorMessage, continuesGroup, conversationPerson, conversationTitle, isSameDay, memberEmployeeIds, mergeMessages, newNonce } from '../../chat-ui.helpers';
import { ChatPeople } from '../../services/chat-people.service';
import { ChatEvents, ChatMessagePatch, ChatUiService, memberStateFromEvents } from '../../services/chat-ui.service';
import { clearDraft, ComposerSubmission, MessageComposerComponent } from '../message-composer/message-composer.component';
import { MessageAction, MessageItemComponent } from '../message-item/message-item.component';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';

/** How close to the bottom (px) counts as "reading the latest", for auto-scroll and read-on-view. */
const NEAR_BOTTOM_PX = 80;

/** One row of the message list: the message, the day divider above it, and whether the "New" line goes above it. */
interface MessageRow {
	message: IChatMessageWithRelations;
	day: string | null;
	isNew: boolean;
	continued: boolean;
}

/** The header menus (one open at a time). */
type HeaderMenu = 'notify' | 'more' | null;

/**
 * Where the "New" line goes when a conversation opens: before the first message after my read position, or,
 * when that position is not on the loaded page, before the last `unreadCount` messages. Null when nothing is unread.
 */
export function unreadMarkerId(messages: readonly IChatMessageWithRelations[], state: IChatMemberState | null): string | null {
	const unread = state?.unreadCount ?? 0;
	if (!state || unread <= 0 || messages.length === 0) return null;
	const lastRead = state.lastReadMessageId ? String(state.lastReadMessageId) : null;
	if (lastRead) {
		const at = messages.findIndex((message) => String(message.id) === lastRead);
		if (at >= 0) return messages[at + 1] ? String(messages[at + 1].id) : null;
	}
	const from = Math.max(0, messages.length - unread);
	return String(messages[from].id);
}

/**
 * One conversation, laid out as chat apps do: the header (the channel's icon or the person's avatar, the title,
 * the topic, the member count, favourite, notifications and the pins; leave / archive in a "more" menu), the
 * messages (newest page first, older on scroll, newer by polling) with day dividers, a "New" line above the first
 * unread message and a welcome block at the very beginning, and the composer, or a join bar for a channel I am
 * not in. Reading the latest loaded message marks the conversation read up to it (never past what is shown);
 * "mark unread from here" is explicit.
 *
 * Every request captures the conversation it was made for and drops its answer when another one is open by
 * then; the poll stops the moment the conversation changes. A send also captures the visit it was made in, so a
 * send that lands after the person left and came back merges its message but never clears what they are typing now.
 */
@Component({
	selector: 'ngx-chat-conversation-view',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'(document:click)': 'onDocumentClick()',
		'(document:keydown.escape)': 'onEscape()'
	},
	imports: [RouterLink, NbIconModule, NbSpinnerModule, NbTooltipModule, TranslatePipe, MessageComposerComponent, MessageItemComponent, PersonAvatarComponent],
	template: `
		<section class="view" data-test="conversation-view">
			<header class="header">
				<a class="back icon-button" [routerLink]="chatLink" [attr.aria-label]="'CHAT.VIEW.BACK' | translate"><nb-icon icon="arrow-back-outline"></nb-icon></a>
				<div class="heading">
					<div class="title-line">
						<span class="title-icon">
							@if (isChannel()) {
								<nb-icon [icon]="isPrivate() ? 'lock-outline' : 'hash-outline'"></nb-icon>
							} @else if (person(); as person) {
								<ngx-chat-person-avatar [person]="person" size="small"></ngx-chat-person-avatar>
							} @else {
								<nb-icon icon="people-outline"></nb-icon>
							}
						</span>
						<h5 class="title">{{ plainTitle() }}</h5>
						<!-- A favourite is a member's own setting: none to set for a conversation I am not in. -->
						@if (isMember()) {
							<!-- A toggle: its name stays, aria-pressed tells its state (the tooltip names the action). -->
							<button
								type="button"
								class="star"
								data-test="favorite"
								[class.on]="state()?.isFavorite"
								[nbTooltip]="(state()?.isFavorite ? 'CHAT.VIEW.UNFAVORITE' : 'CHAT.VIEW.FAVORITE') | translate"
								[attr.aria-label]="'CHAT.VIEW.FAVORITE' | translate"
								[attr.aria-pressed]="!!state()?.isFavorite"
								(click)="toggleFavorite()"
							>
								<nb-icon [icon]="state()?.isFavorite ? 'star' : 'star-outline'"></nb-icon>
							</button>
						}
					</div>
					@if (conversation().topic) {
						<span class="topic" [attr.title]="conversation().topic">{{ conversation().topic }}</span>
					}
				</div>
				<div class="actions">
					<span class="members" [nbTooltip]="'CHAT.VIEW.MEMBERS' | translate">
						<nb-icon icon="people-outline"></nb-icon>
						<span>{{ conversation().memberCount }}</span>
					</span>
					@if (isMember()) {
						<div class="menu-anchor" (click)="$event.stopPropagation()">
							<button
								type="button"
								class="icon-button"
								data-test="notify-level"
								[class.on]="menu() === 'notify'"
								[nbTooltip]="'CHAT.VIEW.NOTIFY' | translate"
								[attr.aria-label]="'CHAT.VIEW.NOTIFY' | translate"
								[attr.aria-expanded]="menu() === 'notify'"
								(click)="toggleMenu('notify')"
							>
								<nb-icon [icon]="notifyIcon()"></nb-icon>
							</button>
							@if (menu() === 'notify') {
								<div class="menu" role="menu">
									<h6 class="menu-title">{{ 'CHAT.VIEW.NOTIFY' | translate }}</h6>
									@for (level of notifyLevels; track level.value) {
										<button type="button" class="menu-item" role="menuitemradio" [attr.aria-checked]="currentNotifyLevel() === level.value" (click)="setNotifyLevel(level.value); menu.set(null)">
											<nb-icon [icon]="level.icon"></nb-icon>
											<span>{{ level.labelKey | translate }}</span>
											@if (currentNotifyLevel() === level.value) {
												<nb-icon class="check" icon="checkmark-outline"></nb-icon>
											}
										</button>
									}
								</div>
							}
						</div>
					}
					<button
						type="button"
						class="icon-button"
						data-test="pins"
						[class.on]="pinsOpen()"
						[nbTooltip]="'CHAT.VIEW.PINNED' | translate"
						[attr.aria-label]="'CHAT.VIEW.PINNED' | translate"
						[attr.aria-expanded]="pinsOpen()"
						(click)="$event.stopPropagation(); togglePins()"
					>
						<nb-icon icon="pin-outline"></nb-icon>
					</button>
					@if (canLeave() || (canManage() && isChannel())) {
						<div class="menu-anchor" (click)="$event.stopPropagation()">
							<button
								type="button"
								class="icon-button"
								data-test="more"
								[class.on]="menu() === 'more'"
								[nbTooltip]="'CHAT.VIEW.MORE' | translate"
								[attr.aria-label]="'CHAT.VIEW.MORE' | translate"
								[attr.aria-expanded]="menu() === 'more'"
								(click)="toggleMenu('more')"
							>
								<nb-icon icon="more-vertical-outline"></nb-icon>
							</button>
							@if (menu() === 'more') {
								<div class="menu" role="menu">
									@if (canManage() && isChannel()) {
										<button type="button" class="menu-item" role="menuitem" data-test="archive" (click)="menu.set(null); toggleArchived()">
											<nb-icon icon="archive-outline"></nb-icon>
											<span>{{ (conversation().archivedAt ? 'CHAT.VIEW.UNARCHIVE' : 'CHAT.VIEW.ARCHIVE') | translate }}</span>
										</button>
									}
									@if (canLeave()) {
										<button type="button" class="menu-item danger" role="menuitem" data-test="leave" (click)="menu.set(null); leave()">
											<nb-icon icon="log-out-outline"></nb-icon>
											<span>{{ 'CHAT.VIEW.LEAVE' | translate }}</span>
										</button>
									}
								</div>
							}
						</div>
					}
				</div>
			</header>

			@if (pinsOpen()) {
				<aside class="pins" data-test="pins-panel" (click)="$event.stopPropagation()">
					<header class="pins-header">
						<nb-icon icon="pin-outline"></nb-icon>
						<h6>{{ 'CHAT.VIEW.PINNED' | translate }}</h6>
						<button type="button" class="icon-button" [attr.aria-label]="'CHAT.VIEW.CLOSE' | translate" (click)="pinsOpen.set(false)"><nb-icon icon="close-outline"></nb-icon></button>
					</header>
					<div class="pins-body">
						@for (pin of pins(); track pin.id) {
							<ngx-chat-message-item
								[message]="pin"
								[people]="people()"
								[conversationNames]="conversationNames()"
								[meEmployeeId]="meEmployeeId()"
								[meUserId]="meUserId()"
								[readOnly]="true"
								[showThreadSummary]="false"
							></ngx-chat-message-item>
						} @empty {
							<p class="empty">{{ 'CHAT.VIEW.NO_PINS' | translate }}</p>
						}
					</div>
				</aside>
			}

			<div #scroller class="messages" data-test="messages" (scroll)="onScroll()">
				@if (hasBefore()) {
					<button type="button" class="pill older" data-test="load-older" [disabled]="loadingOlder()" (click)="loadOlder()">
						{{ 'CHAT.VIEW.LOAD_OLDER' | translate }}
					</button>
				} @else if (!loading() && !error()) {
					<div class="intro" data-test="conversation-intro">
						<div class="intro-icon">
							@if (isChannel()) {
								<nb-icon [icon]="isPrivate() ? 'lock-outline' : 'hash-outline'"></nb-icon>
							} @else if (person(); as person) {
								<ngx-chat-person-avatar [person]="person" size="large"></ngx-chat-person-avatar>
							} @else {
								<nb-icon icon="people-outline"></nb-icon>
							}
						</div>
						@if (isChannel()) {
							<h3>{{ 'CHAT.VIEW.WELCOME_CHANNEL' | translate: { name: title() } }}</h3>
							<p>{{ 'CHAT.VIEW.WELCOME_CHANNEL_TEXT' | translate: { name: title() } }}</p>
						} @else {
							<h3>{{ title() }}</h3>
							<p>{{ 'CHAT.VIEW.WELCOME_DIRECT_TEXT' | translate: { name: title() } }}</p>
						}
						@if (conversation().topic) {
							<p class="intro-topic">{{ conversation().topic }}</p>
						}
						@if (messages().length === 0) {
							<p class="intro-empty">{{ 'CHAT.VIEW.EMPTY' | translate }}</p>
						}
					</div>
				}
				@if (loading()) {
					<div class="loading" [nbSpinner]="true"></div>
				} @else if (error()) {
					<p class="empty">{{ 'CHAT.ERROR' | translate }} <button type="button" class="link-button" (click)="reload()">{{ 'CHAT.RETRY' | translate }}</button></p>
				}
				@for (row of rows(); track row.message.id) {
					@if (row.day) {
						<div class="day-divider" role="separator"><span>{{ row.day }}</span></div>
					}
					@if (row.isNew) {
						<div class="new-divider" role="separator" data-test="new-divider"><span>{{ 'CHAT.VIEW.NEW' | translate }}</span></div>
					}
					<ngx-chat-message-item
						[message]="row.message"
						[people]="people()"
						[conversationNames]="conversationNames()"
						[meEmployeeId]="meEmployeeId()"
						[meUserId]="meUserId()"
						[continued]="row.continued"
						[canManage]="canManage()"
						[readOnly]="readOnly()"
						[highlighted]="row.message.id === highlightId()"
						(action)="onAction(row.message, $event)"
					></ngx-chat-message-item>
				}
				@if (hasAfter()) {
					<button type="button" class="pill older" data-test="jump-to-latest" (click)="jumpToLatest()">
						{{ 'CHAT.VIEW.JUMP_TO_LATEST' | translate }}
					</button>
				}
				<div class="bottom-space"></div>
			</div>

			@if (newBelow()) {
				<button type="button" class="new-below" data-test="new-below" (click)="scrollToBottom(true)">
					<span>{{ 'CHAT.VIEW.NEW_MESSAGES' | translate }}</span>
					<nb-icon icon="arrow-downward-outline"></nb-icon>
				</button>
			}

			<footer class="footer">
				@if (conversation().archivedAt) {
					<p class="bar notice"><nb-icon icon="archive-outline"></nb-icon> {{ 'CHAT.VIEW.ARCHIVED' | translate }}</p>
				} @else if (isMember()) {
					<ngx-chat-message-composer
						[people]="people()"
						[conversationNames]="conversationNames()"
						[placeholder]="'CHAT.COMPOSER.PLACEHOLDER' | translate: { name: title() }"
						[disabled]="sending()"
						[everyone]="isChannel()"
						[memberIds]="memberIds()"
						[meEmployeeId]="meEmployeeId()"
						[editing]="editing() !== null"
						[initialBody]="editing()?.body ?? null"
						[draftKey]="draftKey()"
						[resetToken]="resetToken()"
						(submitted)="onSubmit($event)"
						(editCancelled)="editing.set(null)"
					></ngx-chat-message-composer>
				} @else {
					<div class="bar join-bar">
						<span>{{ 'CHAT.VIEW.NOT_MEMBER' | translate: { name: title() } }}</span>
						<button type="button" class="join" data-test="join" (click)="join()">{{ 'CHAT.VIEW.JOIN' | translate }}</button>
					</div>
				}
			</footer>
		</section>
	`,
	styles: [
		`
			:host {
				display: block;
				height: 100%;
				min-height: 0;
			}
			.view {
				position: relative;
				display: flex;
				flex-direction: column;
				height: 100%;
				min-height: 0;
				background: var(--chat-bg, transparent);
			}
			.header {
				display: flex;
				align-items: center;
				gap: 0.75rem;
				min-height: var(--chat-header-height, 3.5rem);
				padding: 0.375rem 0.75rem 0.375rem 1.25rem;
				border-bottom: 1px solid var(--chat-border, rgba(127, 127, 127, 0.2));
				flex: 0 0 auto;
			}
			.back {
				display: none !important;
				margin-left: -0.5rem;
			}
			.heading {
				display: flex;
				flex-direction: column;
				justify-content: center;
				flex: 1 1 auto;
				min-width: 0;
			}
			.title-line {
				display: flex;
				align-items: center;
				gap: 0.375rem;
				min-width: 0;
			}
			.title-icon {
				display: inline-flex;
				align-items: center;
				color: var(--chat-text, inherit);
			}
			.title-icon nb-icon {
				font-size: 1rem;
			}
			.title {
				margin: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				color: var(--chat-text, inherit);
				font-size: 0.9375rem;
				font-weight: 800;
				line-height: 1.5rem;
			}
			.star {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1.5rem;
				height: 1.5rem;
				border: 0;
				border-radius: 0.375rem;
				background: transparent;
				color: var(--chat-muted, inherit);
				cursor: pointer;
			}
			.star nb-icon {
				font-size: 1rem;
			}
			.star:hover,
			.star:focus-visible {
				background: var(--chat-hover, rgba(127, 127, 127, 0.12));
			}
			.star.on {
				color: #f2c744;
			}
			.topic {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				color: var(--chat-muted, inherit);
				font-size: 0.75rem;
			}
			.actions {
				display: flex;
				align-items: center;
				gap: 0.25rem;
				flex: 0 0 auto;
			}
			.members {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				height: 1.75rem;
				margin-right: 0.25rem;
				padding: 0 0.5rem;
				border: 1px solid var(--chat-border, rgba(127, 127, 127, 0.25));
				border-radius: 0.5rem;
				color: var(--chat-muted, inherit);
				font-size: 0.75rem;
				font-weight: 700;
			}
			.members nb-icon {
				font-size: 1rem;
			}
			.icon-button {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 2rem;
				height: 2rem;
				border: 0;
				border-radius: 0.5rem;
				background: transparent;
				color: var(--chat-muted, inherit);
				cursor: pointer;
				text-decoration: none;
				transition: background-color 0.1s ease, color 0.1s ease;
			}
			.icon-button nb-icon {
				font-size: 1.125rem;
			}
			.icon-button:hover,
			.icon-button:focus-visible,
			.icon-button.on {
				background: var(--chat-hover, rgba(127, 127, 127, 0.12));
				color: var(--chat-text, inherit);
			}
			.menu-anchor {
				position: relative;
			}
			.menu {
				position: absolute;
				top: calc(100% + 0.375rem);
				right: 0;
				z-index: 30;
				display: flex;
				flex-direction: column;
				min-width: 13rem;
				padding: 0.375rem;
				border: 1px solid var(--chat-border, rgba(127, 127, 127, 0.25));
				border-radius: 0.5rem;
				background: var(--chat-raised, #fff);
				box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.18);
			}
			.menu-title {
				margin: 0.25rem 0.5rem 0.375rem;
				color: var(--chat-muted, inherit);
				font-size: 0.625rem;
				font-weight: 700;
				text-transform: uppercase;
				letter-spacing: 0.04em;
			}
			.menu-item {
				display: flex;
				align-items: center;
				gap: 0.625rem;
				padding: 0.4375rem 0.625rem;
				border: 0;
				border-radius: 0.375rem;
				background: transparent;
				color: var(--chat-text, inherit);
				font: inherit;
				font-size: 0.8125rem;
				text-align: left;
				cursor: pointer;
			}
			.menu-item nb-icon {
				font-size: 1rem;
			}
			.menu-item span {
				flex: 1 1 auto;
			}
			.menu-item:hover,
			.menu-item:focus-visible {
				background: var(--chat-accent, #3366ff);
				color: var(--chat-on-accent, #fff);
			}
			.menu-item.danger {
				color: var(--chat-danger, #e4493f);
			}
			.menu-item.danger:hover,
			.menu-item.danger:focus-visible {
				background: var(--chat-danger, #e4493f);
				color: #fff;
			}
			.pins {
				position: absolute;
				top: calc(var(--chat-header-height, 3.5rem) + 0.25rem);
				right: 0.75rem;
				z-index: 25;
				display: flex;
				flex-direction: column;
				width: min(28rem, calc(100% - 1.5rem));
				max-height: 60%;
				border: 1px solid var(--chat-border, rgba(127, 127, 127, 0.25));
				border-radius: 0.5rem;
				background: var(--chat-raised, #fff);
				box-shadow: 0 0.75rem 2rem rgba(0, 0, 0, 0.2);
				overflow: hidden;
			}
			.pins-header {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				padding: 0.375rem 0.375rem 0.375rem 1rem;
				border-bottom: 1px solid var(--chat-border, rgba(127, 127, 127, 0.2));
			}
			.pins-header h6 {
				flex: 1 1 auto;
				margin: 0;
				font-size: 0.875rem;
				font-weight: 800;
			}
			.pins-body {
				overflow-y: auto;
				padding-bottom: 0.5rem;
			}
			.messages {
				position: relative;
				flex: 1 1 auto;
				min-height: 0;
				overflow-y: auto;
				overflow-x: hidden;
				padding-top: 0.5rem;
				scrollbar-width: thin;
			}
			.bottom-space {
				height: 0.75rem;
			}
			.intro {
				padding: 2rem 1.25rem 1rem;
			}
			.intro-icon {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 3.5rem;
				height: 3.5rem;
				margin-bottom: 0.75rem;
				border-radius: 0.875rem;
				background: var(--chat-accent-soft, rgba(51, 102, 255, 0.12));
				color: var(--chat-accent, #3366ff);
			}
			.intro-icon nb-icon {
				font-size: 1.75rem;
			}
			.intro h3 {
				margin: 0 0 0.25rem;
				color: var(--chat-text, inherit);
				font-size: 1.25rem;
				font-weight: 800;
				letter-spacing: -0.01em;
			}
			.intro p {
				margin: 0;
				color: var(--chat-muted, inherit);
				font-size: 0.8125rem;
			}
			.intro .intro-topic {
				margin-top: 0.5rem;
				color: var(--chat-text, inherit);
			}
			.intro .intro-empty {
				margin-top: 1rem;
			}
			.loading {
				min-height: 6rem;
			}
			.empty {
				margin: 1rem 1.25rem;
				color: var(--chat-muted, inherit);
				font-size: 0.8125rem;
			}
			.link-button {
				border: 0;
				background: transparent;
				color: var(--chat-link, #1d9bd1);
				font: inherit;
				cursor: pointer;
			}
			.link-button:hover {
				text-decoration: underline;
			}
			.pill {
				display: block;
				margin: 0.5rem auto;
				padding: 0.25rem 0.875rem;
				border: 1px solid var(--chat-border, rgba(127, 127, 127, 0.25));
				border-radius: 999px;
				background: var(--chat-raised, transparent);
				color: var(--chat-text, inherit);
				font: inherit;
				font-size: 0.75rem;
				font-weight: 600;
				cursor: pointer;
			}
			.pill:hover:not(:disabled) {
				background: var(--chat-hover, rgba(127, 127, 127, 0.12));
			}
			.pill:disabled {
				opacity: 0.6;
				cursor: default;
			}
			/* The day a group of messages was sent: a rule with a pill that sticks to the top while its day scrolls by. */
			.day-divider {
				position: sticky;
				top: 0.25rem;
				z-index: 2;
				display: flex;
				align-items: center;
				justify-content: center;
				margin: 1rem 0 0.25rem;
				pointer-events: none;
			}
			.day-divider::before {
				content: '';
				position: absolute;
				left: 0;
				right: 0;
				top: 50%;
				border-top: 1px solid var(--chat-border, rgba(127, 127, 127, 0.2));
				z-index: -1;
			}
			.day-divider span {
				padding: 0.1875rem 0.875rem;
				border: 1px solid var(--chat-border, rgba(127, 127, 127, 0.25));
				border-radius: 999px;
				background: var(--chat-bg, #fff);
				color: var(--chat-text, inherit);
				font-size: 0.6875rem;
				font-weight: 700;
				box-shadow: 0 0.0625rem 0.25rem rgba(0, 0, 0, 0.06);
			}
			/* The first unread message: a red rule labelled "New". */
			.new-divider {
				position: relative;
				display: flex;
				justify-content: flex-end;
				margin: 0.75rem 1.25rem 0;
				border-top: 1px solid var(--chat-danger, #e4493f);
			}
			.new-divider span {
				position: absolute;
				top: -0.5625rem;
				right: 0;
				padding: 0 0.375rem;
				border-radius: 0.25rem;
				background: var(--chat-danger, #e4493f);
				color: #fff;
				font-size: 0.625rem;
				font-weight: 800;
				line-height: 1.125rem;
				text-transform: uppercase;
				letter-spacing: 0.04em;
			}
			.new-below {
				position: absolute;
				left: 50%;
				bottom: 8.5rem;
				z-index: 5;
				display: inline-flex;
				align-items: center;
				gap: 0.375rem;
				padding: 0.375rem 0.875rem;
				border: 0;
				border-radius: 999px;
				background: var(--chat-accent, #3366ff);
				color: var(--chat-on-accent, #fff);
				font: inherit;
				font-size: 0.75rem;
				font-weight: 700;
				box-shadow: 0 0.375rem 1rem rgba(0, 0, 0, 0.2);
				transform: translateX(-50%);
				cursor: pointer;
			}
			.footer {
				padding: 0 1.25rem 0.5rem;
				flex: 0 0 auto;
			}
			.bar {
				display: flex;
				align-items: center;
				gap: 0.75rem;
				margin: 0 0 0.75rem;
				padding: 0.875rem 1rem;
				border: 1px solid var(--chat-border, rgba(127, 127, 127, 0.25));
				border-radius: 0.5rem;
				background: var(--chat-sidebar-bg, rgba(127, 127, 127, 0.05));
				color: var(--chat-muted, inherit);
				font-size: 0.8125rem;
			}
			.join-bar {
				justify-content: space-between;
				color: var(--chat-text, inherit);
			}
			.join {
				flex: 0 0 auto;
				height: 1.875rem;
				padding: 0 1rem;
				border: 0;
				border-radius: 0.375rem;
				background: var(--chat-send, #007a5a);
				color: #fff;
				font: inherit;
				font-weight: 700;
				cursor: pointer;
			}
			.join:hover {
				filter: brightness(1.08);
			}
			@media (max-width: 960px) {
				.back {
					display: inline-flex !important;
				}
			}
			@media (max-width: 600px) {
				.header {
					padding-left: 0.75rem;
				}
				.members,
				.topic {
					display: none;
				}
				.footer {
					padding: 0 0.75rem 0.5rem;
				}
				.intro {
					padding-left: 0.75rem;
					padding-right: 0.75rem;
				}
			}
		`
	]
})
export class ConversationViewComponent {
	private readonly api = inject(ChatUiService);
	private readonly toastr = inject(ToastrService);
	private readonly translate = inject(TranslateService);
	private readonly destroyRef = inject(DestroyRef);
	private readonly locale = inject(LOCALE_ID);

	readonly conversation = input.required<IChatConversationWithState>();
	readonly people = input.required<ChatPeople>();
	readonly conversationNames = input<ReadonlyMap<string, string>>(new Map());
	readonly meEmployeeId = input<string | null>(null);
	readonly meUserId = input<string | null>(null);
	/** `CHAT_MANAGE`: acts as a manager everywhere. */
	readonly isAdmin = input(false);
	readonly untitled = input('Conversation');
	/** A message to scroll to and highlight (a deep link): the page around it is shown, nothing is marked read. */
	readonly highlightId = input<string | null>(null);
	/** A message changed elsewhere on the page (a thread's root: its thread fields, or the whole message): the view's copy follows. */
	readonly patch = input<ChatMessagePatch | null>(null);

	readonly openThread = output<IChatMessageWithRelations>();
	readonly stateChanged = output<IChatMemberState>();
	readonly conversationChanged = output<IChatConversationWithState>();
	readonly left = output<void>();

	private readonly scroller = viewChild<ElementRef<HTMLDivElement>>('scroller');

	protected readonly messages = signal<IChatMessageWithRelations[]>([]);
	protected readonly hasBefore = signal(false);
	/** Newer messages exist past the loaded page (a view around an old message): nothing is marked read then. */
	protected readonly hasAfter = signal(false);
	protected readonly loading = signal(false);
	protected readonly loadingOlder = signal(false);
	protected readonly error = signal(false);
	protected readonly sending = signal(false);
	protected readonly editing = signal<IChatMessageWithRelations | null>(null);
	protected readonly resetToken = signal(0);
	protected readonly newBelow = signal(false);
	protected readonly pinsOpen = signal(false);
	protected readonly pins = signal<IChatMessageWithRelations[]>([]);
	/** The caller's state, kept here so a read / favourite change shows at once. */
	protected readonly state = signal<IChatMemberState | null>(null);

	protected readonly title = computed(() => conversationTitle(this.conversation(), this.people().byEmployee, this.meEmployeeId(), this.untitled()));
	protected readonly isMember = computed(() => this.state() !== null);
	protected readonly canLeave = computed(() => this.isMember() && !this.conversation().isDefault && this.conversation().kind !== ChatConversationKindEnum.DIRECT);
	protected readonly canManage = computed(() => this.isAdmin() || this.state()?.role === ChatMemberRoleEnum.MANAGER);
	protected readonly readOnly = computed(() => !!this.conversation().archivedAt || !this.isMember());
	protected readonly draftKey = computed(() => `conversation:${this.conversation().id}`);

	protected readonly chatLink = CHAT_LINK;
	protected readonly isChannel = computed(() => this.conversation().kind === ChatConversationKindEnum.CHANNEL);
	/** Who is in the conversation, for the `@` list (members first, the others marked). */
	protected readonly memberIds = computed(() => memberEmployeeIds(this.conversation()));
	protected readonly isPrivate = computed(() => this.conversation().visibility === ChatVisibilityEnum.PRIVATE);
	/** The title without the channel's `#` (the header draws its own icon). */
	protected readonly plainTitle = computed(() => (this.isChannel() ? this.title().replace(/^#/, '') : this.title()));
	/** The person a direct conversation is with, for the header and the intro. */
	protected readonly person = computed(() => conversationPerson(this.conversation(), this.people().byEmployee, this.meEmployeeId()));

	/** The open header menu. */
	protected readonly menu = signal<HeaderMenu>(null);
	protected readonly notifyLevels: readonly { value: ChatNotifyLevelEnum; icon: string; labelKey: string }[] = [
		{ value: ChatNotifyLevelEnum.ALL, icon: 'bell-outline', labelKey: 'CHAT.VIEW.NOTIFY_ALL' },
		{ value: ChatNotifyLevelEnum.MENTIONS, icon: 'message-circle-outline', labelKey: 'CHAT.VIEW.NOTIFY_MENTIONS' },
		{ value: ChatNotifyLevelEnum.MUTED, icon: 'bell-off-outline', labelKey: 'CHAT.VIEW.NOTIFY_MUTED' }
	];
	protected readonly currentNotifyLevel = computed(() => this.state()?.notifyLevel ?? ChatNotifyLevelEnum.ALL);
	protected readonly notifyIcon = computed(() => (this.currentNotifyLevel() === ChatNotifyLevelEnum.MUTED ? 'bell-off-outline' : 'bell-outline'));

	/** The message the "New" line goes above, fixed when the conversation opens (reading it does not move it). */
	protected readonly unreadMarker = signal<string | null>(null);

	/** The messages with their day dividers, the "New" line, and whether each continues the previous author's group. */
	protected readonly rows = computed<MessageRow[]>(() => {
		const messages = this.messages();
		const marker = this.unreadMarker();
		const today = new Date();
		const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
		return messages.map((message, index) => {
			const previous = messages[index - 1];
			const at = new Date(message.createdAt as Date);
			const newDay = !previous || !isSameDay(previous.createdAt as Date, at);
			const isNew = !!marker && String(message.id) === marker;
			return {
				message,
				day: newDay ? this.dayLabel(at, today, yesterday) : null,
				isNew,
				continued: !newDay && !isNew && continuesGroup(previous, message)
			};
		});
	});

	private poll: Subscription | null = null;
	private loadedId: string | null = null;
	/** Counts the visits of this view (every conversation switch): a send belongs to the visit it was made in. */
	private visit = 0;
	/** The last message a read was asked up to, so the same read is not sent twice. */
	private lastMarkedId: string | null = null;

	constructor() {
		effect(() => {
			const conversation = this.conversation();
			untracked(() => {
				this.state.set(conversation.state ?? null);
				if (this.loadedId !== String(conversation.id)) {
					this.loadedId = String(conversation.id);
					this.visit += 1;
					this.stopPolling();
					this.editing.set(null);
					this.pinsOpen.set(false);
					this.menu.set(null);
					this.newBelow.set(false);
					this.loadingOlder.set(false);
					this.sending.set(false);
					this.lastMarkedId = null;
					this.reload();
				}
			});
		});
		effect(() => {
			const message = this.patch();
			if (message) untracked(() => this.replace(message));
		});
		this.destroyRef.onDestroy(() => this.stopPolling());
	}

	/** Whether the open conversation is still the one a request was made for. */
	private isCurrent(id: string): boolean {
		return String(this.conversation().id) === id;
	}

	// ---------------------------------------------------------------- loading

	protected reload(): void {
		const id = String(this.conversation().id);
		this.stopPolling();
		this.loading.set(true);
		this.error.set(false);
		this.messages.set([]);
		this.hasAfter.set(false);
		this.unreadMarker.set(null);
		const stateWhenOpened = this.state();
		const highlight = this.highlightId();
		this.api
			.messages(id, highlight ? { around: highlight } : {})
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (page) => {
					if (!this.isCurrent(id)) return;
					this.messages.set(mergeMessages([], page.messages));
					this.unreadMarker.set(highlight ? null : unreadMarkerId(this.messages(), stateWhenOpened));
					this.hasBefore.set(page.hasBefore);
					this.hasAfter.set(page.hasAfter);
					this.loading.set(false);
					queueMicrotask(() => (highlight ? this.scrollTo(highlight) : this.scrollToBottom(false)));
					this.markReadIfVisible();
					this.startPolling();
				},
				error: () => {
					if (!this.isCurrent(id)) return;
					this.loading.set(false);
					this.error.set(true);
				}
			});
	}

	/** Leaves a view around an old message for the newest page. */
	protected jumpToLatest(): void {
		const id = String(this.conversation().id);
		this.api
			.messages(id, {})
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (page) => {
					if (!this.isCurrent(id)) return;
					this.messages.set(mergeMessages([], page.messages));
					this.hasBefore.set(page.hasBefore);
					this.hasAfter.set(false);
					queueMicrotask(() => this.scrollToBottom(false));
				},
				error: () => undefined
			});
	}

	protected loadOlder(): void {
		const first = this.messages()[0];
		if (!first || this.loadingOlder()) return;
		const id = String(this.conversation().id);
		const element = this.scroller()?.nativeElement;
		const heightBefore = element?.scrollHeight ?? 0;
		this.loadingOlder.set(true);
		this.api
			.messages(id, { before: first.id })
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (page) => {
					if (!this.isCurrent(id)) return;
					this.messages.set(mergeMessages(this.messages(), page.messages));
					this.hasBefore.set(page.hasBefore);
					this.loadingOlder.set(false);
					queueMicrotask(() => {
						if (element) element.scrollTop += element.scrollHeight - heightBefore;
					});
				},
				error: () => {
					if (this.isCurrent(id)) this.loadingOlder.set(false);
				}
			});
	}

	private startPolling(): void {
		this.stopPolling();
		const id = String(this.conversation().id);
		this.poll = timer(CHAT_MESSAGES_POLL_MS, CHAT_MESSAGES_POLL_MS)
			.pipe(
				filter(() => typeof document === 'undefined' || !document.hidden),
				// A view around an old message is not followed: the newest page is a jump away.
				filter(() => !this.hasAfter()),
				switchMap(() => {
					const last = this.messages()[this.messages().length - 1];
					return this.api.messages(id, last ? { after: last.id } : {}).pipe(catchError(() => EMPTY));
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((page) => {
				if (!this.isCurrent(id) || page.messages.length === 0) return;
				const wasNearBottom = this.isNearBottom();
				this.messages.set(mergeMessages(this.messages(), page.messages));
				if (wasNearBottom) {
					queueMicrotask(() => this.scrollToBottom(false));
					this.markReadIfVisible();
				} else {
					this.newBelow.set(true);
				}
			});
	}

	private stopPolling(): void {
		this.poll?.unsubscribe();
		this.poll = null;
	}

	protected onScroll(): void {
		const element = this.scroller()?.nativeElement;
		if (!element) return;
		if (element.scrollTop < 40 && this.hasBefore() && !this.loadingOlder()) this.loadOlder();
		if (this.isNearBottom()) {
			if (this.newBelow()) this.newBelow.set(false);
			this.markReadIfVisible();
		}
	}

	private isNearBottom(): boolean {
		const element = this.scroller()?.nativeElement;
		if (!element) return true;
		return element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_PX;
	}

	protected scrollToBottom(smooth: boolean): void {
		const element = this.scroller()?.nativeElement;
		if (!element) return;
		element.scrollTo({ top: element.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
		this.newBelow.set(false);
		this.markReadIfVisible();
	}

	private scrollTo(messageId: string): void {
		const element = this.scroller()?.nativeElement;
		const target = element?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(messageId)}"]`);
		if (target) target.scrollIntoView({ block: 'center' });
		else this.scrollToBottom(false);
	}

	/** "Today", "Yesterday", or the date (with the year when it is not this year's). */
	private dayLabel(at: Date, today: Date, yesterday: Date): string {
		if (isSameDay(at, today)) return this.translate.instant('CHAT.VIEW.TODAY');
		if (isSameDay(at, yesterday)) return this.translate.instant('CHAT.VIEW.YESTERDAY');
		return formatDate(at, at.getFullYear() === today.getFullYear() ? 'EEEE, MMMM d' : 'EEEE, MMMM d, y', this.locale);
	}

	// ---------------------------------------------------------------- header menus

	protected toggleMenu(menu: Exclude<HeaderMenu, null>): void {
		this.pinsOpen.set(false);
		this.menu.set(this.menu() === menu ? null : menu);
	}

	/** A click elsewhere closes the open menu and the pins panel (their own clicks do not reach here). */
	protected onDocumentClick(): void {
		if (this.menu()) this.menu.set(null);
		if (this.pinsOpen()) this.pinsOpen.set(false);
	}

	protected onEscape(): void {
		this.menu.set(null);
		this.pinsOpen.set(false);
	}

	protected continues(index: number): boolean {
		const list = this.messages();
		return continuesGroup(list[index - 1], list[index]);
	}

	// ---------------------------------------------------------------- read state

	/**
	 * Marks the conversation read up to the last loaded message, when it is shown and the read position is behind
	 * it: never everything (a view around an old message holds newer ones), never the followed threads.
	 */
	private markReadIfVisible(): void {
		if (typeof document !== 'undefined' && document.hidden) return;
		if (this.hasAfter()) return;
		const state = this.state();
		const last = this.messages()[this.messages().length - 1];
		if (!state || !last) return;
		const lastId = String(last.id);
		const unread = (state.unreadCount ?? 0) > 0 || (state.mentionCount ?? 0) > 0;
		const behind = !!state.lastReadMessageId && String(state.lastReadMessageId) !== lastId;
		if ((!unread && !behind) || this.lastMarkedId === lastId) return;
		this.lastMarkedId = lastId;
		const id = String(this.conversation().id);
		this.api
			.read(id, last.id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (answer) => {
					if (!this.isCurrent(id)) return;
					// Everything loaded was read; the API's own count follows with the next list refresh.
					this.applyEvents(answer, { unreadCount: 0 });
					this.api.notifyChanged();
				},
				error: () => {
					if (this.isCurrent(id) && this.lastMarkedId === lastId) this.lastMarkedId = null;
				}
			});
	}

	/** My state from the events a write answered, with what the view knows better on top. */
	private applyEvents(answer: ChatEvents, known: Partial<IChatMemberState> = {}): void {
		const conversation = this.conversation();
		const next = memberStateFromEvents(answer.events, conversation, this.state());
		if (next) this.applyState({ ...next, ...known });
	}

	protected toggleFavorite(): void {
		const current = this.state();
		const id = String(this.conversation().id);
		this.api
			.setState(id, { isFavorite: !current?.isFavorite })
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (answer) => {
					if (this.isCurrent(id)) this.applyState(answer.state);
				},
				error: (error) => this.fail(error)
			});
	}

	protected setNotifyLevel(level: ChatNotifyLevelEnum | string): void {
		if (!level || level === this.state()?.notifyLevel) return;
		const id = String(this.conversation().id);
		this.api
			.setState(id, { notifyLevel: level as ChatNotifyLevelEnum })
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (answer) => {
					if (this.isCurrent(id)) this.applyState(answer.state);
				},
				error: (error) => this.fail(error)
			});
	}

	private applyState(state: IChatMemberState): void {
		this.state.set(state);
		this.stateChanged.emit(state);
	}

	// ---------------------------------------------------------------- membership and settings

	protected join(): void {
		const id = String(this.conversation().id);
		this.api
			.join(id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (answer) => {
					if (!this.isCurrent(id)) return;
					this.conversationChanged.emit(answer.conversation);
					this.api.notifyChanged();
				},
				error: (error) => this.fail(error)
			});
	}

	protected leave(): void {
		const id = String(this.conversation().id);
		this.api
			.leave(id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: () => {
					this.toastr.success('CHAT.VIEW.LEFT');
					this.api.notifyChanged();
					if (this.isCurrent(id)) this.left.emit();
				},
				error: (error) => this.fail(error)
			});
	}

	protected toggleArchived(): void {
		const id = String(this.conversation().id);
		this.api
			.setArchived(id, !this.conversation().archivedAt)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (answer) => {
					if (this.isCurrent(id)) this.conversationChanged.emit(answer.conversation);
				},
				error: (error) => this.fail(error)
			});
	}

	protected togglePins(): void {
		this.menu.set(null);
		const open = !this.pinsOpen();
		this.pinsOpen.set(open);
		if (open) this.loadPins();
	}

	private loadPins(): void {
		const id = String(this.conversation().id);
		this.api
			.pins(id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (pins) => {
					if (this.isCurrent(id)) this.pins.set(pins);
				},
				error: () => {
					if (this.isCurrent(id)) this.pins.set([]);
				}
			});
	}

	// ---------------------------------------------------------------- messages

	protected onSubmit(submission: ComposerSubmission): void {
		const id = String(this.conversation().id);
		const visit = this.visit;
		const editing = this.editing();
		this.sending.set(true);
		if (editing) {
			this.api
				.edit(editing.id, { body: submission.body, mentionEmployeeIds: submission.mentionEmployeeIds })
				.pipe(takeUntilDestroyed(this.destroyRef))
				.subscribe({
					next: (result) => {
						if (this.isCurrent(id)) this.replace(result.message);
						// Only the visit the edit was made in leaves edit mode and clears the box.
						if (visit !== this.visit) return;
						this.editing.set(null);
						this.sending.set(false);
						this.resetToken.update((value) => value + 1);
					},
					error: (error) => {
						if (visit !== this.visit) return;
						this.sending.set(false);
						this.fail(error, 'CHAT.COMPOSER.SEND_FAILED');
					}
				});
			return;
		}
		this.api
			.send(id, { body: submission.body, nonce: newNonce(), mentionEmployeeIds: submission.mentionEmployeeIds })
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (result) => {
					this.api.notifyChanged();
					if (this.isCurrent(id)) {
						this.messages.set(mergeMessages(this.messages(), [result.message]));
						// Writing means everything above was read: the "New" line goes, as in chat apps.
						this.unreadMarker.set(null);
						queueMicrotask(() => this.scrollToBottom(true));
					}
					if (visit !== this.visit) {
						// The message went out after the person moved on: the draft it came from is not to be sent again,
						// and whatever they type now is theirs to keep.
						if (!this.isCurrent(id)) clearDraft(`conversation:${id}`);
						return;
					}
					this.sending.set(false);
					this.resetToken.update((value) => value + 1);
				},
				error: (error) => {
					if (visit !== this.visit) return;
					this.sending.set(false);
					this.fail(error, 'CHAT.COMPOSER.SEND_FAILED');
				}
			});
	}

	protected onAction(message: IChatMessageWithRelations, action: MessageAction): void {
		const id = String(this.conversation().id);
		switch (action.kind) {
			case 'reply':
				this.openThread.emit(message);
				return;
			case 'edit':
				this.editing.set(message);
				return;
			case 'delete':
				if (typeof window !== 'undefined' && !window.confirm(this.translate.instant('CHAT.MESSAGE.DELETE_CONFIRM'))) return;
				this.api
					.remove(message.id)
					.pipe(takeUntilDestroyed(this.destroyRef))
					.subscribe({
						next: () => {
							if (this.isCurrent(id)) this.replace({ ...message, body: '', deletedAt: new Date() });
						},
						error: (error) => this.fail(error)
					});
				return;
			case 'pin':
				this.api
					.setPinned(message.id, action.pinned)
					.pipe(takeUntilDestroyed(this.destroyRef))
					.subscribe({
						next: (result) => {
							if (!this.isCurrent(id)) return;
							this.replace(result.message);
							if (this.pinsOpen()) this.loadPins();
						},
						error: (error) => this.fail(error)
					});
				return;
			case 'react':
				this.api
					.react(message.id, action.emoji, action.on)
					.pipe(takeUntilDestroyed(this.destroyRef))
					.subscribe({
						next: (result) => {
							if (this.isCurrent(id)) this.replace(result.message);
						},
						error: (error) => this.fail(error)
					});
				return;
			case 'unread':
				this.api
					.unreadFrom(message.id)
					.pipe(takeUntilDestroyed(this.destroyRef))
					.subscribe({
						next: (answer) => {
							this.api.notifyChanged();
							if (!this.isCurrent(id)) return;
							// At least the loaded messages from this one on are unread now; the list refresh brings the exact count.
							const from = new Date(message.createdAt as Date).getTime();
							const unreadCount = this.messages().filter((item) => new Date(item.createdAt as Date).getTime() >= from).length;
							this.lastMarkedId = null;
							this.applyEvents(answer, { unreadCount: Math.max(unreadCount, 1) });
						},
						error: (error) => this.fail(error)
					});
				return;
			case 'follow':
				this.api
					.setFollowing(message.id, action.following)
					.pipe(takeUntilDestroyed(this.destroyRef))
					.subscribe({
						next: () => {
							if (this.isCurrent(id)) this.replace({ ...message, following: action.following });
						},
						error: (error) => this.fail(error)
					});
				return;
			default:
				return;
		}
	}

	/** Puts the API's version of a message (or the fields of it that changed) in place of ours. */
	private replace(message: ChatMessagePatch): void {
		this.messages.set(this.messages().map((item) => (item.id === message.id ? { ...item, ...message } : item)));
	}

	private fail(error: unknown, fallbackKey = 'CHAT.DIALOG.FAILED'): void {
		this.toastr.danger(apiErrorMessage(error) ?? this.translate.instant(fallbackKey));
	}
}
