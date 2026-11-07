import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbCheckboxModule, NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IChatMessageWithRelations } from '@gauzy/contracts';
import { ToastrService } from '@gauzy/ui-core/core';
import { continuesGroup, mergeMessages, newNonce } from '../../chat-ui.helpers';
import { ChatPeople } from '../../services/chat-people.service';
import { ChatUiService } from '../../services/chat-ui.service';
import { ComposerSubmission, MessageComposerComponent } from '../message-composer/message-composer.component';
import { MessageAction, MessageItemComponent } from '../message-item/message-item.component';

/** A thread: its root message, the replies, follow / unfollow, and a composer with "also send to the conversation". */
@Component({
	selector: 'ngx-chat-thread-pane',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbButtonModule, NbCheckboxModule, NbIconModule, NbSpinnerModule, NbTooltipModule, TranslatePipe, MessageComposerComponent, MessageItemComponent],
	template: `
		<aside class="thread" data-test="thread-pane">
			<header class="header">
				<h6 class="title">{{ 'CHAT.THREADS.TITLE' | translate }}</h6>
				@if (root(); as root) {
					<button nbButton ghost size="tiny" type="button" data-test="follow" (click)="toggleFollow()">
						<nb-icon [icon]="root.following ? 'bell-off-outline' : 'bell-outline'"></nb-icon>
						{{ (root.following ? 'CHAT.THREADS.UNFOLLOW' : 'CHAT.THREADS.FOLLOW') | translate }}
					</button>
				}
				<button nbButton ghost size="tiny" type="button" data-test="close-thread" [nbTooltip]="'CHAT.THREADS.CLOSE' | translate" (click)="closed.emit()">
					<nb-icon icon="close-outline"></nb-icon>
				</button>
			</header>
			<div class="body">
				@if (loading()) {
					<div class="loading" [nbSpinner]="true"></div>
				} @else if (error()) {
					<p class="empty">{{ 'CHAT.ERROR' | translate }} <button nbButton ghost size="tiny" type="button" (click)="reload()">{{ 'CHAT.RETRY' | translate }}</button></p>
				} @else if (root(); as root) {
					<ngx-chat-message-item
						[message]="root"
						[people]="people()"
						[conversationNames]="conversationNames()"
						[meEmployeeId]="meEmployeeId()"
						[meUserId]="meUserId()"
						[canReply]="false"
						[canMarkUnread]="false"
						[showThreadSummary]="false"
						[readOnly]="readOnly()"
						(action)="onAction(root, $event)"
					></ngx-chat-message-item>
					<hr class="divider" />
					@for (reply of replies(); track reply.id; let index = $index) {
						<ngx-chat-message-item
							[message]="reply"
							[people]="people()"
							[conversationNames]="conversationNames()"
							[meEmployeeId]="meEmployeeId()"
							[meUserId]="meUserId()"
							[continued]="continues(index)"
							[canReply]="false"
							[canMarkUnread]="false"
							[showThreadSummary]="false"
							[readOnly]="readOnly()"
							(action)="onAction(reply, $event)"
						></ngx-chat-message-item>
					}
				}
			</div>
			@if (!readOnly()) {
				<footer class="footer">
					<ngx-chat-message-composer
						[people]="people()"
						[placeholder]="'CHAT.THREADS.REPLY_PLACEHOLDER' | translate"
						[disabled]="sending()"
						[editing]="editing() !== null"
						[initialBody]="editing()?.body ?? null"
						[resetToken]="resetToken()"
						(submitted)="onSubmit($event)"
						(cancel)="editing.set(null)"
					></ngx-chat-message-composer>
					<nb-checkbox class="also" data-test="also-send" [(ngModel)]="alsoInConversation">{{ 'CHAT.THREADS.ALSO_SEND' | translate }}</nb-checkbox>
				</footer>
			}
		</aside>
	`,
	styles: [
		`
			.thread {
				display: flex;
				flex-direction: column;
				height: 100%;
				min-height: 0;
				border-left: 1px solid rgba(127, 127, 127, 0.2);
			}
			.header {
				display: flex;
				align-items: center;
				gap: 0.25rem;
				padding: 0.5rem 0.75rem;
				border-bottom: 1px solid rgba(127, 127, 127, 0.2);
			}
			.title {
				flex: 1 1 auto;
				margin: 0;
				font-size: 0.875rem;
			}
			.body {
				flex: 1 1 auto;
				min-height: 0;
				overflow-y: auto;
				padding: 0.5rem 0;
			}
			.divider {
				margin: 0.5rem 0.75rem;
				border: 0;
				border-top: 1px solid rgba(127, 127, 127, 0.2);
			}
			.loading {
				min-height: 6rem;
			}
			.empty {
				margin: 1rem 0.75rem;
				font-size: 0.875rem;
				opacity: 0.7;
			}
			.footer {
				padding: 0.5rem 0.75rem 0.75rem;
				border-top: 1px solid rgba(127, 127, 127, 0.2);
			}
			.also {
				display: block;
				margin-top: 0.25rem;
				font-size: 0.75rem;
			}
		`
	]
})
export class ThreadPaneComponent {
	private readonly api = inject(ChatUiService);
	private readonly toastr = inject(ToastrService);
	private readonly translate = inject(TranslateService);
	private readonly destroyRef = inject(DestroyRef);

