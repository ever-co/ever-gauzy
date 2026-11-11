import {
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	effect,
	ElementRef,
	inject,
	input,
	output,
	signal,
	untracked,
	viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbDialogService, NbIconModule, NbSelectModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EMPTY, merge, Subscription } from 'rxjs';
import { auditTime, catchError, filter, switchMap } from 'rxjs/operators';
import {
	CHAT_EVENT_NAMES,
	ChatConversationKindEnum,
	ChatNotifyLevelEnum,
	IChatCategory,
	IChatConversationWithState,
	IChatMemberState,
	IChatMessageWithRelations
} from '@gauzy/contracts';
import { ToastrService } from '@gauzy/ui-core/core';
import { applyCatchUp, reconcileWithNewest } from '../../chat-catch-up';
import { canManageConversation } from '../../chat-categories';
import { withTaskReference } from '../../chat-tasks';
import { CHAT_LIVE_AUDIT_MS, CHAT_MESSAGES_POLL_MS } from '../../chat-ui.constants';
import { apiErrorMessage, continuesGroup, conversationTitle, mergeMessages, newNonce } from '../../chat-ui.helpers';
import { ChatCreateTaskFlow } from '../../dialogs/chat-task-dialogs.component';
import { ChannelSettingsContext, ChannelSettingsDialogComponent } from '../../dialogs/chat-settings-dialogs.component';
import { ChatFilesStore } from '../../services/chat-files.store';
import { ChatLiveService, isTabVisible } from '../../services/chat-live.service';
import { ChatPeople } from '../../services/chat-people.service';
import { ChatTasksService } from '../../services/chat-tasks.service';
import { ChatEvents, ChatMessagePatch, ChatUiService, memberStateFromEvents } from '../../services/chat-ui.service';
import { FilesPanelComponent } from '../files-panel/files-panel.component';
import { clearDraft, ComposerSubmission, MessageComposerComponent } from '../message-composer/message-composer.component';
import { MessageAction, MessageItemComponent } from '../message-item/message-item.component';

/** How close to the bottom (px) counts as "reading the latest", for auto-scroll and read-on-view. */
const NEAR_BOTTOM_PX = 80;

/**
 * One conversation: its header (title, members, favourite, notifications, join / leave, archive, pins), the
 * messages (newest page first, older on scroll, newer as the chat events announce them), and the composer. Reading
 * the latest loaded message marks the conversation read up to it (never past what is shown); "mark unread from
 * here" is explicit.
 *
 * Live: a message created in the conversation fetches the newer ones, a message changed or deleted (an edit, a
 * reaction, a pin, a reply to its thread) is read again, and after a reconnect the newest page is read again (the
 * events of the gap are not replayed). Polling stays the fallback: every 5 s as before while the events do not
 * arrive live (`ChatLiveService.mode$`), once a minute as a safety net while they do.
 *
 * Every request captures the conversation it was made for and drops its answer when another one is open by
 * then; the poll stops the moment the conversation changes. A send also captures the visit it was made in, so a
 * send that lands after the person left and came back merges its message but never clears what they are typing now.
 */
