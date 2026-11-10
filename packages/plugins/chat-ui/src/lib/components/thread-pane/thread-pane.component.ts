import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NbCheckboxModule, NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EMPTY, Subscription, timer } from 'rxjs';
import { catchError, filter, switchMap } from 'rxjs/operators';
import { IChatMessageWithRelations } from '@gauzy/contracts';
import { ToastrService } from '@gauzy/ui-core/core';
import { CHAT_THREAD_POLL_MS } from '../../chat-ui.constants';
import { apiErrorMessage, continuesGroup, mergeMessages, newNonce } from '../../chat-ui.helpers';
import { ChatPeople } from '../../services/chat-people.service';
import { ChatMessagePatch, ChatThreadPage, ChatUiService, threadFieldsOf } from '../../services/chat-ui.service';
import { clearDraft, ComposerSubmission, MessageComposerComponent } from '../message-composer/message-composer.component';
import { MessageAction, MessageItemComponent } from '../message-item/message-item.component';

/**
 * A thread: its root message, the replies (the first page, more on request, newer ones by polling), follow /
 * unfollow, and a composer with "also send to the conversation". Showing the replies marks the thread read.
 * Every request captures the root it was made for and drops its answer when another thread is open by then.
 */
@Component({
	selector: 'ngx-chat-thread-pane',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbCheckboxModule, NbIconModule, NbSpinnerModule, NbTooltipModule, TranslatePipe, MessageComposerComponent, MessageItemComponent],
	template: `
		<aside class="thread" data-test="thread-pane">
			<header class="header">
				<div class="heading">
					<h6 class="title">{{ 'CHAT.THREADS.TITLE' | translate }}</h6>
					@if (channelName(); as name) {
						<span class="subtitle">#{{ name }}</span>
					}
				</div>
				@if (root(); as root) {
					<button
						type="button"
						class="icon-button"
						data-test="follow"
						[class.on]="root.following"
						[nbTooltip]="(root.following ? 'CHAT.THREADS.UNFOLLOW' : 'CHAT.THREADS.FOLLOW') | translate"
						[attr.aria-label]="(root.following ? 'CHAT.THREADS.UNFOLLOW' : 'CHAT.THREADS.FOLLOW') | translate"
						[attr.aria-pressed]="!!root.following"
						(click)="toggleFollow()"
					>
						<nb-icon [icon]="root.following ? 'bell' : 'bell-outline'"></nb-icon>
					</button>
				}
				<button type="button" class="icon-button" data-test="close-thread" [nbTooltip]="'CHAT.THREADS.CLOSE' | translate" [attr.aria-label]="'CHAT.THREADS.CLOSE' | translate" (click)="closed.emit()">
					<nb-icon icon="close-outline"></nb-icon>
				</button>
			</header>
			<div class="body">
				@if (loading()) {
					<div class="loading" [nbSpinner]="true"></div>
				} @else if (error()) {
					<p class="empty">{{ 'CHAT.ERROR' | translate }} <button type="button" class="link-button" (click)="reload()">{{ 'CHAT.RETRY' | translate }}</button></p>
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
					<div class="divider" role="separator">
						<span>
							@if (root.replyCount === 1) {
								{{ 'CHAT.THREADS.REPLY_ONE' | translate }}
							} @else {
								{{ 'CHAT.THREADS.REPLIES' | translate: { count: root.replyCount } }}
							}
						</span>
					</div>
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
					@if (hasAfter()) {
						<button type="button" class="pill" data-test="load-more-replies" [disabled]="loadingMore()" (click)="loadMore()">
							{{ 'CHAT.THREADS.LOAD_MORE' | translate }}
						</button>
					}
				}
			</div>
			@if (!readOnly()) {
				<footer class="footer">
					<ngx-chat-message-composer
						[people]="people()"
						[conversationNames]="conversationNames()"
						[placeholder]="'CHAT.THREADS.REPLY_PLACEHOLDER' | translate"
						[disabled]="sending()"
						[everyone]="channelName() !== null"
						[memberIds]="memberIds()"
						[meEmployeeId]="meEmployeeId()"
						[editing]="editing() !== null"
						[initialBody]="editing()?.body ?? null"
						[draftKey]="draftKey()"
						[resetToken]="resetToken()"
						(submitted)="onSubmit($event)"
						(editCancelled)="editing.set(null)"
					></ngx-chat-message-composer>
					<nb-checkbox class="also" data-test="also-send" [(ngModel)]="alsoInConversation">
						{{ 'CHAT.THREADS.ALSO_SEND' | translate }}
						@if (channelName(); as name) {
							<strong>#{{ name }}</strong>
						}
					</nb-checkbox>
				</footer>
			}
		</aside>
	`,
	styles: [
		`
			:host {
				display: block;
				height: 100%;
				min-height: 0;
			}
			.thread {
				display: flex;
				flex-direction: column;
				height: 100%;
				min-height: 0;
				border-left: 1px solid var(--chat-border, rgba(127, 127, 127, 0.2));
				background: var(--chat-bg, transparent);
			}
			.header {
				display: flex;
				align-items: center;
				gap: 0.25rem;
				min-height: var(--chat-header-height, 3.5rem);
				padding: 0.375rem 0.625rem 0.375rem 1rem;
				border-bottom: 1px solid var(--chat-border, rgba(127, 127, 127, 0.2));
				flex: 0 0 auto;
			}
			.heading {
				display: flex;
				align-items: baseline;
				gap: 0.5rem;
				flex: 1 1 auto;
				min-width: 0;
			}
			.title {
				margin: 0;
				color: var(--chat-text, inherit);
				font-size: 0.9375rem;
				font-weight: 800;
			}
			.subtitle {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				color: var(--chat-muted, inherit);
				font-size: 0.75rem;
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
			}
			.icon-button nb-icon {
				font-size: 1.125rem;
			}
			.icon-button:hover,
			.icon-button:focus-visible {
				background: var(--chat-hover, rgba(127, 127, 127, 0.12));
				color: var(--chat-text, inherit);
			}
			.icon-button.on {
				color: var(--chat-accent, #3366ff);
			}
			.body {
				flex: 1 1 auto;
				min-height: 0;
				overflow-y: auto;
				padding: 0.25rem 0 0.75rem;
				scrollbar-width: thin;
			}
			.divider {
				display: flex;
				align-items: center;
				gap: 0.75rem;
				margin: 0.75rem 1.25rem 0.25rem;
				color: var(--chat-muted, inherit);
				font-size: 0.75rem;
				white-space: nowrap;
			}
			.divider::after {
				content: '';
				flex: 1 1 auto;
				border-top: 1px solid var(--chat-border, rgba(127, 127, 127, 0.2));
			}
			.pill {
				display: block;
				margin: 0.75rem auto;
				padding: 0.25rem 0.875rem;
				border: 1px solid var(--chat-border, rgba(127, 127, 127, 0.25));
				border-radius: 999px;
				background: transparent;
				color: var(--chat-text, inherit);
				font: inherit;
				font-size: 0.75rem;
				font-weight: 600;
				cursor: pointer;
			}
			.pill:hover:not(:disabled) {
				background: var(--chat-hover, rgba(127, 127, 127, 0.12));
			}
			.loading {
				min-height: 6rem;
			}
			.empty {
				margin: 1rem;
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
			.footer {
				padding: 0 1rem 0.5rem;
				flex: 0 0 auto;
			}
			.also {
				display: block;
				margin-top: 0.125rem;
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
	/** Who is in the thread's conversation, for the `@` list (null when not known). */
	readonly memberIds = input<ReadonlySet<string> | null>(null);

	readonly closed = output<void>();
	/**
	 * The root changed: its thread fields (reply count, last reply, follow state) after a reply, a follow or a poll,
	 * or the whole message after an edit, a delete, a pin or a reaction made here. The conversation applies the
	 * patch to its own copy, so a stale root held here never overwrites a newer body or deletion there.
	 */
	readonly rootChanged = output<ChatMessagePatch>();

	protected readonly root = signal<IChatMessageWithRelations | null>(null);
	protected readonly replies = signal<IChatMessageWithRelations[]>([]);
	/** More replies exist after the loaded ones. */
	protected readonly hasAfter = signal(false);
	protected readonly loading = signal(false);
	protected readonly loadingMore = signal(false);
	protected readonly error = signal(false);
	protected readonly sending = signal(false);
	protected readonly editing = signal<IChatMessageWithRelations | null>(null);
	protected readonly resetToken = signal(0);
	protected alsoInConversation = false;

	protected readonly replyCount = computed(() => this.replies().length);
	protected readonly draftKey = computed(() => `thread:${this.rootMessageId()}`);
	/** The channel the thread is in (direct conversations have no name to show). */
	protected readonly channelName = computed(() => this.conversationNames().get(String(this.conversationId())) ?? null);

	private poll: Subscription | null = null;
	/** Counts the visits of this pane (every root switch): a reply belongs to the visit it was made in. */
	private visit = 0;
	/** The last reply a thread read was sent for, so the same read is not sent twice. */
	private lastMarkedId: string | null = null;

	constructor() {
		effect(() => {
			this.rootMessageId();
			untracked(() => {
				this.visit += 1;
				this.stopPolling();
				this.editing.set(null);
				this.loadingMore.set(false);
				this.sending.set(false);
				this.lastMarkedId = null;
				this.reload();
			});
		});
		this.destroyRef.onDestroy(() => this.stopPolling());
	}

	private isCurrent(id: string): boolean {
		return this.rootMessageId() === id;
	}

	protected reload(): void {
		const id = this.rootMessageId();
		this.stopPolling();
		this.loading.set(true);
		this.error.set(false);
		this.api
			.thread(id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (page) => {
					if (!this.isCurrent(id)) return;
					this.root.set(page.root);
					this.replies.set(this.repliesOf(page, []));
					this.hasAfter.set(page.hasAfter);
					this.loading.set(false);
					this.markRead();
					this.startPolling();
				},
				error: () => {
					if (!this.isCurrent(id)) return;
					this.loading.set(false);
					this.error.set(true);
				}
			});
	}

	/** The next page of replies after the last loaded one. */
	protected loadMore(): void {
		const id = this.rootMessageId();
		const last = this.replies()[this.replies().length - 1];
		if (!last || this.loadingMore()) return;
		this.loadingMore.set(true);
		this.api
			.thread(id, { after: last.id })
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (page) => {
					if (!this.isCurrent(id)) return;
					this.replies.set(this.repliesOf(page, this.replies()));
					this.hasAfter.set(page.hasAfter);
					this.loadingMore.set(false);
					this.markRead();
				},
				error: () => {
					if (this.isCurrent(id)) this.loadingMore.set(false);
				}
			});
	}

	/** Newer replies than the last loaded one, while every loaded page is shown. */
	private startPolling(): void {
		this.stopPolling();
		const id = this.rootMessageId();
		this.poll = timer(CHAT_THREAD_POLL_MS, CHAT_THREAD_POLL_MS)
			.pipe(
				filter(() => typeof document === 'undefined' || !document.hidden),
				filter(() => !this.hasAfter()),
				switchMap(() => {
					const last = this.replies()[this.replies().length - 1];
					return this.api.thread(id, last ? { after: last.id } : {}).pipe(catchError(() => EMPTY));
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((page) => {
				if (!this.isCurrent(id)) return;
				const before = this.replies().length;
				this.replies.set(this.repliesOf(page, this.replies()));
				this.hasAfter.set(page.hasAfter);
				const root = this.root();
				if (root && page.root.replyCount !== root.replyCount) {
					const next = { ...root, replyCount: page.root.replyCount, lastReplyAt: page.root.lastReplyAt };
					this.root.set(next);
					this.rootChanged.emit(threadFieldsOf(next));
				}
				if (this.replies().length !== before) this.markRead();
			});
	}

	private stopPolling(): void {
		this.poll?.unsubscribe();
		this.poll = null;
	}

	private repliesOf(page: ChatThreadPage, existing: readonly IChatMessageWithRelations[]): IChatMessageWithRelations[] {
		return mergeMessages(
			existing,
			page.messages.filter((message) => message.id !== page.root.id)
		);
	}

	/** Marks the thread read once its newest loaded reply is shown (the API ignores a thread I do not follow). */
	private markRead(): void {
		if (typeof document !== 'undefined' && document.hidden) return;
		if (this.hasAfter()) return;
		const last = this.replies()[this.replies().length - 1];
		const lastId = last ? String(last.id) : 'root';
		if (this.lastMarkedId === lastId) return;
		this.lastMarkedId = lastId;
		const id = this.rootMessageId();
		this.api
			.markThreadRead(id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (result) => {
					if (result.updated) this.api.notifyChanged();
				},
				error: () => {
					if (this.isCurrent(id) && this.lastMarkedId === lastId) this.lastMarkedId = null;
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
		const id = this.rootMessageId();
		const following = !root.following;
		this.api
			.setFollowing(root.id, following)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: () => {
					this.api.notifyChanged();
					if (!this.isCurrent(id)) return;
					const next = { ...root, following };
					this.root.set(next);
					this.rootChanged.emit(threadFieldsOf(next));
				},
				error: (error) => this.fail(error)
			});
	}

	protected onSubmit(submission: ComposerSubmission): void {
		const root = this.root();
		if (!root) return;
		const id = this.rootMessageId();
		const visit = this.visit;
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
				if (!editing) this.api.notifyChanged();
				if (this.isCurrent(id)) {
					if (editing) {
						this.replace(result.message);
					} else {
						this.replies.set(mergeMessages(this.replies(), [result.message]));
						const current = this.root() ?? root;
						const next = { ...current, replyCount: current.replyCount + 1, lastReplyAt: result.message.createdAt, following: true };
						this.root.set(next);
						this.rootChanged.emit(threadFieldsOf(next));
						this.lastMarkedId = String(result.message.id);
					}
				}
				// Only the visit the reply was made in leaves edit mode and clears the box.
				if (visit !== this.visit) {
					if (!editing && !this.isCurrent(id)) clearDraft(`thread:${id}`);
					return;
				}
				this.sending.set(false);
				this.resetToken.update((value) => value + 1);
				if (editing) this.editing.set(null);
			},
			error: (error) => {
				if (visit !== this.visit) return;
				this.sending.set(false);
				this.fail(error, 'CHAT.COMPOSER.SEND_FAILED');
			}
		});
	}

	protected onAction(message: IChatMessageWithRelations, action: MessageAction): void {
		const id = this.rootMessageId();
		switch (action.kind) {
			case 'edit':
				// The root is edited like any reply: the edit route takes any message of mine.
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
							if (this.isCurrent(id)) this.replace(result.message);
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
		this.toastr.danger(apiErrorMessage(error) ?? this.translate.instant(fallbackKey));
	}
}
