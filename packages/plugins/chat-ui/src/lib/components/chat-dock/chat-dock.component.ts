import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { EMPTY, Observable, of, Subscription, timer } from 'rxjs';
import { catchError, distinctUntilChanged, exhaustMap, map, switchMap } from 'rxjs/operators';
import { IChatConversationWithState, IChatMessageWithRelations, IOrganization, IUser, PermissionsEnum } from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { CHAT_LINK, CHAT_MESSAGES_POLL_MS } from '../../chat-ui.constants';
import { ChatPerson, continuesGroup, isSameDay, memberEmployeeIds, mergeMessages, messagePreview, newNonce, userName } from '../../chat-ui.helpers';
import { ChatDockService } from '../../services/chat-dock.service';
import { ChatPeopleService, EMPTY_PEOPLE } from '../../services/chat-people.service';
import { ChatUiService } from '../../services/chat-ui.service';
import { clearDraft, ComposerSubmission, MessageComposerComponent } from '../message-composer/message-composer.component';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';

/**
 * The label of a day above its first run: "Today" is left out (a card opened to write someone needs no date for
 * what was just said), "Yesterday" is named, and an older day shows its date.
 */
function dayOf(at: Date | string): DockRun['day'] {
	const now = new Date();
	if (isSameDay(at, now)) return null;
	const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
	return { key: isSameDay(at, yesterday) ? 'CHAT.VIEW.YESTERDAY' : null, at };
}

/** One message of a run: its text and when it was written. */
interface DockLine {
	id: string;
	text: string;
	deleted: boolean;
	at: Date | string | undefined;
}

/**
 * Consecutive messages of one author written close together, shown under one heading (picture, name, time), as the
 * chat itself groups them.
 */
interface DockRun {
	id: string;
	author: ChatPerson;
	mine: boolean;
	at: Date | string | undefined;
	/** Set on the first run of a day that is not today: the day it was written on, as a quiet label above it. */
	day: { key: string | null; at: Date | string | undefined } | null;
	lines: DockLine[];
}

/**
 * The docked message card (`ChatDockService`): a small card at the bottom right of the screen to write one person
 * directly. A box to write and a way to the full conversation, as a quick-message card; above them, who it is and,
 * once there is something to read, the latest messages of our conversation, grouped by author as the chat shows them. The
 * conversation is found (or created) when the card opens; its newest page is read again every few seconds (so a
 * message written, edited or deleted elsewhere shows), and it is marked read up to the last message on screen.
 */