@Component({
	selector: 'ngx-chat-conversation-view',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		FormsModule,
		NbButtonModule,
		NbIconModule,
		NbSelectModule,
		NbSpinnerModule,
		NbTooltipModule,
		TranslatePipe,
		FilesPanelComponent,
		MessageComposerComponent,
		MessageItemComponent
	],
	template: `
		<section class="view" data-test="conversation-view">
			<header class="header">
				<div class="heading">
					<h5 class="title">{{ title() }}</h5>
					@if (conversation().topic) {
						<span class="topic">{{ conversation().topic }}</span>
					}
					<button type="button" class="members" data-test="members" [disabled]="!isMember()" [attr.aria-label]="'CHAT.SETTINGS.MEMBERS_OPEN' | translate" (click)="openSettings('members')">
						{{ 'CHAT.LIST.MEMBERS' | translate: { count: conversation().memberCount } }}
					</button>
				</div>
				<div class="actions">
					<button nbButton ghost size="tiny" type="button" data-test="favorite" [nbTooltip]="(state()?.isFavorite ? 'CHAT.VIEW.UNFAVORITE' : 'CHAT.VIEW.FAVORITE') | translate" [attr.aria-label]="(state()?.isFavorite ? 'CHAT.VIEW.UNFAVORITE' : 'CHAT.VIEW.FAVORITE') | translate" (click)="toggleFavorite()">
						<nb-icon [icon]="state()?.isFavorite ? 'star' : 'star-outline'"></nb-icon>
					</button>
					@if (isMember()) {
						<nb-select size="tiny" data-test="notify-level" [selected]="state()?.notifyLevel ?? 'all'" (selectedChange)="setNotifyLevel($event)" [placeholder]="'CHAT.VIEW.NOTIFY' | translate">
							<nb-option value="all">{{ 'CHAT.VIEW.NOTIFY_ALL' | translate }}</nb-option>
							<nb-option value="mentions">{{ 'CHAT.VIEW.NOTIFY_MENTIONS' | translate }}</nb-option>
							<nb-option value="muted">{{ 'CHAT.VIEW.NOTIFY_MUTED' | translate }}</nb-option>
						</nb-select>
					}
					<button nbButton ghost size="tiny" type="button" data-test="pins" [class.active]="pinsOpen()" [nbTooltip]="'CHAT.VIEW.PINNED' | translate" [attr.aria-label]="'CHAT.VIEW.PINNED' | translate" (click)="togglePins()">
						<nb-icon icon="pin-outline"></nb-icon>
					</button>
					<button nbButton ghost size="tiny" type="button" data-test="files" [class.active]="filesOpen()" [nbTooltip]="'CHAT.FILES.TITLE' | translate" [attr.aria-label]="'CHAT.FILES.TITLE' | translate" (click)="filesOpen.set(!filesOpen())">
						<nb-icon icon="attach-2-outline"></nb-icon>
					</button>
					@if (!isMember()) {
						<button nbButton status="primary" size="tiny" type="button" data-test="join" (click)="join()">{{ 'CHAT.VIEW.JOIN' | translate }}</button>
					} @else if (canLeave()) {
						<button nbButton ghost size="tiny" type="button" data-test="leave" (click)="leave()">{{ 'CHAT.VIEW.LEAVE' | translate }}</button>
					}
					@if (isMember()) {
						<button nbButton ghost size="tiny" type="button" data-test="settings" [nbTooltip]="'CHAT.SETTINGS.TITLE' | translate" [attr.aria-label]="'CHAT.SETTINGS.TITLE' | translate" (click)="openSettings()">
							<nb-icon icon="settings-2-outline"></nb-icon>
						</button>
					}
					@if (canManage() && conversation().kind === 'channel') {
						<button nbButton ghost size="tiny" type="button" data-test="archive" (click)="toggleArchived()">
							{{ (conversation().archivedAt ? 'CHAT.VIEW.UNARCHIVE' : 'CHAT.VIEW.ARCHIVE') | translate }}
						</button>
					}
				</div>
			</header>

			@if (pinsOpen()) {
				<aside class="pins" data-test="pins-panel">
					<h6>{{ 'CHAT.VIEW.PINNED' | translate }}</h6>
					@for (pin of pins(); track pin.id) {
						<ngx-chat-message-item
							[message]="pin"
							[people]="people()"
							[files]="files()"
							[tasks]="tasks()"
							[conversationNames]="conversationNames()"
							[meEmployeeId]="meEmployeeId()"
							[meUserId]="meUserId()"
							[readOnly]="true"
							[showThreadSummary]="false"
						></ngx-chat-message-item>
					} @empty {
						<p class="empty">{{ 'CHAT.VIEW.NO_PINS' | translate }}</p>
					}
				</aside>
			}

			@if (filesOpen()) {
				<ngx-chat-files-panel [conversationId]="conversationIdText()" [people]="people()"></ngx-chat-files-panel>
			}

			<div #scroller class="messages" data-test="messages" (scroll)="onScroll()">
				@if (hasBefore()) {
					<button nbButton ghost size="tiny" type="button" class="older" data-test="load-older" [disabled]="loadingOlder()" (click)="loadOlder()">
						{{ 'CHAT.VIEW.LOAD_OLDER' | translate }}
					</button>
				}
				@if (loading()) {
					<div class="loading" [nbSpinner]="true"></div>
				} @else if (error()) {
					<p class="empty">{{ 'CHAT.ERROR' | translate }} <button nbButton ghost size="tiny" type="button" (click)="reload()">{{ 'CHAT.RETRY' | translate }}</button></p>
				} @else if (messages().length === 0) {
					<p class="empty">{{ 'CHAT.VIEW.EMPTY' | translate }}</p>
				}
				@for (message of messages(); track message.id; let index = $index) {
					<ngx-chat-message-item
						[message]="message"
						[people]="people()"
						[files]="files()"
						[tasks]="tasks()"
						[canCreateTask]="canCreateTask() && !readOnly()"
						[conversationNames]="conversationNames()"
						[meEmployeeId]="meEmployeeId()"
						[meUserId]="meUserId()"
						[continued]="continues(index)"
						[canManage]="canManage()"
						[readOnly]="readOnly()"
						[highlighted]="message.id === highlightId()"
						(action)="onAction(message, $event)"
					></ngx-chat-message-item>
				}
				@if (hasAfter()) {
					<button nbButton ghost size="tiny" type="button" class="older" data-test="jump-to-latest" (click)="jumpToLatest()">
						{{ 'CHAT.VIEW.JUMP_TO_LATEST' | translate }}
					</button>
				}
			</div>

			@if (newBelow()) {
				<button nbButton status="primary" size="tiny" type="button" class="new-below" data-test="new-below" (click)="scrollToBottom(true)">
					<nb-icon icon="arrow-downward-outline"></nb-icon> {{ 'CHAT.VIEW.NEW_MESSAGES' | translate }}
				</button>
			}

			<footer class="footer">
				@if (conversation().archivedAt) {
					<p class="notice">{{ 'CHAT.VIEW.ARCHIVED' | translate }}</p>
				} @else if (isMember()) {
					<ngx-chat-message-composer
						[people]="people()"
						[conversationNames]="conversationNames()"
						[placeholder]="'CHAT.COMPOSER.PLACEHOLDER' | translate: { name: title() }"
						[disabled]="sending()"
						[editing]="editing() !== null"
						[initialBody]="editing()?.body ?? null"
						[draftKey]="draftKey()"
						[resetToken]="resetToken()"
						[canAttach]="canAttach()"
						(submitted)="onSubmit($event)"
						(editCancelled)="editing.set(null)"
					></ngx-chat-message-composer>
				}
			</footer>
		</section>
	`,
	styles: [
		`
			.view {
				position: relative;
				display: flex;
				flex-direction: column;
				height: 100%;
				min-height: 0;
			}
			.header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.5rem;
				padding: 0.5rem 0.75rem;
				border-bottom: 1px solid rgba(127, 127, 127, 0.2);
			}
			.heading {
				display: flex;
				align-items: baseline;
				gap: 0.5rem;
				min-width: 0;
				flex-wrap: wrap;
			}
			.title {
				margin: 0;
				font-size: 1rem;
			}
			.topic,
			.members {
				font-size: 0.75rem;
				opacity: 0.7;
			}
			.members {
				padding: 0;
				border: 0;
				background: transparent;
				color: inherit;
				cursor: pointer;
			}
			.members:disabled {
				cursor: default;
			}
			.members:not(:disabled):hover,
			.members:not(:disabled):focus-visible {
				text-decoration: underline;
				opacity: 1;
			}
			.actions {
				display: flex;
				align-items: center;
				gap: 0.25rem;
				flex: 0 0 auto;
			}
			.pins {
				max-height: 40%;
				overflow-y: auto;
				padding: 0.5rem 0;
				border-bottom: 1px solid rgba(127, 127, 127, 0.2);
				background: rgba(127, 127, 127, 0.05);
			}
			.pins h6 {
				margin: 0 0.75rem 0.25rem;
				font-size: 0.75rem;
				text-transform: uppercase;
				opacity: 0.7;
			}
			.messages {
				flex: 1 1 auto;
				min-height: 0;
				overflow-y: auto;
				padding: 0.5rem 0;
			}
			.older {
				display: block;
				margin: 0 auto 0.5rem;
			}
			.loading {
				min-height: 6rem;
			}
			.empty {
				margin: 1rem 0.75rem;
				font-size: 0.875rem;
				opacity: 0.7;
			}
			.new-below {
				position: absolute;
				left: 50%;
				bottom: 6rem;
				transform: translateX(-50%);
				z-index: 5;
			}
			.footer {
				padding: 0.5rem 0.75rem 0.75rem;
				border-top: 1px solid rgba(127, 127, 127, 0.2);
			}
			.notice {
				margin: 0;
				font-size: 0.8125rem;
				opacity: 0.7;
			}
		`
	]
})
export class ConversationViewComponent {
	private readonly api = inject(ChatUiService);
	private readonly live = inject(ChatLiveService);
	private readonly filesStore = inject(ChatFilesStore);
	private readonly taskStore = inject(ChatTasksService);
	private readonly dialog = inject(NbDialogService);
	private readonly createTaskFlow = inject(ChatCreateTaskFlow);
	private readonly toastr = inject(ToastrService);
	private readonly translate = inject(TranslateService);
	private readonly destroyRef = inject(DestroyRef);

