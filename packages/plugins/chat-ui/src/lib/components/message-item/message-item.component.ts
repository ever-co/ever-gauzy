// cspell:ignore referrerpolicy
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { ChatMessageKindEnum, IChatFile, IChatMessageWithRelations } from '@gauzy/contracts';
import { appBlocksOf, bodyRepeatsBlocks, safeIconUrl } from '../../chat-app-blocks';
import { ChatTaskSummary } from '../../chat-tasks';
import { CHAT_QUICK_REACTIONS, CHAT_TOOLBAR_REACTIONS } from '../../chat-ui.constants';
import { mentionsMe, renderBodyHtml } from '../../chat-ui.helpers';
import { ChatPeople } from '../../services/chat-people.service';
import { AppBlocksComponent } from '../app-blocks/app-blocks.component';
import { LinkCardsComponent } from '../link-cards/link-cards.component';
import { MessageAttachmentsComponent } from '../message-attachments/message-attachments.component';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';
import { TaskCardComponent } from '../task-card/task-card.component';

/** What a message's toolbar asks of the conversation. */
export type MessageAction =
	| { kind: 'reply' }
	| { kind: 'edit' }
	| { kind: 'delete' }
	| { kind: 'pin'; pinned: boolean }
	| { kind: 'react'; emoji: string; on: boolean }
	| { kind: 'unread' }
	| { kind: 'follow'; following: boolean }
	| { kind: 'createTask' }
	/** An app's reply to a click replaced the message (an incoming webhook's post). */
	| { kind: 'replaced'; message: IChatMessageWithRelations };

/**
 * One message, laid out as chat apps do: the avatar in a gutter (the time there instead when it continues the
 * previous author's group), the author and time, the body with mention chips, its web links as cards, its files
 * (pictures inline), the task cards (key, title and status where the reader may see the task), the reactions with
 * an add-reaction pill, the thread summary, and a floating toolbar shown on hover and on keyboard focus (a few
 * one-click reactions, the reaction picker, create a task, reply, pin, edit, delete, mark unread). A pinned message,
 * and one that mentions me, are tinted.
 */