@Component({
	selector: 'ngx-chat-dock',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, NbIconModule, TranslatePipe, PersonAvatarComponent, MessageComposerComponent],
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
				} @else if (runs().length > 0) {
					<div #scroller class="messages" data-test="chat-dock-messages">
						@for (run of runs(); track run.id) {
							@if (run.day; as day) {
								<div class="day">{{ day.key ? (day.key | translate) : (day.at | date: 'mediumDate') }}</div>
							}
							<div class="run">
								<ngx-chat-person-avatar [person]="run.author" size="small" [round]="true"></ngx-chat-person-avatar>
								<div class="run-body">
									<div class="run-head">
										<span class="by">{{ run.mine ? ('CHAT.PROFILE.YOU' | translate) : run.author.name }}</span>
										<time class="time" [attr.title]="run.at | date: 'medium'">{{ run.at | date: 'shortTime' }}</time>
									</div>
									@for (line of run.lines; track line.id) {
										<p class="text" [class.deleted]="line.deleted" [attr.title]="line.at | date: 'medium'">
											{{ line.deleted ? ('CHAT.MESSAGE.DELETED' | translate) : line.text }}
										</p>
									}
								</div>
							</div>
						}
					</div>
				}

				<!-- The chat's own composer, as in the conversation: formatting, mentions, emoji, files, and its draft. -->
				<div class="write">
					<ngx-chat-message-composer
						data-test="chat-dock-composer"
						[people]="people()"
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
				/* The chat page's colours, for the composer it shares with the conversation. */
				--chat-bg: var(--gauzy-card-1, var(--card-background-color, #fff));
				--chat-raised: var(--gauzy-card-1, var(--card-background-color, #fff));
				--chat-border: var(--gauzy-border-default-color, rgba(127, 127, 127, 0.18));
				--chat-border-strong: var(--border-basic-color-4, rgba(127, 127, 127, 0.35));
				--chat-hover: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.12));
				--chat-composer-bar: var(--gauzy-sidebar-background-4, rgba(126, 126, 143, 0.05));
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
				padding: 0.75rem 0.5rem 0.75rem 1rem;
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
				padding: 0.625rem 1rem;
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
			 * The latest messages, grouped as the chat groups them: a picture, the name and the time, then what they
			 * wrote under the name. The newest stays in sight.
			 */
			.messages {
				display: flex;
				flex-direction: column;
				gap: 0.75rem;
				max-height: min(15rem, calc(100vh - 16rem));
				padding: 0.75rem 1rem 0.25rem;
				overflow-y: auto;
			}
			.day {
				color: var(--gauzy-text-color-2, inherit);
				font-size: 0.6875rem;
				line-height: 1rem;
				text-align: center;
			}
			.run {
				display: flex;
				align-items: flex-start;
				gap: 0.5rem;
				min-width: 0;
			}
			.run-body {
				flex: 1 1 auto;
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
				min-width: 0;
			}
			/* The name's line is as tall as the picture beside it. */
			.run-head {
				display: flex;
				align-items: baseline;
				gap: 0.375rem;
				min-width: 0;
				line-height: 1.5rem;
			}
			.by {
				overflow: hidden;
				font-size: 0.8125rem;
				font-weight: 600;
				white-space: nowrap;
				text-overflow: ellipsis;
			}
			.time {
				flex: 0 0 auto;
				color: var(--gauzy-text-color-2, inherit);
				font-size: 0.6875rem;
				font-variant-numeric: tabular-nums;
			}
			.text {
				margin: 0;
				font-size: 0.8125rem;
				line-height: 1.25rem;
				overflow-wrap: anywhere;
				white-space: pre-wrap;
			}
			.text.deleted,
			.note {
				color: var(--gauzy-text-color-2, inherit);
			}
			.text.deleted {
				font-style: italic;
			}
			.note {
				margin: 0;
				padding: 0.75rem 1rem 0;
				font-size: 0.8125rem;
				line-height: 1.25rem;
			}
			/* The composer's hint line under its frame gives the bottom its room. */
			.write {
				padding: 0.75rem 1rem 0.25rem;
			}
		`
	]
})
export class ChatDockComponent {
	private readonly api = inject(ChatUiService);
	private readonly dock = inject(ChatDockService);
	private readonly router = inject(Router);
	private readonly toastr = inject(ToastrService);
	private readonly destroyRef = inject(DestroyRef);

	private readonly store = inject(Store);
	private readonly peopleService = inject(ChatPeopleService);

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
	private readonly messages = signal<IChatMessageWithRelations[]>([]);
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

	/** The messages as runs of one author, oldest first. */
	protected readonly runs = computed<DockRun[]>(() => {
		const me = this.me();
		const who = this.person();
		const people = new Map<string, ChatPerson>(who ? [[who.employeeId, who]] : []);
		const unknown: ChatPerson = { employeeId: '', userId: null, name: '', imageUrl: null };
		const runs: DockRun[] = [];
		let previous: IChatMessageWithRelations | undefined;
		for (const message of this.messages()) {
			const line: DockLine = {
				id: String(message.id),
				// A message sent without text shows the names of its files, as the conversation list does
				text: messagePreview(message, people, new Map()),
				deleted: !!message.deletedAt,
				at: message.createdAt
			};
			const newDay = !previous || !isSameDay(previous.createdAt as Date, message.createdAt as Date);
			if (!newDay && continuesGroup(previous, message)) {
				runs[runs.length - 1].lines.push(line);
			} else {
				const mine = !!me?.userId && String(message.authorUserId ?? '') === me.userId;
				runs.push({
					id: line.id,
					author: mine && me ? me : (who ?? unknown),
					mine,
					at: message.createdAt,
					day: newDay ? dayOf(message.createdAt as Date) : null,
					lines: [line]
				});
			}
			previous = message;
		}
		return runs;
	});

	/** The newest message on screen. */
	private readonly newestId = computed(() => {
		const messages = this.messages();
		return messages.length ? String(messages[messages.length - 1].id) : null;
	});

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
			setTimeout(() => {
				const element = this.scroller()?.nativeElement;
				if (element) element.scrollTop = element.scrollHeight;
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
				this.request = this.api.messages(conversation.id).subscribe({
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
	 * Reads the newest page again every few seconds while the tab is seen. The whole page, not only what follows the
	 * last message on screen: a message of mine added by `send()` may be newer than one of theirs not fetched yet, and
	 * a message already shown may have been edited or deleted since.
	 */
	private poll(conversation: IChatConversationWithState): void {
		this.polling = timer(CHAT_MESSAGES_POLL_MS, CHAT_MESSAGES_POLL_MS)
			.pipe(
				exhaustMap(() => {
					if (typeof document !== 'undefined' && document.hidden) return EMPTY;
					return this.api.messages(conversation.id).pipe(catchError(() => EMPTY));
				})
			)
			.subscribe((page) => {
				this.failed.set(false);
				this.accept(page.messages);
			});
	}

	/**
	 * Puts a page into the card (a message already shown takes its new state), then marks the conversation read up
	 * to the last message on screen when the other person wrote something new: never further, so what arrives
	 * meanwhile stays unread, and not while the tab is hidden, when nothing was seen.
	 */
	private accept(incoming: readonly IChatMessageWithRelations[]): void {
		if (incoming.length === 0) return;
		const messages = mergeMessages(this.messages(), incoming);
		this.messages.set(messages);
		const conversation = this.conversation();
		const me = this.me()?.userId ?? null;
		const last = messages[messages.length - 1];
		const theirs = [...messages].reverse().find((message) => String(message.authorUserId ?? '') !== me);
		if (!conversation || !last || !theirs || String(theirs.id) === this.readThrough) return;
		if (typeof document !== 'undefined' && document.hidden) return;
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