	readonly rootMessageId = input.required<string>();
	readonly conversationId = input.required<string>();
	readonly people = input.required<ChatPeople>();
	readonly conversationNames = input<ReadonlyMap<string, string>>(new Map());
	readonly meEmployeeId = input<string | null>(null);
	readonly meUserId = input<string | null>(null);
	readonly readOnly = input(false);

	readonly closed = output<void>();
	/** The root changed (reply count, follow state): the conversation shows it too. */
	readonly rootChanged = output<IChatMessageWithRelations>();

	readonly root = signal<IChatMessageWithRelations | null>(null);
	readonly replies = signal<IChatMessageWithRelations[]>([]);
	readonly loading = signal(false);
	readonly error = signal(false);
	readonly sending = signal(false);
	readonly editing = signal<IChatMessageWithRelations | null>(null);
	readonly resetToken = signal(0);
	protected alsoInConversation = false;

	readonly replyCount = computed(() => this.replies().length);

	constructor() {
		effect(() => {
			this.rootMessageId();
			untracked(() => {
				this.editing.set(null);
				this.reload();
			});
		});
	}

	reload(): void {
		const id = this.rootMessageId();
		this.loading.set(true);
		this.error.set(false);
		this.api
			.thread(id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (page) => {
					if (this.rootMessageId() !== id) return;
					this.root.set(page.root);
					this.replies.set(mergeMessages([], page.messages.filter((message) => message.id !== page.root.id)));
					this.loading.set(false);
				},
				error: () => {
					this.loading.set(false);
					this.error.set(true);
				}
			});
	}

	protected continues(index: number): boolean {
		const list = this.replies();
		return continuesGroup(list[index - 1], list[index]);
	}

	protected toggleFollow(): void {
		const root = this.root();
		if (!root) return;
		const following = !root.following;
		this.api
			.setFollowing(root.id, following)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: () => {
					const next = { ...root, following };
					this.root.set(next);
					this.rootChanged.emit(next);
					this.api.notifyChanged();
				},
				error: (error) => this.fail(error)
			});
	}

	protected onSubmit(submission: ComposerSubmission): void {
		const root = this.root();
		if (!root) return;
		const editing = this.editing();
		this.sending.set(true);
		const request = editing
			? this.api.edit(editing.id, { body: submission.body, mentionEmployeeIds: submission.mentionEmployeeIds })
			: this.api.send(this.conversationId(), {
					body: submission.body,
					nonce: newNonce(),
					threadRootId: root.id,
					alsoInConversation: this.alsoInConversation,
					mentionEmployeeIds: submission.mentionEmployeeIds
				});
		request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: (result) => {
				this.sending.set(false);
				this.resetToken.update((value) => value + 1);
				if (editing) {
					this.replace(result.message);
					this.editing.set(null);
				} else {
					this.replies.set(mergeMessages(this.replies(), [result.message]));
					const next = { ...root, replyCount: root.replyCount + 1, lastReplyAt: result.message.createdAt, following: true };
					this.root.set(next);
					this.rootChanged.emit(next);
					this.api.notifyChanged();
				}
			},
			error: (error) => {
				this.sending.set(false);
				this.fail(error, 'CHAT.COMPOSER.SEND_FAILED');
			}
		});
	}

	protected onAction(message: IChatMessageWithRelations, action: MessageAction): void {
		switch (action.kind) {
			case 'edit':
				if (message.id !== this.root()?.id) this.editing.set(message);
				return;
			case 'delete':
				if (typeof window !== 'undefined' && !window.confirm(this.translate.instant('CHAT.MESSAGE.DELETE_CONFIRM'))) return;
				this.api
					.remove(message.id)
					.pipe(takeUntilDestroyed(this.destroyRef))
					.subscribe({ next: () => this.replace({ ...message, body: '', deletedAt: new Date() }), error: (error) => this.fail(error) });
				return;
			case 'pin':
				this.api
					.setPinned(message.id, action.pinned)
					.pipe(takeUntilDestroyed(this.destroyRef))
					.subscribe({ next: (result) => this.replace(result.message), error: (error) => this.fail(error) });
				return;
			case 'react':
				this.api
					.react(message.id, action.emoji, action.on)
					.pipe(takeUntilDestroyed(this.destroyRef))
					.subscribe({ next: (result) => this.replace(result.message), error: (error) => this.fail(error) });
				return;
			default:
				return;
		}
	}

	private replace(message: IChatMessageWithRelations): void {
		const root = this.root();
		if (root && root.id === message.id) {
			const next = { ...root, ...message };
			this.root.set(next);
			this.rootChanged.emit(next);
			return;
		}
		this.replies.set(this.replies().map((item) => (item.id === message.id ? { ...item, ...message } : item)));
	}

	private fail(error: unknown, fallbackKey = 'CHAT.DIALOG.FAILED'): void {
		const body = (error as HttpErrorResponse)?.error;
		const message = body?.message;
		const text = Array.isArray(message) ? message.join(' ') : typeof message === 'string' && message.trim() ? message : null;
		this.toastr.danger(text ?? this.translate.instant(fallbackKey));
	}
}