	readonly conversation = input.required<IChatConversationWithState>();
	readonly people = input.required<ChatPeople>();
	readonly conversationNames = input<ReadonlyMap<string, string>>(new Map());
	readonly meEmployeeId = input<string | null>(null);
	readonly meUserId = input<string | null>(null);
	/** `CHAT_MANAGE`: acts as a manager everywhere. */
	readonly isAdmin = input(false);
	/** `DOCS_CREATE`: may attach files (stored as documents). */
	readonly canAttach = input(false);
	/** `ORG_TASK_ADD`: may create a task from a message. */
	readonly canCreateTask = input(false);
	/** The organization's sidebar categories (a channel's settings put it under one). */
	readonly categories = input<readonly IChatCategory[]>([]);
	/** The selected organization and its tenant, for the projects a task can be created in. */
	readonly organizationId = input<string | null>(null);
	readonly tenantId = input<string | null>(null);
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
	protected readonly filesOpen = signal(false);
	/** The conversation's files read so far, for the attachments of the messages shown. */
	protected readonly files = this.filesStore.byDocument;
	/** The task summaries read so far, for the task cards. */
	protected readonly tasks = this.taskStore.summaries;
	protected readonly conversationIdText = computed(() => String(this.conversation().id));
	/** The caller's state, kept here so a read / favourite change shows at once. */
	protected readonly state = signal<IChatMemberState | null>(null);

