import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, LOCALE_ID, type Signal, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NbIconModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EMPTY, merge, Observable, of, Subscription } from 'rxjs';
import { auditTime, catchError, distinctUntilChanged, filter, map, switchMap, tap } from 'rxjs/operators';
import { CHAT_EVENT_NAMES, IChatConversationWithState, IChatMessageWithRelations, IOrganization, IUser, PermissionsEnum } from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { CHAT_DOCK_PAGE_SIZE, CHAT_LINK, CHAT_LIVE_AUDIT_MS, CHAT_MESSAGES_POLL_MS } from '../../chat-ui.constants';
import { canManageConversation } from '../../chat-categories';
import { withTaskReference } from '../../chat-tasks';
import { apiErrorMessage, ChatPerson, continuesGroup, isSameDay, memberEmployeeIds, mergeMessages, newNonce, showNewestPage, userName } from '../../chat-ui.helpers';
import { ChatCreateTaskFlow } from '../../dialogs/chat-task-dialogs.component';
import { ChatDockService } from '../../services/chat-dock.service';
import { ChatFilesStore } from '../../services/chat-files.store';
import { coalesceReads } from '../../services/chat-live';
import { ChatLiveService, isTabVisible } from '../../services/chat-live.service';
import { ChatPeople, ChatPeopleService, EMPTY_PEOPLE } from '../../services/chat-people.service';
import { ChatTasksService } from '../../services/chat-tasks.service';
import { ChatMessagePatch, ChatUiService } from '../../services/chat-ui.service';
import { clearDraft, ComposerSubmission, MessageComposerComponent } from '../message-composer/message-composer.component';
import { MessageAction, MessageItemComponent } from '../message-item/message-item.component';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';

/** A message of the card with its day divider and whether it continues the previous author's group, as in the chat. */
interface DockRow {
	message: IChatMessageWithRelations;
	day: string | null;
	continued: boolean;
}

/**
 * The docked message card (`ChatDockService`): a small card at the bottom right of the screen to write one person
 * directly. A box to write and a way to the full conversation, as a quick-message card; above them, who it is and,
 * once there is something to read, the latest messages of our conversation, shown as the chat shows them. The
 * conversation is found (or created) when the card opens; its newest page is read again as its chat events come (or
 * on the chat's poll where they do not stream), so a message written, edited or deleted elsewhere shows, and it is
 * marked read up to the last message on screen.
 */
