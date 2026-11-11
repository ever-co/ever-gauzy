import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { EMPTY, Observable, Subscription, timer } from 'rxjs';
import { catchError, distinctUntilChanged, exhaustMap, map } from 'rxjs/operators';
import { CHAT_MESSAGE_MAX_LENGTH, IChatConversationWithState, IChatMessageWithRelations, IUser } from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { CHAT_LINK, CHAT_MESSAGES_POLL_MS } from '../../chat-ui.constants';
import { ChatPerson, continuesGroup, isSameDay, mergeMessages, newNonce, plainBody, userName } from '../../chat-ui.helpers';
import { ChatDockService } from '../../services/chat-dock.service';
import { ChatUiService } from '../../services/chat-ui.service';
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
 * once there is something to read, the latest messages of our conversation, grouped by author as the chat shows them. The conversation is found
 * (or created) when the card opens, read again every few seconds, and marked read as its messages show.
 */
@Component({
	selector: 'ngx-chat-dock',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, NbIconModule, TranslatePipe, PersonAvatarComponent],
	template: `
		@if (person(); as who) {
			<section class="panel" role="dialog" [attr.aria-label]="who.name" data-test="chat-dock" (keydown.escape)="close()">
				<header class="head">
					<ngx-chat-person-avatar [person]="who" [round]="true"></ngx-chat-person-avatar>
					<span class="name" [attr.title]="who.name">{{ who.name }}</span>
					<button type="button" class="icon" data-test="chat-dock-close" [attr.aria-label]="'CHAT.VIEW.CLOSE' | translate" (click)="close()">
						<nb-icon icon="close-outline"></nb-icon>
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

				<form class="write" (submit)="send($event)">
					<input
						#box
						type="text"
						class="box"
						data-test="chat-dock-box"
						autocomplete="off"
						[attr.maxlength]="max"
						[value]="draft()"
						[placeholder]="'CHAT.PROFILE.MESSAGE_PLACEHOLDER' | translate: { name: who.name }"
						[attr.aria-label]="'CHAT.PROFILE.MESSAGE_PLACEHOLDER' | translate: { name: who.name }"
						(input)="draft.set(box.value)"
					/>
					<button
						type="submit"
						class="icon"
						data-test="chat-dock-send"
						[disabled]="sending() || !conversation() || !draft().trim()"
						[attr.aria-label]="'CHAT.COMPOSER.SEND' | translate"
					>
						<nb-icon icon="paper-plane-outline"></nb-icon>
					</button>
				</form>

				<button type="button" class="open" data-test="chat-dock-open" [disabled]="!conversation()" (click)="openInChat()">
					{{ 'CHAT.DIALOG.OPEN_DIRECT' | translate }}
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
			.panel {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
				width: 20rem;
				max-width: calc(100vw - 2rem);
				padding: 0.75rem;
				border: 1px solid var(--gauzy-border-default-color, rgba(127, 127, 127, 0.25));
				border-radius: 0.75rem;
				background: var(--gauzy-card-1, #fff);
				box-shadow: 0 0.5rem 2rem rgba(0, 0, 0, 0.28);
				color: var(--gauzy-text-color-1, inherit);
			}
			.head {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				min-width: 0;
			}
			.name {
				flex: 1 1 auto;
				min-width: 0;
				overflow: hidden;
				font-size: 0.8125rem;
				font-weight: 600;
				line-height: 1.25rem;
				white-space: nowrap;
				text-overflow: ellipsis;
			}
			.icon,
			.open {
				border: 0;
				background: transparent;
				color: var(--gauzy-text-color-1, inherit);
				font: inherit;
				cursor: pointer;
				transition: background-color 0.12s ease;
			}
			.icon {
				flex: 0 0 auto;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 2.25rem;
				height: 2.25rem;
				border-radius: 0.5rem;
			}
			.head .icon {
				width: 1.75rem;
				height: 1.75rem;
				color: var(--gauzy-text-color-2, inherit);
			}
			.open {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.5rem;
				padding: 0.4375rem 0.5rem;
				border-radius: 0.5rem;
				font-size: 0.8125rem;
				text-align: start;
			}
			.icon:hover:not(:disabled),
			.icon:focus-visible,
			.open:hover:not(:disabled),
			.open:focus-visible {
				background: var(--gauzy-hover-tint, rgba(127, 127, 127, 0.12));
			}
			.icon:disabled,
			.open:disabled {
				opacity: 0.45;
				cursor: default;
			}
			.icon nb-icon,
			.open nb-icon {
				font-size: 1rem;
			}
			.open nb-icon {
				color: var(--gauzy-text-color-2, inherit);
			}
			/*
			 * The latest messages between two hairlines, grouped as the chat groups them: a picture, the name and the
			 * time, then what they wrote under the name. The newest stays in sight.
			 */
			.messages {
				display: flex;
				flex-direction: column;
				gap: 0.75rem;
				max-height: min(15rem, calc(100vh - 16rem));
				margin: 0 -0.75rem;
				padding: 0.75rem;
				border-top: 1px solid var(--gauzy-border-default-color, rgba(127, 127, 127, 0.25));
				border-bottom: 1px solid var(--gauzy-border-default-color, rgba(127, 127, 127, 0.25));
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
				padding: 0 0.5rem;
				font-size: 0.8125rem;
				line-height: 1.25rem;
			}
			.write {
				display: flex;
				align-items: center;
				gap: 0.375rem;
				margin: 0;
			}
			/* Global form styles reach a bare input: every property it shows is set here. */
			.box {
				box-sizing: border-box;
				flex: 1 1 auto;
				min-width: 0;
				height: 2.25rem !important;
				margin: 0 !important;
				padding: 0 0.75rem !important;
				border: 1px solid var(--gauzy-border-default-color, rgba(127, 127, 127, 0.25)) !important;
				border-radius: 0.5rem !important;
				outline: 0;
				background: transparent !important;
				box-shadow: none !important;
				color: var(--gauzy-text-color-1, inherit) !important;
				font: inherit;
				font-size: 0.8125rem !important;
			}
			.box:focus {
				border-color: var(--gauzy-text-color-2, rgba(127, 127, 127, 0.6)) !important;
			}
			.box::placeholder {
				color: var(--gauzy-text-color-2, rgba(127, 127, 127, 0.9));
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

	private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
	private readonly box = viewChild<ElementRef<HTMLInputElement>>('box');

	protected readonly max = CHAT_MESSAGE_MAX_LENGTH;
	protected readonly person = this.dock.person;

	/** Me, as my own messages show me: my name and picture. */
	private readonly me = toSignal(
		(inject(Store).user$ as Observable<IUser | null | undefined>).pipe(
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
	protected readonly draft = signal('');

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
				text: plainBody(message.body ?? '', people, new Map()),
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

	/** The request of the person the card shows; a change of person drops it. */
	private request: Subscription | null = null;
	private polling: Subscription | null = null;

	constructor() {
		// The card turns to whoever it is opened with, and gives the box the keyboard.
		effect(() => {
			const employeeId = this.person()?.employeeId ?? null;
			untracked(() => this.load(employeeId));
			setTimeout(() => this.box()?.nativeElement.focus());
		});
		// New lines keep the newest in sight.
		effect(() => {
			this.runs();
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
		this.draft.set('');
		this.failed.set(false);
		if (!employeeId) return;
		this.request = this.api.direct([employeeId]).subscribe({
			next: ({ conversation }) => {
				this.conversation.set(conversation);
				this.request = this.api.messages(conversation.id).subscribe({
					next: (page) => {
						this.accept(page.messages);
						this.poll(conversation);
					},
					error: () => this.failed.set(true)
				});
			},
			error: () => this.failed.set(true)
		});
	}

	/** Asks for the messages after the last one every few seconds while the tab is seen. */
	private poll(conversation: IChatConversationWithState): void {
		this.polling = timer(CHAT_MESSAGES_POLL_MS, CHAT_MESSAGES_POLL_MS)
			.pipe(
				exhaustMap(() => {
					if (typeof document !== 'undefined' && document.hidden) return EMPTY;
					const messages = this.messages();
					const last = messages[messages.length - 1];
					return this.api.messages(conversation.id, last ? { after: last.id } : {}).pipe(catchError(() => EMPTY));
				})
			)
			.subscribe((page) => this.accept(page.messages));
	}

	/** Adds messages to the card; what someone else wrote is marked read, since it is on screen. */
	private accept(incoming: readonly IChatMessageWithRelations[]): void {
		if (incoming.length === 0) return;
		this.messages.set(mergeMessages(this.messages(), incoming));
		const conversation = this.conversation();
		const me = this.me()?.userId ?? null;
		if (!conversation || !incoming.some((message) => String(message.authorUserId ?? '') !== me)) return;
		this.api
			.read(conversation.id)
			.pipe(
				catchError(() => EMPTY),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe(() => this.api.notifyChanged());
	}

	protected close(): void {
		this.dock.close();
	}

	/** The full conversation in the chat; the card gives way to it. */
	protected openInChat(): void {
		const conversation = this.conversation();
		if (!conversation) return;
		this.dock.close();
		void this.router.navigate([CHAT_LINK, conversation.id]);
	}

	protected send(event: Event): void {
		event.preventDefault();
		const conversation = this.conversation();
		const body = this.draft().trim();
		if (!conversation || !body || this.sending()) return;
		this.sending.set(true);
		this.api
			.send(conversation.id, { body, nonce: newNonce() })
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (result) => {
					this.sending.set(false);
					// Only when the card still shows the conversation the message went to.
					if (String(this.conversation()?.id) !== String(conversation.id)) return;
					this.draft.set('');
					this.messages.set(mergeMessages(this.messages(), [result.message]));
					this.api.notifyChanged();
				},
				error: () => {
					this.sending.set(false);
					this.toastr.danger('CHAT.COMPOSER.SEND_FAILED');
				}
			});
	}
}