@Component({
	selector: 'ngx-chat-message-item',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, NbIconModule, NbTooltipModule, TranslatePipe, AppBlocksComponent, LinkCardsComponent, MessageAttachmentsComponent, PersonAvatarComponent, TaskCardComponent],
	template: `
		<article
			class="message"
			[class.continued]="continued()"
			[class.system]="message().kind === 'system'"
			[class.mine]="isMine()"
			[class.pinned]="!!message().pinnedAt && !message().deletedAt"
			[class.mentioned]="mentioned()"
			[class.highlight]="highlighted()"
			[class.picking]="picking()"
			[attr.data-test]="'message-' + message().id"
			[attr.data-message-id]="message().id"
			(mouseleave)="picking.set(false)"
			(keydown.escape)="picking.set(false)"
		>
			@if (message().pinnedAt && !message().deletedAt) {
				<div class="pinned-label"><nb-icon icon="pin"></nb-icon> {{ 'CHAT.MESSAGE.PINNED' | translate }}</div>
			}
			<div class="gutter">
				@if (!continued()) {
					@if (message().kind === 'system') {
						<span class="system-icon"><nb-icon icon="info-outline"></nb-icon></span>
					} @else if (appIcon(); as icon) {
						<!-- An app (an incoming webhook): its https icon in place of an avatar. -->
						<img class="app-icon" [src]="icon" alt="" referrerpolicy="no-referrer" loading="lazy" data-test="app-icon" (error)="iconFailed.set(icon)" />
					} @else {
						<!-- A person: hover, focus, Enter or Space opens their profile card (the chat page shows it). -->
						<ngx-chat-person-avatar
							class="person-trigger"
							[attr.data-person-id]="personId()"
							[attr.tabindex]="personId() ? 0 : null"
							[attr.role]="personId() ? 'button' : null"
							[attr.aria-haspopup]="personId() ? 'dialog' : null"
							[attr.aria-label]="personId() ? authorName() : null"
							[person]="author()"
							[fallbackName]="authorName()"
						></ngx-chat-person-avatar>
					}
				} @else {
					<time class="side-time" [attr.datetime]="message().createdAt" [attr.title]="message().createdAt | date: 'medium'">{{ message().createdAt | date: 'shortTime' }}</time>
				}
			</div>
			<div class="content">
				@if (!continued()) {
					<header class="header">
						<span
							class="author"
							[class.person-trigger]="!!personId()"
							[attr.data-person-id]="personId()"
							[attr.tabindex]="personId() ? 0 : null"
							[attr.role]="personId() ? 'button' : null"
							[attr.aria-haspopup]="personId() ? 'dialog' : null"
							>{{ authorName() }}</span
						>
						@if (message().kind === 'app') {
							<span class="tag app" data-test="app-badge">{{ 'CHAT.MESSAGE.APP' | translate }}</span>
						}
						<time class="time" [attr.datetime]="message().createdAt" [attr.title]="message().createdAt | date: 'medium'">{{ message().createdAt | date: 'shortTime' }}</time>
					</header>
				}

				@if (message().deletedAt) {
					<p class="deleted"><nb-icon icon="trash-2-outline"></nb-icon> {{ 'CHAT.MESSAGE.DELETED' | translate }}</p>
				} @else {
					<div class="body" data-test="message-body">
						@if (!bodyHidden()) {
							<div class="markdown" [innerHTML]="html()"></div>
						}
						@if (message().editedAt) {
							<span class="edited" [attr.title]="message().editedAt | date: 'medium'">({{ 'CHAT.MESSAGE.EDITED' | translate }})</span>
						}
					</div>
					@if (appBlocks().length) {
						<ngx-chat-app-blocks [message]="message()" [readOnly]="readOnly()" (replaced)="act({ kind: 'replaced', message: $event })"></ngx-chat-app-blocks>
					}
					<!-- A body that only repeats the app blocks is not shown, nor are cards for its links. -->
					<ngx-chat-link-cards [body]="bodyHidden() ? '' : (message().body ?? '')"></ngx-chat-link-cards>
				}

				@if (message().taskReferences?.length) {
					<div class="cards">
						@for (reference of message().taskReferences ?? []; track reference.taskId) {
							<ngx-chat-task-card
								[messageId]="message().id"
								[taskId]="reference.taskId"
								[summary]="tasks().get(reference.taskId)"
								[people]="people()"
								[editable]="!readOnly() && !message().deletedAt"
							></ngx-chat-task-card>
						}
					</div>
				}

				@if (message().attachmentIds?.length && !message().deletedAt) {
					<ngx-chat-message-attachments [documentIds]="message().attachmentIds" [files]="files()"></ngx-chat-message-attachments>
				}

				@if (message().reactions?.length) {
					<div class="reactions" data-test="reactions">
						@for (reaction of message().reactions; track reaction.emoji) {
							<button
								type="button"
								class="reaction"
								[class.mine]="reaction.mine"
								[attr.aria-pressed]="reaction.mine"
								[disabled]="readOnly()"
								(click)="act({ kind: 'react', emoji: reaction.emoji, on: !reaction.mine })"
							>
								<span class="reaction-emoji">{{ reaction.emoji }}</span>
								<span class="reaction-count">{{ reaction.count }}</span>
							</button>
						}
						@if (!readOnly() && !message().deletedAt) {
							<button type="button" class="reaction add" [nbTooltip]="'CHAT.MESSAGE.REACT' | translate" [attr.aria-label]="'CHAT.MESSAGE.REACT' | translate" (click)="picking.set(!picking())">
								<nb-icon icon="smiling-face-outline"></nb-icon>
								<span class="plus">+</span>
							</button>
						}
					</div>
				}

				@if (message().replyCount > 0 && showThreadSummary()) {
					<button type="button" class="thread-summary" data-test="thread-summary" (click)="act({ kind: 'reply' })">
						<span class="thread-icon"><nb-icon icon="message-square-outline"></nb-icon></span>
						<span class="thread-count">
							@if (message().replyCount === 1) {
								{{ 'CHAT.THREADS.REPLY_ONE' | translate }}
							} @else {
								{{ 'CHAT.THREADS.REPLIES' | translate: { count: message().replyCount } }}
							}
						</span>
						@if (message().lastReplyAt) {
							<span class="last-reply">{{ 'CHAT.THREADS.LAST_REPLY' | translate: { time: (message().lastReplyAt | date: 'short') } }}</span>
						}
						<span class="view-thread">{{ 'CHAT.THREADS.VIEW' | translate }} <nb-icon icon="arrow-ios-forward-outline"></nb-icon></span>
					</button>
				}
			</div>

			@if (!message().deletedAt && !readOnly()) {
				<div class="toolbar" role="toolbar" [attr.aria-label]="'CHAT.MESSAGE.MORE' | translate">
					@for (emoji of toolbarReactions; track emoji) {
						<button type="button" class="tool emoji" [attr.aria-label]="emoji" (click)="react(emoji)">{{ emoji }}</button>
					}
					<button type="button" class="tool" [class.on]="picking()" [nbTooltip]="'CHAT.MESSAGE.REACT' | translate" [attr.aria-label]="'CHAT.MESSAGE.REACT' | translate" [attr.aria-expanded]="picking()" (click)="picking.set(!picking())" data-test="react">
						<nb-icon icon="smiling-face-outline"></nb-icon>
					</button>
					@if (canCreateTask()) {
						<button type="button" class="tool" [nbTooltip]="'CHAT.TASKS.CREATE_TITLE' | translate" [attr.aria-label]="'CHAT.TASKS.CREATE_TITLE' | translate" (click)="act({ kind: 'createTask' })" data-test="create-task">
							<nb-icon icon="checkmark-square-outline"></nb-icon>
						</button>
					}
					@if (canReply()) {
						<button type="button" class="tool" [nbTooltip]="'CHAT.MESSAGE.REPLY' | translate" [attr.aria-label]="'CHAT.MESSAGE.REPLY' | translate" (click)="act({ kind: 'reply' })" data-test="reply">
							<nb-icon icon="message-square-outline"></nb-icon>
						</button>
					}
					<button
						type="button"
						class="tool"
						[class.on]="!!message().pinnedAt"
						[nbTooltip]="(message().pinnedAt ? 'CHAT.MESSAGE.UNPIN' : 'CHAT.MESSAGE.PIN') | translate"
						[attr.aria-label]="(message().pinnedAt ? 'CHAT.MESSAGE.UNPIN' : 'CHAT.MESSAGE.PIN') | translate"
						(click)="act({ kind: 'pin', pinned: !message().pinnedAt })"
						data-test="pin"
					>
						<nb-icon [icon]="message().pinnedAt ? 'pin' : 'pin-outline'"></nb-icon>
					</button>
					@if (isMine()) {
						<button type="button" class="tool" [nbTooltip]="'CHAT.MESSAGE.EDIT' | translate" [attr.aria-label]="'CHAT.MESSAGE.EDIT' | translate" (click)="act({ kind: 'edit' })" data-test="edit">
							<nb-icon icon="edit-outline"></nb-icon>
						</button>
					}
					@if (canMarkUnread()) {
						<button type="button" class="tool" [nbTooltip]="'CHAT.MESSAGE.MARK_UNREAD' | translate" [attr.aria-label]="'CHAT.MESSAGE.MARK_UNREAD' | translate" (click)="act({ kind: 'unread' })" data-test="unread">
							<nb-icon icon="eye-off-outline"></nb-icon>
						</button>
					}
					@if (isMine() || canManage()) {
						<button type="button" class="tool danger" [nbTooltip]="'CHAT.MESSAGE.DELETE' | translate" [attr.aria-label]="'CHAT.MESSAGE.DELETE' | translate" (click)="act({ kind: 'delete' })" data-test="delete">
							<nb-icon icon="trash-2-outline"></nb-icon>
						</button>
					}
					@if (picking()) {
						<div class="picker" role="menu" data-test="reaction-picker">
							@for (emoji of quickReactions; track emoji) {
								<button type="button" class="pick" role="menuitem" [class.mine]="hasMine(emoji)" [attr.aria-label]="emoji" (click)="react(emoji)">{{ emoji }}</button>
							}
						</div>
					}
				</div>
			}
		</article>
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.message {
				position: relative;
				display: grid;
				grid-template-columns: 2.25rem minmax(0, 1fr);
				column-gap: 0.75rem;
				margin-top: 0.75rem;
				padding: 0.25rem 1.25rem 0.25rem 1.25rem;
				transition: background-color 0.08s ease;
			}
			.message.continued {
				margin-top: 0;
				padding-top: 0.0625rem;
				padding-bottom: 0.0625rem;
			}
			.message:hover,
			.message:focus-within,
			.message.picking {
				background: var(--chat-message-hover, rgba(127, 127, 127, 0.06));
			}
			.message.pinned {
				background: var(--chat-pinned-bg, rgba(255, 170, 0, 0.08));
			}
			.message.mentioned {
				background: var(--chat-mention-bg, rgba(255, 193, 7, 0.1));
				box-shadow: inset 2px 0 0 var(--chat-mention-edge, #f5a623);
			}
			.message.highlight {
				background: var(--chat-accent-soft-2, rgba(51, 102, 255, 0.14));
				box-shadow: inset 2px 0 0 var(--chat-accent, #3366ff);
			}
			.pinned-label {
				grid-column: 1 / -1;
				display: flex;
				align-items: center;
				gap: 0.25rem;
				padding-left: 1.75rem;
				margin-bottom: 0.125rem;
				color: var(--chat-pinned-text, #c77c02);
				font-size: 0.6875rem;
				font-weight: 600;
			}
			.pinned-label nb-icon {
				font-size: 0.75rem;
			}
			.gutter {
				grid-column: 1;
				display: flex;
				justify-content: center;
				padding-top: 0.125rem;
			}
			.app-icon {
				width: 2.25rem;
				height: 2.25rem;
				border-radius: var(--border-radius);
				object-fit: cover;
			}
			.system-icon {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 2.25rem;
				height: 2.25rem;
				border-radius: 0.5rem;
				background: var(--chat-hover, rgba(127, 127, 127, 0.12));
				color: var(--chat-muted, inherit);
			}
			.side-time {
				padding-top: 0.25rem;
				color: var(--chat-muted, inherit);
				font-size: 0.625rem;
				line-height: 1rem;
				white-space: nowrap;
				opacity: 0;
			}
			.message:hover .side-time,
			.message:focus-within .side-time {
				opacity: 1;
			}
			.content {
				grid-column: 2;
				min-width: 0;
			}
			.header {
				display: flex;
				align-items: baseline;
				gap: 0.5rem;
				flex-wrap: wrap;
				line-height: 1.375rem;
			}
			.author {
				color: var(--chat-text, inherit);
				font-weight: 800;
				font-size: 0.875rem;
			}
			/* A person's avatar and name open their profile card on hover (the chat page shows it). */
			.person-trigger[data-person-id] {
				cursor: pointer;
			}
			.author.person-trigger:hover,
			.author.person-trigger:focus-visible {
				text-decoration: underline;
			}
			.person-trigger[data-person-id]:focus-visible {
				border-radius: 0.375rem;
				outline: 2px solid var(--chat-accent, #3366ff);
				outline-offset: 2px;
			}
			.tag {
				padding: 0 0.3125rem;
				border-radius: 0.25rem;
				background: var(--chat-accent, #3366ff);
				color: var(--chat-on-accent, #fff);
				font-size: 0.625rem;
				font-weight: 700;
				text-transform: uppercase;
				letter-spacing: 0.04em;
				line-height: 1rem;
			}
			.time {
				color: var(--chat-muted, inherit);
				font-size: 0.6875rem;
			}
			.time:hover {
				text-decoration: underline;
			}
			.body {
				color: var(--chat-text, inherit);
				font-size: 0.875rem;
				line-height: 1.4667;
				overflow-wrap: anywhere;
			}
			.message.system .body {
				color: var(--chat-muted, inherit);
				font-style: italic;
			}
			.markdown {
				display: inline;
			}
			/* The body is set through innerHTML, so its elements carry no view attribute: these rules reach past the view. */
			:host ::ng-deep .markdown > :is(p, ul, ol, pre, blockquote, h1, h2, h3, h4, h5, h6):last-child {
				margin-bottom: 0;
			}
			/* "(edited)" follows the last line of text, as in chat apps. */
			:host ::ng-deep .markdown > p:last-child {
				display: inline;
			}
			:host ::ng-deep .markdown :is(p, ul, ol, pre, blockquote) {
				margin: 0 0 0.375rem;
			}
			:host ::ng-deep .markdown :is(h1, h2, h3, h4, h5, h6) {
				margin: 0.25rem 0;
				font-size: 0.9375rem;
				font-weight: 700;
			}
			:host ::ng-deep .markdown :is(ul, ol) {
				padding-left: 1.5rem;
			}
			:host ::ng-deep .markdown a {
				color: var(--chat-link, #1d9bd1);
				text-decoration: none;
			}
			:host ::ng-deep .markdown a:hover {
				text-decoration: underline;
			}
			:host ::ng-deep .markdown blockquote {
				padding-left: 0.75rem;
				border-left: 4px solid var(--chat-border-strong, rgba(127, 127, 127, 0.35));
				color: var(--chat-text, inherit);
			}
			:host ::ng-deep .markdown code {
				padding: 0.0625rem 0.25rem;
				border: 1px solid var(--chat-border, rgba(127, 127, 127, 0.25));
				border-radius: 0.25rem;
				background: var(--chat-code-bg, rgba(127, 127, 127, 0.1));
				color: var(--chat-code-text, #e01e5a);
				font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
				font-size: 0.75rem;
			}
			:host ::ng-deep .markdown pre {
				padding: 0.625rem 0.75rem;
				border: 1px solid var(--chat-border, rgba(127, 127, 127, 0.25));
				border-radius: 0.375rem;
				background: var(--chat-code-bg, rgba(127, 127, 127, 0.1));
				overflow-x: auto;
			}
			:host ::ng-deep .markdown pre code {
				padding: 0;
				border: 0;
				background: transparent;
				color: inherit;
			}
			:host ::ng-deep .markdown .chat-mention {
				padding: 0 0.1875rem;
				border-radius: 0.25rem;
				background: var(--chat-mention-chip-bg, rgba(29, 155, 209, 0.12));
				color: var(--chat-mention-chip-text, #1d9bd1);
				font-weight: 600;
				cursor: default;
			}
			:host ::ng-deep .markdown .chat-mention-me {
				background: var(--chat-mention-me-bg, rgba(242, 199, 68, 0.35));
				color: var(--chat-text, inherit);
			}
			:host ::ng-deep .markdown .chat-mention-person {
				cursor: pointer;
			}
			:host ::ng-deep .markdown .chat-mention-person:hover {
				text-decoration: underline;
			}
			.deleted {
				display: flex;
				align-items: center;
				gap: 0.375rem;
				margin: 0;
				color: var(--chat-muted, inherit);
				font-style: italic;
				font-size: 0.8125rem;
			}
			.edited {
				margin-left: 0.25rem;
				color: var(--chat-muted, inherit);
				font-size: 0.6875rem;
			}
			.cards {
				display: flex;
				flex-wrap: wrap;
				gap: 0.375rem;
				margin-top: 0.375rem;
			}
			.reactions {
				display: flex;
				flex-wrap: wrap;
				gap: 0.25rem;
				margin-top: 0.375rem;
			}
			.reaction {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				height: 1.5rem;
				padding: 0 0.4375rem;
				border: 1px solid transparent;
				border-radius: 999px;
				background: var(--chat-reaction-bg, rgba(127, 127, 127, 0.12));
				color: var(--chat-text, inherit);
				font-size: 0.75rem;
				cursor: pointer;
				transition: border-color 0.1s ease, background-color 0.1s ease;
			}
			.reaction:hover:not(:disabled) {
				border-color: var(--chat-border-strong, rgba(127, 127, 127, 0.45));
			}
			.reaction:disabled {
				cursor: default;
			}
			.reaction.mine {
				border-color: var(--chat-accent, #3366ff);
				background: var(--chat-accent-soft, rgba(51, 102, 255, 0.12));
			}
			.reaction.mine .reaction-count {
				color: var(--chat-accent, #3366ff);
			}
			.reaction-emoji {
				font-size: 0.875rem;
				line-height: 1;
			}
			.reaction-count {
				font-size: 0.6875rem;
				font-weight: 700;
			}
			.reaction.add {
				gap: 0;
				color: var(--chat-muted, inherit);
				opacity: 0;
			}
			.reaction.add .plus {
				font-size: 0.6875rem;
				font-weight: 700;
				margin-left: -0.125rem;
				margin-top: -0.5rem;
			}
			.message:hover .reaction.add,
			.reaction.add:focus-visible {
				opacity: 1;
			}
			.thread-summary {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				width: min(100%, 36rem);
				margin-top: 0.375rem;
				padding: 0.3125rem 0.5rem 0.3125rem 0.3125rem;
				border: 1px solid transparent;
				border-radius: 0.375rem;
				background: transparent;
				color: inherit;
				font: inherit;
				font-size: 0.75rem;
				text-align: left;
				cursor: pointer;
				transition: border-color 0.1s ease, background-color 0.1s ease;
			}
			.thread-summary:hover,
			.thread-summary:focus-visible {
				border-color: var(--chat-border, rgba(127, 127, 127, 0.25));
				background: var(--chat-bg, transparent);
			}
			.thread-icon {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1.5rem;
				height: 1.5rem;
				border-radius: 0.375rem;
				background: var(--chat-accent-soft, rgba(51, 102, 255, 0.12));
				color: var(--chat-accent, #3366ff);
			}
			.thread-icon nb-icon {
				font-size: 0.875rem;
			}
			.thread-count {
				color: var(--chat-link, #1d9bd1);
				font-weight: 700;
			}
			.last-reply {
				color: var(--chat-muted, inherit);
			}
			.view-thread {
				display: none;
				align-items: center;
				margin-left: auto;
				color: var(--chat-muted, inherit);
			}
			.thread-summary:hover .last-reply {
				display: none;
			}
			.thread-summary:hover .view-thread {
				display: inline-flex;
			}
			/* Kept in the layout (so its buttons can take keyboard focus), shown on hover and when one of them has focus. */
			.toolbar {
				position: absolute;
				top: -1rem;
				right: 1.25rem;
				z-index: 3;
				display: flex;
				align-items: center;
				gap: 0.0625rem;
				padding: 0.125rem;
				border: 1px solid var(--chat-border, rgba(127, 127, 127, 0.25));
				border-radius: 0.5rem;
				background: var(--chat-raised, #fff);
				box-shadow: 0 0.25rem 0.75rem rgba(0, 0, 0, 0.12);
				opacity: 0;
				pointer-events: none;
				transition: opacity 0.08s ease;
			}
			.message:hover .toolbar,
			.message:focus-within .toolbar,
			.message.picking .toolbar {
				opacity: 1;
				pointer-events: auto;
			}
			.tool {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 2rem;
				height: 2rem;
				border: 0;
				border-radius: 0.375rem;
				background: transparent;
				color: var(--chat-muted, inherit);
				cursor: pointer;
			}
			.tool nb-icon {
				font-size: 1.125rem;
			}
			.tool.emoji {
				font-size: 1rem;
			}
			.tool:hover,
			.tool:focus-visible,
			.tool.on {
				background: var(--chat-hover, rgba(127, 127, 127, 0.15));
				color: var(--chat-text, inherit);
			}
			.tool.danger:hover,
			.tool.danger:focus-visible {
				color: var(--chat-danger, #e4493f);
			}
			.picker {
				position: absolute;
				top: calc(100% + 0.25rem);
				right: 0;
				display: grid;
				grid-template-columns: repeat(6, 2.25rem);
				gap: 0.125rem;
				padding: 0.375rem;
				border: 1px solid var(--chat-border, rgba(127, 127, 127, 0.25));
				border-radius: 0.5rem;
				background: var(--chat-raised, #fff);
				box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.18);
			}
			/* The gap above the picker is part of it: crossing it from the toolbar never leaves the message. */
			.picker::before {
				content: '';
				position: absolute;
				top: -0.3125rem;
				right: 0;
				left: 0;
				height: 0.3125rem;
			}
			.pick {
				width: 2.25rem;
				height: 2.25rem;
				border: 0;
				border-radius: 0.375rem;
				background: transparent;
				font-size: 1.25rem;
				cursor: pointer;
				transition: transform 0.08s ease, background-color 0.08s ease;
			}
			.pick:hover,
			.pick:focus-visible {
				background: var(--chat-hover, rgba(127, 127, 127, 0.15));
				transform: scale(1.12);
			}
			.pick.mine {
				background: var(--chat-accent-soft, rgba(51, 102, 255, 0.12));
			}
			@media (max-width: 600px) {
				.message {
					padding-left: 0.75rem;
					padding-right: 0.75rem;
				}
				.toolbar {
					right: 0.5rem;
				}
				.tool.emoji {
					display: none;
				}
			}
		`
	]
})
export class MessageItemComponent {
	private readonly sanitizer = inject(DomSanitizer);