@Component({
	selector: 'ngx-chat-dock',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbIconModule, TranslatePipe, PersonAvatarComponent, MessageComposerComponent, MessageItemComponent],
	template: `
		@if (person(); as who) {
			<section class="panel" role="dialog" [attr.aria-label]="who.name" data-test="chat-dock" (keydown.escape)="onEscape($event)">
				<header class="head">
					<ngx-chat-person-avatar [person]="who" [round]="true"></ngx-chat-person-avatar>
					<div class="identity">
						<span class="name" [attr.title]="who.name">{{ who.name }}</span>
						@if (who.position) {
							<span class="position" [attr.title]="who.position">{{ who.position }}</span>
						}
					</div>
					<button type="button" class="icon-button" data-test="chat-dock-close" [attr.aria-label]="'CHAT.VIEW.CLOSE' | translate" (click)="close()">
						<nb-icon icon="close-outline" aria-hidden="true"></nb-icon>
					</button>
				</header>

				@if (failed()) {
					<p class="note">{{ 'CHAT.ERROR' | translate }}</p>
				} @else if (rows().length > 0) {
					<!--
						The messages as the conversation shows them (its own message component) with its toolbar: react, create a
						task, pin, edit, mark unread, delete here; a thread opens in the chat.
					-->
					<div #scroller class="messages" data-test="chat-dock-messages">
						@for (row of rows(); track row.message.id) {
							@if (row.day) {
								<div class="day-divider" role="separator"><span>{{ row.day }}</span></div>
							}
							<ngx-chat-message-item
								[message]="row.message"
								[people]="dockPeople()"
								[files]="files()"
								[tasks]="tasks()"
								[canCreateTask]="canCreateTask() && !readOnly()"
								[meEmployeeId]="me()?.employeeId || null"
								[meUserId]="me()?.userId ?? null"
								[continued]="row.continued"
								[canManage]="canManage()"
								[readOnly]="readOnly()"
								[highlighted]="row.message.id === editing()?.id"
								(action)="onAction(row.message, $event)"
							></ngx-chat-message-item>
						}
					</div>
				}

				<!-- The chat's own composer, as in the conversation: formatting, mentions, emoji, files, and its draft. -->
				<div class="write">
					<ngx-chat-message-composer
						data-test="chat-dock-composer"
						[people]="dockPeople()"
						[placeholder]="'CHAT.PROFILE.MESSAGE_PLACEHOLDER' | translate: { name: who.name }"
						[disabled]="sending() || !conversation() || readOnly()"
						[memberIds]="memberIds()"
						[meEmployeeId]="me()?.employeeId || null"
						[editing]="editing() !== null"
						[initialBody]="editing()?.body ?? null"
						[keepsFiles]="!!editing()?.attachmentIds?.length"
						[draftKey]="draftKey()"
						[resetToken]="resetToken()"
						[canAttach]="canAttach()"
						(submitted)="send($event)"
						(typing)="onTyping()"
						(editCancelled)="editing.set(null)"
					></ngx-chat-message-composer>
				</div>

				<button type="button" class="open" data-test="chat-dock-open" [disabled]="!conversation()" (click)="openInChat()">
					<span>{{ 'CHAT.DIALOG.OPEN_DIRECT' | translate }}</span>
					<nb-icon icon="arrow-forward-outline" aria-hidden="true"></nb-icon>
				</button>
			</section>
		}
	`,
	styles: [
		`
			:host {
				display: block;
			}
			/*
			 * Three bands one above the other, split by hairlines: who it is, the latest messages (once there are any)
			 * with the box to write, and the way to the full conversation. Colours come from the theme's tokens only; the
			 * chat's shared components (messages, composer) keep their own defaults behind each --chat-* variable they read,
			 * for a theme that lacks one of these tokens.
			 */
			.panel {
				--dock-line: var(--gauzy-border-default-color);
				--dock-muted: var(--gauzy-text-color-2);
				--dock-hover: var(--gauzy-hover-tint);
				--dock-accent: var(--color-primary-default);
				/* The chat page's colours, for the messages and the composer it shares with the conversation. */
				--chat-bg: var(--gauzy-card-1, var(--card-background-color));
				--chat-raised: var(--gauzy-card-1, var(--card-background-color));
				--chat-border: var(--gauzy-border-default-color);
				--chat-border-strong: var(--border-basic-color-4);
				--chat-hover: var(--gauzy-hover-tint);
				--chat-active-tint: var(--gauzy-active-tint);
				--chat-elevated: var(--gauzy-sidebar-background-3);
				--chat-message-hover: var(--gauzy-sidebar-background-4);
				--chat-composer-bar: var(--gauzy-sidebar-background-4);
				--chat-reaction-bg: var(--gauzy-sidebar-background-3);
				--chat-code-bg: var(--gauzy-sidebar-background-3);
				--chat-text: var(--text-basic-color);
				--chat-text-soft: var(--text-hint-color);
				--chat-muted: var(--text-hint-color);
				--chat-accent: var(--color-primary-default);
				--chat-accent-soft: var(--color-primary-transparent-100);
				--chat-accent-soft-2: var(--color-primary-transparent-200);
				--chat-on-accent: var(--text-control-color);
				--chat-send: var(--color-primary-default);
				--chat-link: var(--text-primary-color);
				--chat-mention-chip-bg: var(--color-primary-transparent-200);
				--chat-mention-chip-text: var(--text-primary-color);
				--chat-danger: var(--color-danger-default);
				display: flex;
				flex-direction: column;
				/* The width of a docked chat window (room for the composer's emoji panel too). */
				width: 25rem;
				max-width: calc(100vw - 2rem);
				border: 1px solid var(--dock-line);
				/* A floating panel: the theme's radius, scaled as the chat page scales its panels. */
				border-radius: calc(var(--border-radius) * 2);
				background: var(--gauzy-card-1);
				box-shadow: 0 0.25rem 1.5rem rgba(0, 0, 0, 0.2);
				color: var(--gauzy-text-color-1, inherit);
			}
			.head {
				display: flex;
				align-items: center;
				gap: 0.625rem;
				min-width: 0;
				padding: 0.75rem 0.75rem 0.75rem 1.25rem;
				border-bottom: 1px solid var(--dock-line);
			}
			.identity {
				flex: 1 1 auto;
				display: flex;
				flex-direction: column;
				min-width: 0;
			}
			.name,
			.position {
				overflow: hidden;
				white-space: nowrap;
				text-overflow: ellipsis;
			}
			.name {
				font-size: 0.875rem;
				font-weight: 600;
				line-height: 1.25rem;
			}
			.position {
				color: var(--dock-muted);
				font-size: 0.75rem;
				line-height: 1rem;
			}
			.icon-button {
				display: inline-flex;
				flex: 0 0 auto;
				align-items: center;
				justify-content: center;
				width: 1.75rem;
				height: 1.75rem;
				padding: 0;
				border: 0;
				border-radius: calc(var(--border-radius) * 1.25);
				background: transparent;
				color: var(--dock-muted);
				cursor: pointer;
				transition: background-color 0.1s ease, color 0.1s ease;
			}
			.icon-button nb-icon {
				font-size: 1.125rem;
			}
			.icon-button:hover,
			.icon-button:focus-visible {
				background: var(--dock-hover);
				color: var(--gauzy-text-color-1, inherit);
			}
			/* The way to the full conversation: a quiet row along the bottom, its words at the start, the arrow at the end. */
			.open {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.5rem;
				width: 100%;
				padding: 0.625rem 1.25rem;
				border: 0;
				border-top: 1px solid var(--dock-line);
				/* The card does not clip (the composer's lists open above it): the row rounds its own corners, as the card's. */
				border-radius: 0 0 calc(var(--border-radius) * 2) calc(var(--border-radius) * 2);
				background: transparent;
				color: var(--dock-muted);
				font: inherit;
				font-size: 0.8125rem;
				line-height: 1.25rem;
				text-align: left;
				cursor: pointer;
				transition: background-color 0.1s ease, color 0.1s ease;
			}
			.open nb-icon {
				font-size: 1rem;
			}
			.open:hover:not(:disabled),
			.open:focus-visible {
				background: var(--dock-hover);
				color: var(--gauzy-text-color-1, inherit);
			}
			.open:focus-visible,
			.icon-button:focus-visible {
				outline: 2px solid var(--dock-accent);
				outline-offset: -2px;
			}
			.open:disabled {
				cursor: default;
				opacity: 0.5;
			}
			/*
			 * The latest messages, drawn by the conversation's own message component (it brings its own side padding,
			 * which the card's other bands match). The newest stays in sight.
			 */
			.messages {
				position: relative;
				/* Room for a picture; the header, the composer and the footer stay in the window. */
				max-height: min(20rem, calc(100vh - 20rem));
				padding: 0 0 0.5rem;
				overflow-y: auto;
				overflow-x: hidden;
			}
			/* The day a group of messages was sent: a rule with a pill that sticks to the top, as in the chat. */
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
			.day-divider:first-child {
				margin-top: 0.75rem;
			}
			.day-divider::before {
				content: '';
				position: absolute;
				left: 0;
				right: 0;
				top: 50%;
				border-top: 1px solid var(--chat-border);
				z-index: -1;
			}
			/* A pill, as the chat page draws its day dividers. */
			.day-divider span {
				padding: 0.1875rem 0.875rem;
				border: 1px solid var(--chat-border);
				border-radius: 999px;
				background: var(--chat-bg);
				color: var(--chat-text);
				font-size: 0.6875rem;
				font-weight: 700;
				box-shadow: 0 0.0625rem 0.25rem rgba(0, 0, 0, 0.06);
			}
			.note {
				margin: 0;
				padding: 0.75rem 1.25rem 0;
				color: var(--dock-muted);
				font-size: 0.8125rem;
				line-height: 1.25rem;
			}
			/* The composer's hint line under its frame gives the bottom its room. */
			.write {
				padding: 0.75rem 1.25rem 0.25rem;
			}
		`
	]
})
export class ChatDockComponent {
	private readonly api = inject(ChatUiService);
	private readonly live = inject(ChatLiveService);
	private readonly dock = inject(ChatDockService);
	private readonly router = inject(Router);
	private readonly toastr = inject(ToastrService);
	private readonly destroyRef = inject(DestroyRef);

