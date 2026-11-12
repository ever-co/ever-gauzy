import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NbCheckboxModule, NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EMPTY, merge, Subject, Subscription } from 'rxjs';
import { auditTime, catchError, filter, switchMap } from 'rxjs/operators';
import { CHAT_EVENT_NAMES, IChatMessageWithRelations } from '@gauzy/contracts';
import { ToastrService } from '@gauzy/ui-core/core';
import { applyCatchUp, reconcileWithOldest, rootWithMyFields } from '../../chat-catch-up';
import { CHAT_LIVE_AUDIT_MS, CHAT_THREAD_POLL_MS } from '../../chat-ui.constants';
import { apiErrorMessage, ChatMemberIds, continuesGroup, mergeMessages, newNonce } from '../../chat-ui.helpers';
import { ChatHint } from '../../services/chat-live';
import { withTaskReference } from '../../chat-tasks';
import { ChatCreateTaskFlow } from '../../dialogs/chat-task-dialogs.component';
import { ChatFilesStore } from '../../services/chat-files.store';
import { ChatTasksService } from '../../services/chat-tasks.service';
import { ChatLiveService, isTabVisible } from '../../services/chat-live.service';
import { ChatPeople } from '../../services/chat-people.service';
import { ChatMessagePatch, ChatThreadPage, ChatUiService, threadFieldsOf } from '../../services/chat-ui.service';
import { clearDraft, ComposerSubmission, MessageComposerComponent } from '../message-composer/message-composer.component';
import { MessageAction, MessageItemComponent } from '../message-item/message-item.component';
import { TypingIndicatorComponent } from '../typing-indicator/typing-indicator.component';

/**
 * A thread: its root message, the replies (the first page, more on request, newer ones as the chat events announce
 * them, polling as the fallback), follow / unfollow, and a composer with "also send to the conversation". Showing
 * the replies marks the thread read. A reply or the root changed elsewhere is read again; a reconnect reads the
 * newer replies and the root again.
 * Every request captures the root it was made for and drops its answer when another thread is open by then.
 */