	protected readonly title = computed(() => conversationTitle(this.conversation(), this.people().byEmployee, this.meEmployeeId(), this.untitled()));
	protected readonly isMember = computed(() => this.state() !== null);
	protected readonly canLeave = computed(() => this.isMember() && !this.conversation().isDefault && this.conversation().kind !== ChatConversationKindEnum.DIRECT);
	protected readonly canManage = computed(() => canManageConversation({ ...this.conversation(), state: this.state() }, this.meEmployeeId(), this.isAdmin()));
	protected readonly readOnly = computed(() => !!this.conversation().archivedAt || !this.isMember());
	protected readonly draftKey = computed(() => `conversation:${this.conversation().id}`);

	private poll: Subscription | null = null;
	private loadedId: string | null = null;
	/** Counts the visits of this view (every conversation switch): a send belongs to the visit it was made in. */
	private visit = 0;
	/** Counts the catch-ups: only the latest one's answer is applied. */
	private catchUpRun = 0;
	/** The messages changed here since the latest catch-up began (a refresh, a deletion, my own action): its page does not overrule them. */
	private readonly touched = new Set<string>();
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
					this.filesOpen.set(false);
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
		// A message that names a file not read yet reads the conversation's files (the pins too); only the messages of
		// the open conversation count (a switch shows the previous one's for a moment).
		effect(() => {
			const id = String(this.conversation().id);
			const messages = [...this.messages(), ...this.pins()].filter((message) => String(message.conversationId) === id);
			untracked(() => {
				this.filesStore.ensureFor(id, messages);
				this.taskStore.ensure(messages.flatMap((message) => (message.taskReferences ?? []).map((reference) => String(reference.taskId))));
			});
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
		const highlight = this.highlightId();
		this.api
			.messages(id, highlight ? { around: highlight } : {})
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (page) => {
					if (!this.isCurrent(id)) return;
					this.messages.set(mergeMessages([], page.messages));
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

	/**
	 * Newer messages: on a tick of the poll (every 5 s, or once a minute while live) and when a message is created in
	 * the conversation; a changed message is read again; a reconnect reads the newest page again.
	 */
	private startPolling(): void {
		this.stopPolling();
		const id = String(this.conversation().id);
		const hints$ = this.live.hints$.pipe(filter((hint) => hint.conversationId === id));
		const created$ = hints$.pipe(
			filter((hint) => hint.name === CHAT_EVENT_NAMES.MESSAGE_CREATED),
			auditTime(CHAT_LIVE_AUDIT_MS)
		);
		const poll = merge(this.live.ticks(CHAT_MESSAGES_POLL_MS), created$)
			.pipe(
				filter(() => isTabVisible()),
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
				this.showNewer(page.messages);
			});
		poll.add(
			hints$
				.pipe(
					filter((hint) => hint.name !== CHAT_EVENT_NAMES.MESSAGE_CREATED && !!hint.messageId),
					filter(() => isTabVisible()),
					takeUntilDestroyed(this.destroyRef)
				)
				.subscribe((hint) => this.refreshMessage(id, String(hint.messageId)))
		);
		poll.add(this.live.catchUp$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.catchUp(id)));
		this.poll = poll;
	}

	/** Appends newer messages: followed to the bottom when the person reads the latest, announced otherwise. */
	private showNewer(messages: IChatMessageWithRelations[]): void {
		const wasNearBottom = this.isNearBottom();
		this.messages.set(mergeMessages(this.messages(), messages));
		if (wasNearBottom) {
			queueMicrotask(() => this.scrollToBottom(false));
			this.markReadIfVisible();
		} else {
			this.newBelow.set(true);
		}
	}

	/**
	 * Reads one loaded message again (edited, deleted, reacted to, pinned, its thread changed): the window around it
	 * answers it with its relations. A message deleted without replies leaves the list, as a reload would show it.
	 */
	private refreshMessage(conversationId: string, messageId: string): void {
		if (!this.messages().some((message) => String(message.id) === messageId)) return;
		this.api
			.messages(conversationId, { around: messageId, limit: 2 })
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (page) => {
					if (!this.isCurrent(conversationId)) return;
					const fresh = page.messages.find((message) => String(message.id) === messageId);
					if (!fresh) return;
					if (fresh.deletedAt && !fresh.replyCount) {
						this.touched.add(messageId);
						this.messages.set(this.messages().filter((message) => String(message.id) !== messageId));
					} else this.replace(fresh);
				},
				error: () => undefined
			});
	}

	/**
	 * After a reconnect, or when the tab is shown again: the newest page, read again. Where it still reaches the last
	 * loaded message it is the truth over its span (edits, reactions and pins of the gap applied, deleted messages
	 * gone, new ones appended; see `reconcileWithNewest`); where it does not (more was written meanwhile than a page
	 * holds), it replaces the list, the older messages a scroll away again. Older loaded messages stay as they were.
	 */
	private catchUp(id: string): void {
		if (!this.isCurrent(id) || this.hasAfter() || this.loading()) return;
		// What is loaded when the read starts: a message shown while it runs (a live event, my own send), or changed
		// here meanwhile (refreshed, deleted, my own edit), is newer than the page may know and stays as it is now.
		const run = ++this.catchUpRun;
		this.touched.clear();
		const before = new Set(this.messages().map((message) => String(message.id)));
		this.api
			.messages(id, {})
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (page) => {
					if (!this.isCurrent(id) || this.hasAfter() || run !== this.catchUpRun) return;
					const wasNearBottom = this.isNearBottom();
					const result = applyCatchUp(this.messages(), before, this.touched, (loaded) => reconcileWithNewest(loaded, page));
					this.messages.set(result.messages);
					if (result.replaced) this.hasBefore.set(page.hasBefore);
					if (!result.added.length) return;
					if (wasNearBottom) {
						queueMicrotask(() => this.scrollToBottom(false));
						this.markReadIfVisible();
					} else {
						this.newBelow.set(true);
					}
				},
				error: () => undefined
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
			.send(id, {
				body: submission.body,
				nonce: newNonce(),
				mentionEmployeeIds: submission.mentionEmployeeIds,
				...(submission.attachmentIds.length ? { attachmentIds: submission.attachmentIds } : {})
			})
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (result) => {
					this.api.notifyChanged();
					if (this.isCurrent(id)) {
						this.messages.set(mergeMessages(this.messages(), [result.message]));
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
			case 'createTask':
				this.openCreateTask(message);
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

	/** "Create task from message": the dialog, then the message shows the task's card. */
	private openCreateTask(message: IChatMessageWithRelations): void {
		const id = String(this.conversation().id);
		this.createTaskFlow
			.open({
				message,
				people: this.people(),
				conversationNames: this.conversationNames(),
				organizationId: this.organizationId() ?? (this.conversation().organizationId ? String(this.conversation().organizationId) : null),
				tenantId: this.tenantId()
			})
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((reference) => {
				if (!reference || !this.isCurrent(id)) return;
				// Added to the message as shown now (another reference may have come meanwhile).
				const current = this.messages().find((item) => item.id === message.id) ?? message;
				this.replace({ id: message.id, taskReferences: withTaskReference(current, reference).taskReferences });
			});
	}

	/** The conversation's settings and members (`section`: where the dialog opens); a change comes back as the conversation. */
	protected openSettings(section: 'settings' | 'members' = 'settings'): void {
		const id = String(this.conversation().id);
		const context: ChannelSettingsContext = {
			conversation: { ...this.conversation(), state: this.state() },
			categories: this.categories(),
			people: this.people(),
			meEmployeeId: this.meEmployeeId(),
			canManage: this.canManage(),
			section
		};
		this.dialog
			.open(ChannelSettingsDialogComponent, { context: { context } })
			.onClose.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((conversation: IChatConversationWithState | null | undefined) => {
				if (conversation && this.isCurrent(id)) this.conversationChanged.emit(conversation);
			});
	}

	/** Puts the API's version of a message (or the fields of it that changed) in place of ours. */
	private replace(message: ChatMessagePatch): void {
		// A running catch-up does not overrule it.
		if (message.id) this.touched.add(String(message.id));
		this.messages.set(this.messages().map((item) => (item.id === message.id ? { ...item, ...message } : item)));
	}

	private fail(error: unknown, fallbackKey = 'CHAT.DIALOG.FAILED'): void {
		this.toastr.danger(apiErrorMessage(error) ?? this.translate.instant(fallbackKey));
	}
}