	readonly message = input.required<IChatMessageWithRelations>();
	readonly people = input.required<ChatPeople>();
	readonly conversationNames = input<ReadonlyMap<string, string>>(new Map());
	/** The conversation's files read so far, by document id (what the attachments show). */
	readonly files = input<ReadonlyMap<string, IChatFile>>(new Map());
	/** The task summaries read so far (null: a task the reader may not see), for the task cards. */
	readonly tasks = input<ReadonlyMap<string, ChatTaskSummary | null>>(new Map());
	/** Offers "Create task from message" (`ORG_TASK_ADD`, a member of a conversation that is not archived). */
	readonly canCreateTask = input(false);
	readonly meEmployeeId = input<string | null>(null);
	readonly meUserId = input<string | null>(null);
	readonly continued = input(false);
	readonly canManage = input(false);
	readonly readOnly = input(false);
	/** Thread replies offer no "reply in thread" of their own. */
	readonly canReply = input(true);
	readonly canMarkUnread = input(true);
	readonly showThreadSummary = input(true);
	readonly highlighted = input(false);

	readonly action = output<MessageAction>();

	protected readonly quickReactions = CHAT_QUICK_REACTIONS;
	protected readonly toolbarReactions = CHAT_QUICK_REACTIONS.slice(0, CHAT_TOOLBAR_REACTIONS);
	protected readonly picking = signal(false);

