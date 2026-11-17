import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, LOCALE_ID, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NbIconModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EMPTY, merge, Observable, of, Subscription } from 'rxjs';
import { auditTime, catchError, distinctUntilChanged, filter, map, switchMap } from 'rxjs/operators';
import { IChatConversationWithState, IChatMessageWithRelations, IOrganization, IUser, PermissionsEnum } from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { CHAT_DOCK_PAGE_SIZE, CHAT_LINK, CHAT_LIVE_AUDIT_MS, CHAT_MESSAGES_POLL_MS } from '../../chat-ui.constants';
import { ChatPerson, continuesGroup, isSameDay, memberEmployeeIds, mergeKeepingUnchanged, mergeMessages, newNonce, userName } from '../../chat-ui.helpers';
import { ChatDockService } from '../../services/chat-dock.service';
import { ChatFilesStore } from '../../services/chat-files.store';
import { ChatLiveService, isTabVisible } from '../../services/chat-live.service';
import { ChatPeople, ChatPeopleService, EMPTY_PEOPLE } from '../../services/chat-people.service';
import { ChatTasksService } from '../../services/chat-tasks.service';
import { ChatUiService } from '../../services/chat-ui.service';
import { clearDraft, ComposerSubmission, MessageComposerComponent } from '../message-composer/message-composer.component';
import { MessageItemComponent } from '../message-item/message-item.component';
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
 * conversation is found (or created) when the card opens; its newest page is read again every few seconds (so a
 * message written, edited or deleted elsewhere shows), and it is marked read up to the last message on screen.
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
					<!-- The messages as the conversation shows them (its own message component), to read: acting on one is done in the chat. -->
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
								[meEmployeeId]="me()?.employeeId || null"
								[meUserId]="me()?.userId ?? null"
								[continued]="row.continued"
								[readOnly]="true"
								[showThreadSummary]="false"
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
						[disabled]="sending() || !conversation()"
						[memberIds]="memberIds()"
						[meEmployeeId]="me()?.employeeId || null"
						[draftKey]="draftKey()"
						[resetToken]="resetToken()"
						[canAttach]="canAttach()"
						(submitted)="send($event)"
						(typing)="onTyping()"
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
			 * with the box to write, and the way to the full conversation.
			 */
			.panel {
				--dock-line: var(--gauzy-border-default-color, rgba(127, 127, 127, 0.25));
				--dock-muted: var(--gauzy-text-color-2, rgba(127, 127, 127, 0.9));
				--dock-hover: rgba(127, 127, 127, 0.12);
				--dock-accent: var(--color-primary-default, #3366ff);
				/* The chat page's colours, for the messages and the composer it shares with the conversation. */
				--chat-bg: var(--gauzy-card-1, var(--card-background-color, #fff));
				--chat-raised: var(--gauzy-card-1, var(--card-background-color, #fff));
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
				display: flex;
				flex-direction: column;
				/* The width of a docked chat window (room for the composer's emoji panel too). */
				width: 25rem;
				max-width: calc(100vw - 2rem);
				border: 1px solid var(--dock-line);
				border-radius: 0.5rem;
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
				border-radius: 0.375rem;
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
				/* The card does not clip (the composer's lists open above it): the row rounds its own corners. */
				border-radius: 0 0 0.5rem 0.5rem;
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

	/** The organization's people, for the composer's `@` suggestions and mention names. */
	protected readonly people = toSignal(
		(this.store.selectedOrganization$ as Observable<IOrganization | null | undefined>).pipe(
			switchMap((organization) =>
				organization?.id && organization.tenantId ? this.peopleService.people(organization.id, organization.tenantId).pipe(catchError(() => of(EMPTY_PEOPLE))) : of(EMPTY_PEOPLE)
			)
		),
		{ initialValue: EMPTY_PEOPLE }
	);
	/** Files are stored as documents: attaching them needs `DOCS_CREATE`, as in the chat. */
	protected readonly canAttach = toSignal(
		(this.store.userRolePermissions$ as Observable<unknown>).pipe(
			map(() => this.store.hasPermission(PermissionsEnum.DOCS_CREATE)),
			distinctUntilChanged()
		),
		{ initialValue: this.store.hasPermission(PermissionsEnum.DOCS_CREATE) }
	);
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
		this.failed.set(false);
		this.readThrough = null;
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
	 * the chat's poll ticks — every few seconds where events do not stream, a rare safety net where they do. The whole
	 * page, not only what follows the last message on screen: a message of mine added by `send()` may be newer than
	 * one of theirs not fetched yet, and a message already shown may have been edited or deleted since.
	 */
	private poll(conversation: IChatConversationWithState): void {
		const id = String(conversation.id);
		const events$ = this.live.hints$.pipe(
			filter((hint) => hint.conversationId === id),
			auditTime(CHAT_LIVE_AUDIT_MS)
		);
		this.polling = merge(this.live.ticks(CHAT_MESSAGES_POLL_MS), events$, this.live.catchUp$)
			.pipe(
				filter(() => isTabVisible()),
				// A newer reason to read wins: what an event announced is in the read that follows it.
				switchMap(() => this.api.messages(id, { limit: CHAT_DOCK_PAGE_SIZE }).pipe(catchError(() => EMPTY)))
			)
			.subscribe((page) => {
				this.failed.set(false);
				this.accept(page.messages);
			});
	}

	/**
	 * Puts a page into the card (a message already shown takes its new state; one the page did not change keeps its
	 * object, so its view is not drawn again, and a page that changed nothing changes nothing), then marks the
	 * conversation read up to the last message on screen when the other person wrote something new: never further,
	 * so what arrives meanwhile stays unread, and not while the tab is hidden, when nothing was seen.
	 */
	private accept(incoming: readonly IChatMessageWithRelations[]): void {
		if (incoming.length === 0) return;
		const messages = mergeKeepingUnchanged(this.messages(), incoming);
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

	/** Escape closes the card, unless the composer used it to close one of its own lists. */
	protected onEscape(event: Event): void {
		if (event.defaultPrevented) return;
		this.close();
	}

	protected onTyping(): void {
		const conversation = this.conversation();
		if (conversation) this.api.signalTyping(String(conversation.id));
	}

	/** The full conversation in the chat; the card gives way to it. */
	protected openInChat(): void {
		const conversation = this.conversation();
		if (!conversation) return;
		this.dock.close();
		void this.router.navigate([CHAT_LINK, conversation.id]);
	}

	protected send(submission: ComposerSubmission): void {
		const conversation = this.conversation();
		if (!conversation || this.sending()) return;
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
}