	private readonly store = inject(Store);
	private readonly peopleService = inject(ChatPeopleService);
	private readonly filesStore = inject(ChatFilesStore);
	private readonly taskStore = inject(ChatTasksService);
	private readonly createTaskFlow = inject(ChatCreateTaskFlow);
	private readonly translate = inject(TranslateService);
	private readonly locale = inject(LOCALE_ID);

	/** The conversation's files read so far, for the pictures and files of the messages shown. */
	protected readonly files = this.filesStore.byDocument;

	private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
	private readonly composer = viewChild(MessageComposerComponent);

	protected readonly person = this.dock.person;

	/** Me, as my own messages show me: my name and picture. */
	protected readonly me = toSignal(
		(this.store.user$ as Observable<IUser | null | undefined>).pipe(
			map((user): ChatPerson | null =>
				user?.id
					? {
							employeeId: String(user.employee?.id ?? user.employeeId ?? ''),
							userId: String(user.id),
							name: userName(user),
							imageUrl: user.imageUrl ?? null
						}
					: null
			),
			distinctUntilChanged((a, b) => a?.userId === b?.userId && a?.name === b?.name && a?.imageUrl === b?.imageUrl)
		),
		{ initialValue: null }
	);

	protected readonly conversation = signal<IChatConversationWithState | null>(null);
	private readonly messages = signal<readonly IChatMessageWithRelations[]>([]);
	protected readonly failed = signal(false);
	protected readonly sending = signal(false);
	/** Bumped after a send: the composer clears. */
	protected readonly resetToken = signal(0);
	/** The message of mine being edited in the composer, if any. */
	protected readonly editing = signal<IChatMessageWithRelations | null>(null);

