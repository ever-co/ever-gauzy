import { HttpErrorResponse } from '@angular/common/http';
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
import { NbButtonModule, NbIconModule, NbSelectModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EMPTY, Subscription, timer } from 'rxjs';
import { catchError, filter, switchMap } from 'rxjs/operators';
import {
	ChatConversationKindEnum,
	ChatMemberRoleEnum,
	ChatNotifyLevelEnum,
	IChatConversationWithState,
	IChatMemberState,
	IChatMessageWithRelations
} from '@gauzy/contracts';
import { ToastrService } from '@gauzy/ui-core/core';
import { CHAT_MESSAGES_POLL_MS } from '../../chat-ui.constants';
import { continuesGroup, conversationTitle, mergeMessages, newNonce } from '../../chat-ui.helpers';
import { ChatPeople } from '../../services/chat-people.service';
import { ChatUiService } from '../../services/chat-ui.service';
import { ComposerSubmission, MessageComposerComponent } from '../message-composer/message-composer.component';
import { MessageAction, MessageItemComponent } from '../message-item/message-item.component';

/** How close to the bottom (px) counts as "reading the latest", for auto-scroll and read-on-view. */
const NEAR_BOTTOM_PX = 80;

/**
 * One conversation: its header (title, members, favourite, notifications, join / leave, archive, pins), the
 * messages (newest page first, older on scroll, newer by polling), and the composer. Opening it with unread
 * messages marks it read; "mark unread from here" is explicit.
 */
