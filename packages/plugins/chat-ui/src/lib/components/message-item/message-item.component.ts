import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { ChatMessageKindEnum, IChatMessageWithRelations } from '@gauzy/contracts';
import { CHAT_QUICK_REACTIONS, CHAT_TASK_LINK } from '../../chat-ui.constants';
import { renderBodyHtml } from '../../chat-ui.helpers';
import { ChatPeople } from '../../services/chat-people.service';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';

/** What a message's toolbar asks of the conversation. */
export type MessageAction =
	| { kind: 'reply' }
	| { kind: 'edit' }
	| { kind: 'delete' }
	| { kind: 'pin'; pinned: boolean }
	| { kind: 'react'; emoji: string; on: boolean }
	| { kind: 'unread' }
	| { kind: 'follow'; following: boolean };

/**
 * One message: the author header (unless it continues the previous author's group), the body with mention
 * chips, the task cards, the reactions, the thread summary, and a toolbar shown on hover and on keyboard focus
 * (reply, react, pin, edit, delete, mark unread).
 */
@Component({
	selector: 'ngx-chat-message-item',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, RouterLink, NbButtonModule, NbIconModule, NbTooltipModule, TranslatePipe, PersonAvatarComponent],
	template: `
		<article
			class="message"
			[class.continued]="continued()"
			[class.system]="message().kind === 'system'"
			[class.mine]="isMine()"
			[class.highlight]="highlighted()"
			[attr.data-test]="'message-' + message().id"
			[attr.data-message-id]="message().id"
		>
			@if (!continued()) {
				<ngx-chat-person-avatar class="avatar" [person]="author()" [fallbackName]="authorName()"></ngx-chat-person-avatar>
			}
			<div class="content">
				@if (!continued()) {
					<header class="header">
						<span class="author">{{ authorName() }}</span>
						@if (message().kind === 'app' && message().appName) {
							<span class="tag">{{ 'CHAT.MESSAGE.APP' | translate }} · {{ message().appName }}</span>
						}
						<time class="time" [attr.datetime]="message().createdAt">{{ message().createdAt | date: 'shortTime' }}</time>
						@if (message().pinnedAt) {
							<span class="tag pinned"><nb-icon icon="pin-outline"></nb-icon> {{ 'CHAT.MESSAGE.PINNED' | translate }}</span>
						}
					</header>
				} @else {
					<time class="time side" [attr.datetime]="message().createdAt">{{ message().createdAt | date: 'shortTime' }}</time>
				}

				@if (message().deletedAt) {
					<p class="deleted">{{ 'CHAT.MESSAGE.DELETED' | translate }}</p>
				} @else {
					<div class="body" data-test="message-body" [innerHTML]="html()"></div>
					@if (message().editedAt) {
						<span class="edited">({{ 'CHAT.MESSAGE.EDITED' | translate }})</span>
					}
				}

				@for (reference of message().taskReferences ?? []; track reference.taskId) {
					<a class="task-card" [routerLink]="taskLink(reference.taskId)" data-test="task-card">
						<nb-icon icon="checkmark-square-2-outline"></nb-icon>
						<span>{{ 'CHAT.MESSAGE.TASK' | translate }}</span>
						<span class="task-id">{{ reference.taskId }}</span>
					</a>
				}

				@if (message().attachmentIds?.length) {
					<p class="attachments"><nb-icon icon="attach-outline"></nb-icon> {{ 'CHAT.MESSAGE.ATTACHMENTS' | translate: { count: message().attachmentIds!.length } }}</p>
				}

				@if (message().reactions?.length) {
					<div class="reactions" data-test="reactions">
						@for (reaction of message().reactions; track reaction.emoji) {
							<button type="button" class="reaction" [class.mine]="reaction.mine" [attr.aria-pressed]="reaction.mine" (click)="act({ kind: 'react', emoji: reaction.emoji, on: !reaction.mine })">
								<span>{{ reaction.emoji }}</span>
								<span class="reaction-count">{{ reaction.count }}</span>
							</button>
						}
					</div>
				}

				@if (message().replyCount > 0 && showThreadSummary()) {
					<button type="button" class="thread-summary" data-test="thread-summary" (click)="act({ kind: 'reply' })">
						<nb-icon icon="message-square-outline"></nb-icon>
						@if (message().replyCount === 1) {
							{{ 'CHAT.THREADS.REPLY_ONE' | translate }}
						} @else {
							{{ 'CHAT.THREADS.REPLIES' | translate: { count: message().replyCount } }}
						}
						@if (message().lastReplyAt) {
							<span class="last-reply">· {{ message().lastReplyAt | date: 'short' }}</span>
						}
					</button>
				}
			</div>

			@if (!message().deletedAt && !readOnly()) {
				<div class="toolbar" role="toolbar" [attr.aria-label]="'CHAT.MESSAGE.MORE' | translate">
					<button type="button" class="tool" [nbTooltip]="'CHAT.MESSAGE.REACT' | translate" [attr.aria-label]="'CHAT.MESSAGE.REACT' | translate" (click)="picking.set(!picking())" data-test="react">
						<nb-icon icon="smiling-face-outline"></nb-icon>
					</button>
					@if (canReply()) {
						<button type="button" class="tool" [nbTooltip]="'CHAT.MESSAGE.REPLY' | translate" [attr.aria-label]="'CHAT.MESSAGE.REPLY' | translate" (click)="act({ kind: 'reply' })" data-test="reply">
							<nb-icon icon="corner-up-left-outline"></nb-icon>
						</button>
					}
					<button
						type="button"
						class="tool"
						[nbTooltip]="(message().pinnedAt ? 'CHAT.MESSAGE.UNPIN' : 'CHAT.MESSAGE.PIN') | translate"
						[attr.aria-label]="(message().pinnedAt ? 'CHAT.MESSAGE.UNPIN' : 'CHAT.MESSAGE.PIN') | translate"
						(click)="act({ kind: 'pin', pinned: !message().pinnedAt })"
						data-test="pin"
					>
						<nb-icon icon="pin-outline"></nb-icon>
					</button>
					@if (isMine()) {
						<button type="button" class="tool" [nbTooltip]="'CHAT.MESSAGE.EDIT' | translate" [attr.aria-label]="'CHAT.MESSAGE.EDIT' | translate" (click)="act({ kind: 'edit' })" data-test="edit">
							<nb-icon icon="edit-outline"></nb-icon>
						</button>
					}
					@if (isMine() || canManage()) {
						<button type="button" class="tool" [nbTooltip]="'CHAT.MESSAGE.DELETE' | translate" [attr.aria-label]="'CHAT.MESSAGE.DELETE' | translate" (click)="act({ kind: 'delete' })" data-test="delete">
							<nb-icon icon="trash-2-outline"></nb-icon>
						</button>
					}
					@if (canMarkUnread()) {
						<button type="button" class="tool" [nbTooltip]="'CHAT.MESSAGE.MARK_UNREAD' | translate" [attr.aria-label]="'CHAT.MESSAGE.MARK_UNREAD' | translate" (click)="act({ kind: 'unread' })" data-test="unread">
							<nb-icon icon="eye-off-outline"></nb-icon>
						</button>
					}
					@if (picking()) {
						<span class="picker" data-test="reaction-picker">
							@for (emoji of quickReactions; track emoji) {
								<button type="button" class="tool emoji" [attr.aria-label]="emoji" (click)="react(emoji)">{{ emoji }}</button>
							}
						</span>
					}
				</div>
			}
		</article>
	`,
	styles: [
		`
			.message {
				position: relative;
				display: grid;
				grid-template-columns: 2.5rem 1fr;
				gap: 0 0.5rem;
				padding: 0.25rem 0.75rem;
			}
			.message.continued {
				padding-top: 0;
			}
			.message:hover {
				background: rgba(127, 127, 127, 0.07);
			}
			.message.highlight {
				background: rgba(255, 193, 7, 0.15);
			}
			.message.system .body {
				font-style: italic;
				opacity: 0.75;
			}
			.avatar {
				grid-column: 1;
				padding-top: 0.125rem;
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
			}
			.author {
				font-weight: 600;
				font-size: 0.875rem;
			}
			.time {
				font-size: 0.6875rem;
				opacity: 0.6;
			}
			.time.side {
				position: absolute;
				left: 0.5rem;
				top: 0.25rem;
				width: 2.5rem;
				text-align: right;
				opacity: 0;
			}
			.message:hover .time.side {
				opacity: 0.6;
			}
			.tag {
				font-size: 0.6875rem;
				opacity: 0.7;
			}
			.body {
				font-size: 0.875rem;
				line-height: 1.5;
				overflow-wrap: anywhere;
			}
			/* The body is set through innerHTML, so its elements carry no view attribute: these rules reach past the view. */
			:host ::ng-deep .body :is(p, ul, ol, pre, blockquote) {
				margin: 0 0 0.25rem;
			}
			:host ::ng-deep .body pre {
				padding: 0.5rem;
				border-radius: 0.25rem;
				background: rgba(127, 127, 127, 0.12);
				overflow-x: auto;
			}
			:host ::ng-deep .body code {
				font-size: 0.8125rem;
			}
			:host ::ng-deep .body .chat-mention {
				padding: 0 0.25rem;
				border-radius: 0.25rem;
				background: rgba(51, 102, 255, 0.15);
				font-weight: 600;
			}
			:host ::ng-deep .body .chat-mention-me {
				background: rgba(255, 193, 7, 0.35);
			}
			.deleted {
				margin: 0;
				font-style: italic;
				opacity: 0.6;
				font-size: 0.875rem;
			}
			.edited {
				font-size: 0.6875rem;
				opacity: 0.6;
			}
			.task-card {
				display: inline-flex;
				align-items: center;
				gap: 0.375rem;
				margin: 0.25rem 0.25rem 0 0;
				padding: 0.25rem 0.5rem;
				border: 1px solid rgba(127, 127, 127, 0.3);
				border-radius: 0.375rem;
				font-size: 0.8125rem;
				color: inherit;
				text-decoration: none;
			}
			.task-id {
				font-family: monospace;
				font-size: 0.6875rem;
				opacity: 0.7;
			}
			.attachments {
				margin: 0.25rem 0 0;
				font-size: 0.75rem;
				opacity: 0.7;
			}
			.reactions {
				display: flex;
				flex-wrap: wrap;
				gap: 0.25rem;
				margin-top: 0.25rem;
			}
			.reaction {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				padding: 0.0625rem 0.375rem;
				border: 1px solid rgba(127, 127, 127, 0.3);
				border-radius: 999px;
				background: transparent;
				font-size: 0.8125rem;
				cursor: pointer;
				color: inherit;
			}
			.reaction.mine {
				border-color: var(--color-primary-default, #3366ff);
				background: rgba(51, 102, 255, 0.12);
			}
			.reaction-count {
				font-size: 0.6875rem;
			}
			.thread-summary {
				display: inline-flex;
				align-items: center;
				gap: 0.375rem;
				margin-top: 0.25rem;
				padding: 0.125rem 0.375rem;
				border: 0;
				border-radius: 0.25rem;
				background: transparent;
				color: var(--color-primary-default, #3366ff);
				font-size: 0.8125rem;
				cursor: pointer;
			}
			.last-reply {
				opacity: 0.7;
				color: inherit;
			}
			/* Kept in the layout (so its buttons can take keyboard focus), shown on hover and when one of them has focus. */
			.toolbar {
				position: absolute;
				top: -0.75rem;
				right: 0.75rem;
				display: flex;
				gap: 0.125rem;
				padding: 0.125rem;
				border-radius: 0.375rem;
				background: var(--card-background-color, #fff);
				box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.18);
				opacity: 0;
				pointer-events: none;
			}
			.message:hover .toolbar,
			.message:focus-within .toolbar {
				opacity: 1;
				pointer-events: auto;
			}
			.tool {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1.75rem;
				height: 1.75rem;
				border: 0;
				border-radius: 0.25rem;
				background: transparent;
				color: inherit;
				cursor: pointer;
			}
			.tool:hover,
			.tool:focus-visible {
				background: rgba(127, 127, 127, 0.15);
			}
			.picker {
				display: inline-flex;
				gap: 0.125rem;
				padding-left: 0.25rem;
				border-left: 1px solid rgba(127, 127, 127, 0.3);
			}
		`
	]
})
export class MessageItemComponent {
	private readonly sanitizer = inject(DomSanitizer);

	readonly message = input.required<IChatMessageWithRelations>();
	readonly people = input.required<ChatPeople>();
	readonly conversationNames = input<ReadonlyMap<string, string>>(new Map());
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
	protected readonly html = computed(() =>
		renderBodyHtml(this.message().body ?? '', this.people().byEmployee, this.conversationNames(), this.meEmployeeId(), this.sanitizer)
	);

	protected taskLink(taskId: string): string {
		return `${CHAT_TASK_LINK}/${encodeURIComponent(taskId)}`;
	}

	protected act(action: MessageAction): void {
		this.picking.set(false);
		this.action.emit(action);
	}

	protected react(emoji: string): void {
		const mine = this.message().reactions?.some((reaction) => reaction.emoji === emoji && reaction.mine) ?? false;
		this.act({ kind: 'react', emoji, on: !mine });
	}
}