	private readonly organization = toSignal(this.store.selectedOrganization$ as Observable<IOrganization | null | undefined>, { initialValue: null });
	/** The organization's people, for the composer's `@` suggestions and mention names. */
	protected readonly people = toSignal(
		toObservable(this.organization).pipe(
			switchMap((organization) =>
				organization?.id && organization.tenantId ? this.peopleService.people(organization.id, organization.tenantId).pipe(catchError(() => of(EMPTY_PEOPLE))) : of(EMPTY_PEOPLE)
			)
		),
		{ initialValue: EMPTY_PEOPLE }
	);
	/** Files are stored as documents: attaching them needs `DOCS_CREATE`, as in the chat. */
	protected readonly canAttach = this.permission(PermissionsEnum.DOCS_CREATE);
	/** A task is created from a message with `ORG_TASK_ADD` (the API checks it too). */
	protected readonly canCreateTask = this.permission(PermissionsEnum.ORG_TASK_ADD);
	private readonly isAdmin = this.permission(PermissionsEnum.CHAT_MANAGE);
	/** Whether I manage the conversation (any message may then be deleted), as the chat decides it. */
	protected readonly canManage = computed(() => {
		const conversation = this.conversation();
		return !!conversation && canManageConversation(conversation, this.me()?.employeeId || null, this.isAdmin());
	});
	/** An archived conversation is read only, as in the chat (the card's direct conversation always has me in it). */
	protected readonly readOnly = computed(() => !!this.conversation()?.archivedAt);
	protected readonly memberIds = computed(() => memberEmployeeIds(this.conversation()));
	/** The conversation's own draft key: what is typed here is the draft the chat finds, and back. */
	protected readonly draftKey = computed(() => {
		const conversation = this.conversation();
		return conversation ? `conversation:${conversation.id}` : null;
	});