@Component({
	selector: 'ngx-chat-conversation-view',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbButtonModule, NbIconModule, NbSelectModule, NbSpinnerModule, NbTooltipModule, TranslatePipe, MessageComposerComponent, MessageItemComponent],
	template: `
		<section class="view" data-test="conversation-view">
			<header class="header">
				<div class="heading">
					<h5 class="title">{{ title() }}</h5>
					@if (conversation().topic) {
						<span class="topic">{{ conversation().topic }}</span>
					}
					<span class="members">{{ 'CHAT.LIST.MEMBERS' | translate: { count: conversation().memberCount } }}</span>
				</div>
				<div class="actions">
					<button nbButton ghost size="tiny" type="button" data-test="favorite" [nbTooltip]="(state()?.isFavorite ? 'CHAT.VIEW.UNFAVORITE' : 'CHAT.VIEW.FAVORITE') | translate" (click)="toggleFavorite()">
						<nb-icon [icon]="state()?.isFavorite ? 'star' : 'star-outline'"></nb-icon>
					</button>
					@if (isMember()) {
						<nb-select size="tiny" data-test="notify-level" [selected]="state()?.notifyLevel ?? 'all'" (selectedChange)="setNotifyLevel($event)" [placeholder]="'CHAT.VIEW.NOTIFY' | translate">
							<nb-option value="all">{{ 'CHAT.VIEW.NOTIFY_ALL' | translate }}</nb-option>
							<nb-option value="mentions">{{ 'CHAT.VIEW.NOTIFY_MENTIONS' | translate }}</nb-option>
							<nb-option value="muted">{{ 'CHAT.VIEW.NOTIFY_MUTED' | translate }}</nb-option>
						</nb-select>
					}
					<button nbButton ghost size="tiny" type="button" data-test="pins" [class.active]="pinsOpen()" [nbTooltip]="'CHAT.VIEW.PINNED' | translate" (click)="togglePins()">
						<nb-icon icon="pin-outline"></nb-icon>
					</button>
					@if (!isMember()) {
						<button nbButton status="primary" size="tiny" type="button" data-test="join" (click)="join()">{{ 'CHAT.VIEW.JOIN' | translate }}</button>
					} @else if (canLeave()) {
						<button nbButton ghost size="tiny" type="button" data-test="leave" (click)="leave()">{{ 'CHAT.VIEW.LEAVE' | translate }}</button>
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
						[placeholder]="'CHAT.COMPOSER.PLACEHOLDER' | translate: { name: title() }"
						[disabled]="sending()"
						[editing]="editing() !== null"
						[initialBody]="editing()?.body ?? null"
						[resetToken]="resetToken()"
						(submitted)="onSubmit($event)"
						(cancel)="editing.set(null)"
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
	readonly untitled = input('Conversation');
	/** A message to scroll to and highlight (a deep link). */
	readonly highlightId = input<string | null>(null);

	readonly openThread = output<IChatMessageWithRelations>();
	readonly stateChanged = output<IChatMemberState>();
	readonly conversationChanged = output<IChatConversationWithState>();
	readonly left = output<void>();

	private readonly scroller = viewChild<ElementRef<HTMLDivElement>>('scroller');

	readonly messages = signal<IChatMessageWithRelations[]>([]);
	readonly hasBefore = signal(false);
	readonly loading = signal(false);
	readonly loadingOlder = signal(false);
	readonly error = signal(false);
	readonly sending = signal(false);
	readonly editing = signal<IChatMessageWithRelations | null>(null);
	readonly resetToken = signal(0);
	readonly newBelow = signal(false);
	readonly pinsOpen = signal(false);
	readonly pins = signal<IChatMessageWithRelations[]>([]);
	/** The caller's state, kept here so a read / favourite change shows at once. */
	readonly state = signal<IChatMemberState | null>(null);

	readonly title = computed(() => conversationTitle(this.conversation(), this.people().byEmployee, this.meEmployeeId(), this.untitled()));
	readonly isMember = computed(() => this.state() !== null);
	readonly canLeave = computed(() => this.isMember() && !this.conversation().isDefault && this.conversation().kind !== ChatConversationKindEnum.DIRECT);
	readonly canManage = computed(() => this.isAdmin() || this.state()?.role === ChatMemberRoleEnum.MANAGER);
	readonly readOnly = computed(() => !!this.conversation().archivedAt || !this.isMember());

	private poll: Subscription | null = null;
	private loadedId: string | null = null;

	constructor() {
		effect(() => {
			const conversation = this.conversation();
			untracked(() => {
				this.state.set(conversation.state ?? null);
				if (this.loadedId !== String(conversation.id)) {
					this.loadedId = String(conversation.id);
					this.editing.set(null);
					this.pinsOpen.set(false);
					this.newBelow.set(false);
					this.reload();
				}
			});
		});
		this.destroyRef.onDestroy(() => this.poll?.unsubscribe());
	}

	// ---------------------------------------------------------------- loading

	reload(): void {
		const id = this.conversation().id;
		this.loading.set(true);
		this.error.set(false);
		this.messages.set([]);
		const highlight = this.highlightId();
		this.api
			.messages(id, highlight ? { around: highlight } : {})
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (page) => {
					if (String(this.conversation().id) !== String(id)) return;
					this.messages.set(mergeMessages([], page.messages));
					this.hasBefore.set(page.hasBefore);
					this.loading.set(false);
					queueMicrotask(() => (highlight ? this.scrollTo(highlight) : this.scrollToBottom(false)));
					this.markReadIfVisible();
					this.startPolling();
				},
				error: () => {
					this.loading.set(false);
					this.error.set(true);
				}
			});
	}

	protected loadOlder(): void {
		const first = this.messages()[0];
		if (!first || this.loadingOlder()) return;
		const element = this.scroller()?.nativeElement;
		const heightBefore = element?.scrollHeight ?? 0;
		this.loadingOlder.set(true);
		this.api
			.messages(this.conversation().id, { before: first.id })
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (page) => {
					this.messages.set(mergeMessages(this.messages(), page.messages));
					this.hasBefore.set(page.hasBefore);
					this.loadingOlder.set(false);
					queueMicrotask(() => {
						if (element) element.scrollTop += element.scrollHeight - heightBefore;
					});
				},
				error: () => this.loadingOlder.set(false)
			});
	}

	private startPolling(): void {
		this.poll?.unsubscribe();
		const id = this.conversation().id;
		this.poll = timer(CHAT_MESSAGES_POLL_MS, CHAT_MESSAGES_POLL_MS)
			.pipe(
				filter(() => typeof document === 'undefined' || !document.hidden),
				switchMap(() => {
					const last = this.messages()[this.messages().length - 1];
					return this.api.messages(id, last ? { after: last.id } : {}).pipe(catchError(() => EMPTY));
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((page) => {
				if (page.messages.length === 0) return;
				const wasNearBottom = this.isNearBottom();
				this.messages.set(mergeMessages(this.messages(), page.messages));
				if (wasNearBottom) {
					queueMicrotask(() => this.scrollToBottom(false));
					this.markReadIfVisible();
				} else {
					this.newBelow.set(true);
				}
			});
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

	private markReadIfVisible(): void {
		const state = this.state();
		if (!state || (state.unreadCount ?? 0) === 0 && (state.mentionCount ?? 0) === 0) return;
		if (typeof document !== 'undefined' && document.hidden) return;
		const id = this.conversation().id;
		this.api
			.read(id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (answer) => {
					this.state.set(answer.state);
					this.stateChanged.emit(answer.state);
					this.api.notifyChanged();
				},
				error: () => undefined
			});
	}

	protected toggleFavorite(): void {
		const current = this.state();
		this.api
			.setState(this.conversation().id, { isFavorite: !current?.isFavorite })
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({ next: (answer) => this.applyState(answer.state), error: (error) => this.fail(error) });
	}

	protected setNotifyLevel(level: ChatNotifyLevelEnum | string): void {
		if (!level || level === this.state()?.notifyLevel) return;
		this.api
			.setState(this.conversation().id, { notifyLevel: level as ChatNotifyLevelEnum })
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({ next: (answer) => this.applyState(answer.state), error: (error) => this.fail(error) });
	}

	private applyState(state: IChatMemberState): void {
		this.state.set(state);
		this.stateChanged.emit(state);
	}

	// ---------------------------------------------------------------- membership and settings

	protected join(): void {
		this.api
			.join(this.conversation().id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (answer) => {
					this.conversationChanged.emit(answer.conversation);
					this.api.notifyChanged();
				},
				error: (error) => this.fail(error)
			});
	}

	protected leave(): void {
		this.api
			.leave(this.conversation().id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: () => {
					this.toastr.success('CHAT.VIEW.LEFT');
					this.api.notifyChanged();
					this.left.emit();
				},
				error: (error) => this.fail(error)
			});
	}

	protected toggleArchived(): void {
		this.api
			.setArchived(this.conversation().id, !this.conversation().archivedAt)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({ next: (answer) => this.conversationChanged.emit(answer.conversation), error: (error) => this.fail(error) });
	}

	protected togglePins(): void {
		const open = !this.pinsOpen();
		this.pinsOpen.set(open);
		if (open) this.loadPins();
	}

	private loadPins(): void {
		this.api
			.pins(this.conversation().id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({ next: (pins) => this.pins.set(pins), error: () => this.pins.set([]) });
	}

	// ---------------------------------------------------------------- messages

	protected onSubmit(submission: ComposerSubmission): void {
		const editing = this.editing();
		if (editing) {
			this.sending.set(true);
			this.api
				.edit(editing.id, { body: submission.body, mentionEmployeeIds: submission.mentionEmployeeIds })
				.pipe(takeUntilDestroyed(this.destroyRef))
				.subscribe({
					next: (result) => {
						this.replace(result.message);
						this.editing.set(null);
						this.sending.set(false);
						this.resetToken.update((value) => value + 1);
					},
					error: (error) => {
						this.sending.set(false);
						this.fail(error, 'CHAT.COMPOSER.SEND_FAILED');
					}
				});
			return;
		}
		this.sending.set(true);
		this.api
			.send(this.conversation().id, { body: submission.body, nonce: newNonce(), mentionEmployeeIds: submission.mentionEmployeeIds })
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (result) => {
					this.messages.set(mergeMessages(this.messages(), [result.message]));
					this.sending.set(false);
					this.resetToken.update((value) => value + 1);
					queueMicrotask(() => this.scrollToBottom(true));
					this.api.notifyChanged();
				},
				error: (error) => {
					this.sending.set(false);
					this.fail(error, 'CHAT.COMPOSER.SEND_FAILED');
				}
			});
	}

	protected onAction(message: IChatMessageWithRelations, action: MessageAction): void {
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
						next: () => this.replace({ ...message, body: '', deletedAt: new Date() }),
						error: (error) => this.fail(error)
					});
				return;
			case 'pin':
				this.api
					.setPinned(message.id, action.pinned)
					.pipe(takeUntilDestroyed(this.destroyRef))
					.subscribe({
						next: (result) => {
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
					.subscribe({ next: (result) => this.replace(result.message), error: (error) => this.fail(error) });
				return;
			case 'unread':
				this.api
					.unreadFrom(message.id)
					.pipe(takeUntilDestroyed(this.destroyRef))
					.subscribe({
						next: (answer) => {
							this.applyState(answer.state);
							this.api.notifyChanged();
						},
						error: (error) => this.fail(error)
					});
				return;
			case 'follow':
				this.api
					.setFollowing(message.id, action.following)
					.pipe(takeUntilDestroyed(this.destroyRef))
					.subscribe({ next: () => this.replace({ ...message, following: action.following }), error: (error) => this.fail(error) });
				return;
			default:
				return;
		}
	}

	/** Puts the API's version of a message in place of ours. */
	replace(message: IChatMessageWithRelations): void {
		this.messages.set(this.messages().map((item) => (item.id === message.id ? { ...item, ...message } : item)));
	}

	private fail(error: unknown, fallbackKey = 'CHAT.DIALOG.FAILED'): void {
		const body = (error as HttpErrorResponse)?.error;
		const message = body?.message;
		const text = Array.isArray(message) ? message.join(' ') : typeof message === 'string' && message.trim() ? message : null;
		if (text) this.toastr.danger(text);
		else this.toastr.danger(this.translate.instant(fallbackKey));
	}
}
