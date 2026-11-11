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
import { ChatPerson, mergeMessages, newNonce, plainBody } from '../../chat-ui.helpers';
import { ChatDockService } from '../../services/chat-dock.service';
import { ChatUiService } from '../../services/chat-ui.service';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';

/** A message as the card shows it: its text, whose it is, and whether it opens a new run of one author. */
interface DockMessage {
	id: string;
	text: string;
	mine: boolean;
	deleted: boolean;
	at: Date | string | undefined;
	/** The first of consecutive messages of one author: it carries the author's name. */
	first: boolean;
}

/**
 * The docked message card (`ChatDockService`): a small card at the bottom right of the screen to write one person
 * directly. A box to write and a way to the full conversation, as a quick-message card; above them, who it is and,
 * once there is something to read, the latest messages of our conversation as plain lines. The conversation is found
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
				} @else if (rows().length > 0) {
					<div #scroller class="messages" data-test="chat-dock-messages">
						@for (row of rows(); track row.id) {
							@if (row.first) {
								<span class="by">{{ row.mine ? ('CHAT.PROFILE.YOU' | translate) : who.name }}</span>
							}
							<span class="text" [class.deleted]="row.deleted" [attr.title]="row.at | date: 'medium'">
								{{ row.deleted ? ('CHAT.MESSAGE.DELETED' | translate) : row.text }}
							</span>
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
			/* The latest messages as plain lines, the author's name over each run; the newest stays in sight. */
			.messages {
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
				max-height: min(14rem, calc(100vh - 16rem));
				padding: 0.25rem 0.5rem;
				overflow-y: auto;
			}
			.by {
				margin-top: 0.375rem;
				color: var(--gauzy-text-color-2, inherit);
				font-size: 0.75rem;
				line-height: 1rem;
			}
			.by:first-child {
				margin-top: 0;
			}
			.text {
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

	private readonly myUserId = toSignal(
		(inject(Store).user$ as Observable<IUser | null | undefined>).pipe(
			map((user) => (user?.id ? String(user.id) : null)),
			distinctUntilChanged()
		),
		{ initialValue: null }
	);

	protected readonly conversation = signal<IChatConversationWithState | null>(null);
	private readonly messages = signal<IChatMessageWithRelations[]>([]);
	protected readonly failed = signal(false);
	protected readonly sending = signal(false);
	protected readonly draft = signal('');

	/** The messages as lines, oldest first. */
	protected readonly rows = computed<DockMessage[]>(() => {
		const me = this.myUserId();
		const who = this.person();
		const people = new Map<string, ChatPerson>(who ? [[who.employeeId, who]] : []);
		let previous: string | null = null;
		return this.messages().map((message) => {
			const author = String(message.authorUserId ?? '');
			const first = author !== previous;
			previous = author;
			return {
				id: String(message.id),
				text: plainBody(message.body ?? '', people, new Map()),
				mine: !!me && author === me,
				deleted: !!message.deletedAt,
				at: message.createdAt,
				first
			};
		});
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
			this.rows();
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
		const me = this.myUserId();
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