	/** The task summaries read so far, for the task cards of the messages shown. */
	protected readonly tasks = this.taskStore.summaries;

	/**
	 * The organization's people, with the person of the card and me added when they are not in it (yet): the authors'
	 * names and pictures show before the people load, and for someone who is not an employee.
	 */
	protected readonly dockPeople = computed<ChatPeople>(() => {
		const base = this.people();
		const extra = [this.person(), this.me()].filter((person): person is ChatPerson => !!person);
		const missing = extra.filter((person) => (person.employeeId && !base.byEmployee.has(person.employeeId)) || (person.userId && !base.byUser.has(person.userId)));
		if (!missing.length) return base;
		const byEmployee = new Map(base.byEmployee);
		const byUser = new Map(base.byUser);
		for (const person of missing) {
			if (person.employeeId && !byEmployee.has(person.employeeId)) byEmployee.set(person.employeeId, person);
			if (person.userId && !byUser.has(person.userId)) byUser.set(person.userId, person);
		}
		return { byEmployee, byUser, list: base.list };
	});

	/** The messages with their day dividers and whether each continues the previous author's group, as in the chat. */
	protected readonly rows = computed<DockRow[]>(() => {
		const messages = this.messages();
		const today = new Date();
		const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
		return messages.map((message, index) => {
			const previous = messages[index - 1];
			const at = new Date(message.createdAt as Date);
			const newDay = !previous || !isSameDay(previous.createdAt as Date, at);
			return {
				message,
				day: newDay ? this.dayLabel(at, today, yesterday) : null,
				continued: !newDay && continuesGroup(previous, message)
			};
		});
	});

	/** The day divider's label, as the conversation words it. */
	private dayLabel(at: Date, today: Date, yesterday: Date): string {
		if (isSameDay(at, today)) return this.translate.instant('CHAT.VIEW.TODAY');
		if (isSameDay(at, yesterday)) return this.translate.instant('CHAT.VIEW.YESTERDAY');
		return formatDate(at, at.getFullYear() === today.getFullYear() ? 'EEEE, MMMM d' : 'EEEE, MMMM d, y', this.locale);
	}

	/** The newest message on screen. */
	private readonly newestId = computed(() => {
		const messages = this.messages();
		return messages.length ? String(messages[messages.length - 1].id) : null;
	});

	/** Whether the list is scrolled to its end (it opens there). */
	private atBottom = true;

	private scrollToBottom(): void {
		const element = this.scroller()?.nativeElement;
		if (!element) return;
		element.scrollTop = element.scrollHeight;
		this.atBottom = true;
	}

	/** The newest message of the other person the conversation was already marked read for. */
	private readThrough: string | null = null;
	/** A catch-up asked for the task cards to be read again with the next page. */
	private tasksStale = false;
	/**
	 * The messages a page has held since the card turned to this person. The pages are read one after another, so one
	 * of them that a later page does not hold was deleted since, even when it is newer than all of that page.
	 */
	private held = new Set<string>();

	/** The request of the person the card shows; a change of person drops it. */
	private request: Subscription | null = null;
	private polling: Subscription | null = null;