	protected readonly author = computed(() => {
		const message = this.message();
		const people = this.people();
		return (
			(message.authorEmployeeId ? people.byEmployee.get(String(message.authorEmployeeId)) : null) ??
			(message.authorUserId ? people.byUser.get(String(message.authorUserId)) : null) ??
			null
		);
	});
	/** The author's employee id, which opens their profile card on hover (none for system and app messages). */
	protected readonly personId = computed(() => {
		const kind = this.message().kind;
		if (kind === ChatMessageKindEnum.SYSTEM || kind === ChatMessageKindEnum.APP) return null;
		return this.author()?.employeeId ?? null;
	});
	protected readonly authorName = computed(() => {
		const message = this.message();
		if (message.kind === ChatMessageKindEnum.SYSTEM) return 'System';
		if (message.kind === ChatMessageKindEnum.APP) return message.appName ?? 'App';
		return this.author()?.name ?? '…';
	});
	protected readonly isMine = computed(() => {
		const message = this.message();
		const me = this.meEmployeeId();
		const meUser = this.meUserId();
		return (!!me && String(message.authorEmployeeId) === me) || (!!meUser && String(message.authorUserId) === meUser);
	});
	/** The blocks of an app message (none for a member's message). */
	protected readonly appBlocks = computed(() => appBlocksOf(this.message()));
	/** An app message whose body only repeats its blocks shows the blocks alone. */
	protected readonly bodyHidden = computed(() => bodyRepeatsBlocks(this.message().body, this.appBlocks()));
	/** The icon of the app that posted the message (https only), shown in place of an avatar. */
	/** An app icon that did not load: the initials avatar shows instead (as for a person whose picture failed). */
	protected readonly iconFailed = signal<string | null>(null);
	protected readonly appIcon = computed(() => {
		const icon = this.message().kind === ChatMessageKindEnum.APP ? safeIconUrl(this.message().appIconUrl) : null;
		return icon && icon !== this.iconFailed() ? icon : null;
	});
	/** Someone else's message that names me (or everyone): tinted, as chat apps do. */
	protected readonly mentioned = computed(() => {
		const message = this.message();
		return !message.deletedAt && !this.isMine() && mentionsMe(message.body ?? '', this.meEmployeeId());
	});
	protected readonly html = computed(() =>
		renderBodyHtml(this.message().body ?? '', this.people().byEmployee, this.conversationNames(), this.meEmployeeId(), this.sanitizer)
	);

	protected hasMine(emoji: string): boolean {
		return this.message().reactions?.some((reaction) => reaction.emoji === emoji && reaction.mine) ?? false;
	}

	protected act(action: MessageAction): void {
		this.picking.set(false);
		this.action.emit(action);
	}

	protected react(emoji: string): void {
		this.act({ kind: 'react', emoji, on: !this.hasMine(emoji) });
	}
}