@Component({
	selector: 'ngx-chat-thread-pane',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbCheckboxModule, NbIconModule, NbSpinnerModule, NbTooltipModule, TranslatePipe, MessageComposerComponent, MessageItemComponent, TypingIndicatorComponent],
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
						[attr.aria-label]="'CHAT.THREADS.FOLLOW' | translate"
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
						[files]="files()"
						[tasks]="tasks()"
						[canCreateTask]="canCreateTask() && !readOnly()"
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
							[files]="files()"
							[tasks]="tasks()"
							[canCreateTask]="canCreateTask() && !readOnly()"
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
					<ngx-chat-typing-indicator
						[conversationId]="conversationId()"
						[threadRootId]="rootMessageId()"
						[people]="people()"
						[meUserId]="meUserId()"
					></ngx-chat-typing-indicator>
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
						[canAttach]="canAttach()"
						[keepsFiles]="!!editing()?.attachmentIds?.length"
						(submitted)="onSubmit($event)"
						(typing)="onTyping()"
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
	private readonly live = inject(ChatLiveService);
	private readonly filesStore = inject(ChatFilesStore);
	private readonly taskStore = inject(ChatTasksService);
	private readonly createTaskFlow = inject(ChatCreateTaskFlow);
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
	readonly memberIds = input<ChatMemberIds | null>(null);
	/** `DOCS_CREATE`: may attach files (stored as documents). */
	readonly canAttach = input(false);
	/** `ORG_TASK_ADD`: may create a task from the root or a reply. */
	readonly canCreateTask = input(false);
	/** The selected organization and its tenant, for the projects a task can be created in. */
	readonly organizationId = input<string | null>(null);
	readonly tenantId = input<string | null>(null);

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
	/** The conversation's files read so far, for the attachments of the root and the replies. */
	protected readonly files = this.filesStore.byDocument;
	/** The task summaries read so far, for the task cards. */
	protected readonly tasks = this.taskStore.summaries;
	protected readonly draftKey = computed(() => `thread:${this.rootMessageId()}`);
	/** The channel the thread is in (direct conversations have no name to show). */
	protected readonly channelName = computed(() => this.conversationNames().get(String(this.conversationId())) ?? null);

	private poll: Subscription | null = null;
	/** Asks the poll for the newer replies now (after a catch-up). */
	private readonly newerNow = new Subject<void>();
	/** Counts the catch-ups: only the latest one's answer is applied. */
	private catchUpRun = 0;
	/** A catch-up added replies: the thread is marked read after the newer replies were read too. */
	private readAfterNewer = false;
	/** The messages changed here since the latest catch-up began (a refresh, a deletion, my own action): its page does not overrule them. */
	private readonly touched = new Set<string>();
	/**
	 * The root's fields my own actions changed since the latest catch-up began (a reply sent: the reply count and the
	 * last reply; a follow change): the catch-up's root is applied with these on top, its other fields (an edit) kept.
	 */
	private rootFields: ChatMessagePatch = {};
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
		// A reply (or the root) that names a file not read yet reads the conversation's files.
		effect(() => {
			const id = this.conversationId();
			const root = this.root();
			const messages = (root ? [root, ...this.replies()] : this.replies()).filter((message) => String(message.conversationId) === id);
			untracked(() => {
				this.filesStore.ensureFor(id, messages);
				this.taskStore.ensure(messages.flatMap((message) => (message.taskReferences ?? []).map((reference) => String(reference.taskId))));
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

	/**
	 * Newer replies than the last loaded one, while every loaded page is shown: on a tick of the poll (every 5 s, or
	 * once a minute while live) and when a reply is created or the thread changes. A reply or the root changed
	 * elsewhere (edited, deleted, reacted to, pinned) is read again. After a reconnect (or the tab shown again) the
	 * root and the first page are read again and reconciled with what is loaded, then the newer replies.
	 */
	private startPolling(): void {
		this.stopPolling();
		const id = this.rootMessageId();
		const hints$ = this.live.hints$.pipe(filter((hint) => hint.threadRootId === id || hint.messageId === id));
		const newer$ = hints$.pipe(
			filter((hint) => hint.name === CHAT_EVENT_NAMES.MESSAGE_CREATED || hint.name === CHAT_EVENT_NAMES.THREAD_CHANGED),
			auditTime(CHAT_LIVE_AUDIT_MS)
		);
		const poll = merge(this.live.ticks(CHAT_THREAD_POLL_MS), newer$, this.newerNow)
			.pipe(
				filter(() => isTabVisible()),
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
				if (this.replies().length !== before || this.readAfterNewer) {
					this.readAfterNewer = false;
					this.markRead();
				}
			});
		poll.add(
			hints$
				.pipe(
					filter((hint) => hint.name === CHAT_EVENT_NAMES.MESSAGE_UPDATED || hint.name === CHAT_EVENT_NAMES.MESSAGE_DELETED),
					filter(() => isTabVisible()),
					takeUntilDestroyed(this.destroyRef)
				)
				.subscribe((hint) => {
					this.refreshMessage(id, hint);
					// A task changed from a card is told to the messages that show it: their cards read the task again.
					if (hint.name === CHAT_EVENT_NAMES.MESSAGE_UPDATED) this.taskStore.refreshShownBy([this.root(), ...this.replies()], String(hint.messageId));
				})
		);
		poll.add(this.live.catchUp$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.catchUp(id)));
		this.poll = poll;
	}

	/**
	 * The root and the first page again (the events of the gap are not replayed), then the newer replies. Only the
	 * latest catch-up's answer is applied, and it does not overrule what changed here while it ran: a reply shown
	 * meanwhile (a live event, my own reply), a reply refreshed or deleted by an event, the root refreshed. When every
	 * reply was loaded before, the newer ones are read from the last loaded reply, closing the gap however long.
	 */
	private catchUp(id: string): void {
		if (!this.isCurrent(id) || this.loading()) return;
		const run = ++this.catchUpRun;
		this.touched.clear();
		this.rootFields = {};
		const before = new Set(this.replies().map((reply) => String(reply.id)));
		const wasComplete = !this.hasAfter();
		this.api
			.thread(id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (page) => {
					if (!this.isCurrent(id) || run !== this.catchUpRun) return;
					if (!this.touched.has(String(page.root.id))) this.replace(rootWithMyFields(page.root, this.rootFields), false);
					// My reply went out while the read ran: neither count knows both, so the root's are read again now.
					if (this.rootFields.replyCount !== undefined) this.refreshRootCounts(id);
					const replies = { hasAfter: page.hasAfter, messages: page.messages.filter((message) => message.id !== page.root.id) };
					const result = applyCatchUp(this.replies(), before, this.touched, (loaded) => reconcileWithOldest(loaded, replies));
					this.replies.set(result.messages);
					// A task changed while no hint reached this tab (hidden, offline): its cards read it again (the replies new
					// to the pane have their tasks read by the pane's own effect).
					this.taskStore.refreshAll([this.root(), ...result.messages]);
					// Every reply was loaded: the poll reads from the last one. Otherwise the first page says what follows.
					if (!wasComplete && !result.beyond) this.hasAfter.set(page.hasAfter);
					// The thread is marked read once the newer replies are in too (the poll's answer), never before.
					if (result.added.length) this.readAfterNewer = true;
					this.newerNow.next();
				},
				error: () => undefined
			});
	}

	/** The root's reply count and last reply as the API has them now (after a reply crossed a catch-up). */
	private refreshRootCounts(id: string): void {
		this.api
			.thread(id, { limit: 1 })
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (page) => {
					const root = this.root();
					if (!this.isCurrent(id) || !root) return;
					this.replace({ id: root.id, replyCount: page.root.replyCount, lastReplyAt: page.root.lastReplyAt }, false);
				},
				error: () => undefined
			});
	}

	/**
	 * Reads the root or one loaded reply again: the root through the thread's first page, a reply through the window
	 * around it. A deleted reply leaves the list (a thread read leaves it out); a deleted root stays as its tombstone.
	 */
	private refreshMessage(id: string, hint: ChatHint): void {
		const messageId = String(hint.messageId);
		const isRoot = messageId === id;
		if (!isRoot && !this.replies().some((reply) => String(reply.id) === messageId)) return;
		this.api
			.thread(id, isRoot ? { limit: 1 } : { around: messageId, limit: 2 })
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (page) => {
					if (!this.isCurrent(id)) return;
					const fresh = isRoot ? page.root : page.messages.find((message) => String(message.id) === messageId);
					if (!fresh) return;
					if (!isRoot && fresh.deletedAt) {
						this.touched.add(messageId);
						this.replies.set(this.replies().filter((reply) => String(reply.id) !== messageId));
					} else this.replace(fresh);
				},
				error: () => undefined
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
					// A running catch-up does not overrule the follow state (only that field).
					this.rootFields = { ...this.rootFields, following };
					this.root.set(next);
					this.rootChanged.emit(threadFieldsOf(next));
				},
				error: (error) => this.fail(error)
			});
	}

	/** The person types a reply: the conversation's other members are told, for this thread (best effort). */
	protected onTyping(): void {
		this.api.signalTyping(this.conversationId(), this.rootMessageId());
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
					mentionEmployeeIds: submission.mentionEmployeeIds,
					...(submission.attachmentIds.length ? { attachmentIds: submission.attachmentIds } : {})
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
						// A running catch-up overrules neither the new reply nor the root's reply fields (its other fields it may).
						this.touched.add(String(result.message.id));
						this.rootFields = { ...this.rootFields, replyCount: next.replyCount, lastReplyAt: next.lastReplyAt, following: true };
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
			case 'createTask':
				this.createTaskFlow
					.open({ message, people: this.people(), conversationNames: this.conversationNames(), organizationId: this.organizationId(), tenantId: this.tenantId() })
					.pipe(takeUntilDestroyed(this.destroyRef))
					.subscribe((reference) => {
						if (!reference || !this.isCurrent(id)) return;
						// Added to the message as shown now (another reference may have come meanwhile).
						const root = this.root();
						const current = (root && root.id === message.id ? root : this.replies().find((item) => item.id === message.id)) ?? message;
						this.replace({ id: message.id, taskReferences: withTaskReference(current, reference).taskReferences });
					});
				return;
			case 'replaced':
				// An app's reply to a click on one of its buttons: the message as the reply left it.
				if (this.isCurrent(id)) this.replace(action.message);
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

	/** Puts a newer version of the root or a reply in place; `touch` keeps a running catch-up from overruling it. */
	private replace(message: ChatMessagePatch, touch = true): void {
		if (touch && message.id) this.touched.add(String(message.id));
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