	constructor() {
		// The card turns to whoever it is opened with.
		effect(() => {
			const employeeId = this.person()?.employeeId ?? null;
			untracked(() => this.load(employeeId));
		});
		// Once the conversation is found the composer can be written in: it gets the keyboard.
		effect(() => {
			if (!this.conversation()) return;
			setTimeout(() => this.composer()?.focus());
		});
		// A new newest message is brought in sight; a refresh that changes nothing leaves the reader where they are.
		effect(() => {
			this.newestId();
			setTimeout(() => this.scrollToBottom());
		});
		// The files the messages carry are read through the conversation (members only), as the chat reads them.
		effect(() => {
			const conversation = this.conversation();
			const messages = this.messages().filter((message) => !message.deletedAt);
			if (!conversation) return;
			untracked(() => {
				this.filesStore.ensureFor(String(conversation.id), messages);
				this.taskStore.ensure(messages.flatMap((message) => (message.taskReferences ?? []).map((reference) => String(reference.taskId))));
			});
		});
		// A picture that loads after the list was scrolled grows it: a reader at the bottom stays at the bottom.
		effect((onCleanup) => {
			const element = this.scroller()?.nativeElement;
			if (!element) return;
			const onScroll = () => (this.atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 32);
			const onLoad = () => {
				if (this.atBottom) this.scrollToBottom();
			};
			element.addEventListener('scroll', onScroll, { passive: true });
			// `load` does not bubble: it is caught on its way down.
			element.addEventListener('load', onLoad, true);
			onCleanup(() => {
				element.removeEventListener('scroll', onScroll);
				element.removeEventListener('load', onLoad, true);
			});
		});
		this.destroyRef.onDestroy(() => {
			this.request?.unsubscribe();
			this.polling?.unsubscribe();
		});
	}

	/** Finds (or creates) our direct conversation and reads its latest messages, then keeps reading the newer ones. */
	private load(employeeId: string | null): void {
		this.request?.unsubscribe();
		this.polling?.unsubscribe();
		this.conversation.set(null);
		this.messages.set([]);
		this.editing.set(null);
		this.failed.set(false);
		this.readThrough = null;
		this.tasksStale = false;
		this.held = new Set();
		if (!employeeId) return;
		this.request = this.api.direct([employeeId]).subscribe({
			next: ({ conversation }) => {
				this.conversation.set(conversation);
				this.request = this.api.messages(conversation.id, { limit: CHAT_DOCK_PAGE_SIZE }).subscribe({
					next: (page) => {
						this.accept(page.messages);
						this.poll(conversation);
					},
					// The card says so, and the poll keeps trying: the first page it reads takes the note away.
					error: () => {
						this.failed.set(true);
						this.poll(conversation);
					}
				});
			},
			error: () => this.failed.set(true)
		});
	}

	/**
	 * Reads the newest page again while the tab is seen, as the conversation follows itself: on each chat event of
	 * this conversation (a few close together read once), when the stream resumes or the tab is shown again, and on
	 * the chat's poll ticks — every few seconds where events do not stream, a rare safety net where they do. A read
	 * under way is never cancelled by the next trigger: triggers that come meanwhile ask for one more read after it
	 * (which holds what they announced), so slow answers or a steady stream of events cannot keep the card from
	 * updating. The task cards are read again on a message's update and after a catch-up, never on a mere tick.
	 */
	private poll(conversation: IChatConversationWithState): void {
		const id = String(conversation.id);
		const hints$ = this.live.hints$.pipe(filter((hint) => hint.conversationId === id));
		const catchUp$ = this.live.catchUp$.pipe(tap(() => (this.tasksStale = true)));
		const polling = merge(this.live.ticks(CHAT_MESSAGES_POLL_MS), hints$.pipe(auditTime(CHAT_LIVE_AUDIT_MS)), catchUp$)
			.pipe(
				filter(() => isTabVisible()),
				coalesceReads(() => this.api.messages(id, { limit: CHAT_DOCK_PAGE_SIZE }).pipe(catchError(() => EMPTY)))
			)
			.subscribe((page) => {
				this.failed.set(false);
				this.accept(page.messages);
				// After a catch-up, the tasks the messages show may have changed meanwhile too.
				if (this.tasksStale) {
					this.tasksStale = false;
					this.taskStore.refreshAll(this.messages());
				}
			});
		// A task changed from a card is told to the messages that show it: their cards read the task again.
		polling.add(
			hints$
				.pipe(filter((hint) => hint.name === CHAT_EVENT_NAMES.MESSAGE_UPDATED && !!hint.messageId && isTabVisible()))
				.subscribe((hint) => this.taskStore.refreshShownBy(this.messages(), String(hint.messageId)))
		);
		this.polling = polling;
	}

	/**
	 * Makes the card show the newest page (see `showNewestPage`: what it holds as it holds it, what it no longer holds
	 * gone, an unchanged message keeping its object so its view is not drawn again), then marks the conversation read
	 * up to the last message on screen when the other person wrote something new: never further, so what arrives
	 * meanwhile stays unread, and not while the tab is hidden, when nothing was seen. A message newer than the whole
	 * page stays only when no page has held it yet (one sent here while the page was read): one a page held before was
	 * deleted since (a plain message deleted leaves the list), and leaves even as the newest.
	 */
	private accept(page: readonly IChatMessageWithRelations[]): void {
		const inPage = new Set(page.map((message) => String(message.id)));
		const current = this.messages();
		const live = current.filter((message) => inPage.has(String(message.id)) || !this.held.has(String(message.id)));
		const messages = showNewestPage(live.length === current.length ? current : live, page);
		for (const id of inPage) this.held.add(id);
		this.messages.set(messages);
		const conversation = this.conversation();
		const me = this.me()?.userId ?? null;
		const last = messages[messages.length - 1];
		const theirs = [...messages].reverse().find((message) => String(message.authorUserId ?? '') !== me);
		if (!conversation || !last || !theirs || String(theirs.id) === this.readThrough) return;
		if (!isTabVisible()) return;
		const through = String(theirs.id);
		this.readThrough = through;
		this.api
			.read(conversation.id, last.id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: () => this.api.notifyChanged(),
				// Not marked: the next page tries again.
				error: () => {
					if (this.readThrough === through) this.readThrough = null;
				}
			});
	}

	protected close(): void {
		this.dock.close();
	}

	/** Escape leaves edit mode, else closes the card, unless the composer used it to close one of its own lists. */
	protected onEscape(event: Event): void {
		if (event.defaultPrevented) return;
		if (this.editing()) {
			this.editing.set(null);
			return;
		}
		this.close();
	}

	/** Whether I have a permission, kept up to date with my role's permissions. */
	private permission(permission: PermissionsEnum): Signal<boolean> {
		return toSignal(
			(this.store.userRolePermissions$ as Observable<unknown>).pipe(
				map(() => this.store.hasPermission(permission)),
				distinctUntilChanged()
			),
			{ initialValue: this.store.hasPermission(permission) }
		);
	}

	protected onTyping(): void {
		const conversation = this.conversation();
		if (conversation) this.api.signalTyping(String(conversation.id));
	}

	/** The full conversation in the chat (with a message's thread open); the card gives way to it. */
	protected openInChat(threadRootId: string | null = null): void {
		const conversation = this.conversation();
		if (!conversation) return;
		this.dock.close();
		void this.router.navigate([CHAT_LINK, conversation.id], threadRootId ? { queryParams: { thread: threadRootId } } : {});
	}

	/** What a message's toolbar asks, done as the conversation does it; a thread has no room here and opens in the chat. */
	protected onAction(message: IChatMessageWithRelations, action: MessageAction): void {
		const conversation = this.conversation();
		if (!conversation) return;
		const id = String(conversation.id);
		switch (action.kind) {
			case 'reply':
				// A reply also sent to the conversation opens the thread it belongs to (a reply has no replies of its own).
				this.openInChat(String(message.threadRootId ?? message.id));
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
							// Only the fields the deletion changed: what a refresh brought meanwhile stays.
							if (this.isCurrent(id)) this.replace({ id: message.id, body: '', deletedAt: new Date() });
							this.api.notifyChanged();
						},
						error: (error) => this.fail(error)
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
			case 'unread':
				// The read mark stays where it is (`readThrough`): only a newer message of theirs marks it read again.
				this.api
					.unreadFrom(message.id)
					.pipe(takeUntilDestroyed(this.destroyRef))
					.subscribe({
						next: () => this.api.notifyChanged(),
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
							// Only the field it changed: what a refresh brought meanwhile stays.
							if (this.isCurrent(id)) this.replace({ id: message.id, following: action.following });
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
		const conversation = this.conversation();
		if (!conversation) return;
		const id = String(conversation.id);
		const organization = this.organization();
		this.createTaskFlow
			.open({
				message,
				people: this.dockPeople(),
				conversationNames: new Map(),
				organizationId: organization?.id ? String(organization.id) : conversation.organizationId ? String(conversation.organizationId) : null,
				tenantId: organization?.tenantId ? String(organization.tenantId) : null
			})
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((reference) => {
				if (!reference || !this.isCurrent(id)) return;
				// Added to the message as shown now (another reference may have come meanwhile).
				const current = this.messages().find((item) => item.id === message.id) ?? message;
				this.replace({ id: message.id, taskReferences: withTaskReference(current, reference).taskReferences });
			});
	}

	/** Whether the card still shows the conversation a request was made for. */
	private isCurrent(id: string): boolean {
		return String(this.conversation()?.id) === id;
	}

	/** Puts the API's version of a message (or the fields of it that changed) in place of ours. */
	private replace(patch: ChatMessagePatch): void {
		this.messages.set(this.messages().map((item) => (item.id === patch.id ? { ...item, ...patch } : item)));
	}

	private fail(error: unknown, fallbackKey = 'CHAT.DIALOG.FAILED'): void {
		this.toastr.danger(apiErrorMessage(error) ?? this.translate.instant(fallbackKey));
	}

	protected send(submission: ComposerSubmission): void {
		const conversation = this.conversation();
		if (!conversation || this.sending()) return;
		const editing = this.editing();
		if (editing) {
			this.saveEdit(String(conversation.id), editing, submission);
			return;
		}
		this.sending.set(true);
		this.api
			.send(conversation.id, {
				body: submission.body,
				nonce: newNonce(),
				mentionEmployeeIds: submission.mentionEmployeeIds,
				...(submission.attachmentIds.length ? { attachmentIds: submission.attachmentIds } : {})
			})
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (result) => {
					this.sending.set(false);
					this.api.notifyChanged();
					// Only when the card still shows the conversation the message went to; otherwise the draft it came
					// from is not to be sent again.
					if (String(this.conversation()?.id) !== String(conversation.id)) {
						clearDraft(`conversation:${conversation.id}`);
						return;
					}
					this.messages.set(mergeMessages(this.messages(), [result.message]));
					this.resetToken.update((value) => value + 1);
					// The box was disabled while sending: the keyboard goes back to it.
					setTimeout(() => this.composer()?.focus());
				},
				error: () => {
					this.sending.set(false);
					this.toastr.danger('CHAT.COMPOSER.SEND_FAILED');
				}
			});
	}

	/**
	 * Saves the message being edited. Once it is saved the composer leaves edit mode and clears, but only for that edit:
	 * another message picked for editing while it saved keeps its edit session.
	 */
	private saveEdit(id: string, message: IChatMessageWithRelations, submission: ComposerSubmission): void {
		this.sending.set(true);
		this.api
			.edit(message.id, { body: submission.body, mentionEmployeeIds: submission.mentionEmployeeIds })
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (result) => {
					this.sending.set(false);
					if (!this.isCurrent(id)) return;
					this.replace(result.message);
					if (String(this.editing()?.id) !== String(message.id)) return;
					this.editing.set(null);
					this.resetToken.update((value) => value + 1);
					setTimeout(() => this.composer()?.focus());
				},
				error: (error) => {
					this.sending.set(false);
					this.fail(error, 'CHAT.COMPOSER.SEND_FAILED');
				}
			});
	}
}
