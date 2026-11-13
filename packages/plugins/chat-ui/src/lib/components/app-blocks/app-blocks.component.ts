import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { EMPTY, throwError, timer } from 'rxjs';
import { catchError, exhaustMap, retry, take, takeWhile, timeout } from 'rxjs/operators';
import { ChatAppBlockTypeEnum, IChatAppBlock, IChatAppButton, IChatMessageWithRelations, ID } from '@gauzy/contracts';
import {
	APP_INTERACTION_POLL_MAX,
	APP_INTERACTION_POLL_MS,
	APP_INTERACTION_RETRY_DELAYS_MS,
	APP_INTERACTION_TIMEOUT_MS,
	appBlocksOf,
	AppButtonState,
	buttonKey,
	buttonStateOf,
	isUnansweredClick,
	keepsClickKey,
	safeButtonUrl
} from '../../chat-app-blocks';
import { newNonce } from '../../chat-ui.helpers';
import { ChatWebhooksService } from '../../services/chat-webhooks.service';

/**
 * The layout of an app message (an incoming webhook's post): a title, paragraphs, fields side by side, dividers,
 * small context text and buttons. Every text is plain text (Angular interpolation, never HTML). A link button opens
 * its https page; any other button is an interaction: it calls the chat API, which posts a signed callback to the
 * app, and shows pending until the callback is delivered (asking again while it is retried) or failed. The app's
 * reply, when it replaced the message, is handed up (`replaced`). Each click carries an idempotency key of its own,
 * sent again with every retry of that click (see `click`), so a click is one interaction however often it is sent.
 */
@Component({
	selector: 'ngx-chat-app-blocks',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbIconModule, TranslatePipe],
	template: `
		<div class="app-blocks" data-test="app-blocks">
			@for (block of blocks(); track $index) {
				@switch (block.type) {
					@case (types.HEADER) {
						<p class="app-header" data-test="app-header">{{ textOf(block) }}</p>
					}
					@case (types.SECTION) {
						@if (textOf(block)) {
							<p class="app-text">{{ textOf(block) }}</p>
						}
						@if (fieldsOf(block).length) {
							<div class="app-fields" data-test="app-fields">
								@for (field of fieldsOf(block); track $index) {
									<div class="app-field">{{ field }}</div>
								}
							</div>
						}
					}
					@case (types.DIVIDER) {
						<hr class="app-divider" />
					}
					@case (types.CONTEXT) {
						<p class="app-context">{{ contextOf(block) }}</p>
					}
					@case (types.TEXT) {
						<p class="app-text">{{ textOf(block) }}</p>
					}
					@case (types.ACTIONS) {
						<div class="app-actions" role="group" data-test="app-actions">
							@for (button of buttonsOf(block); track button.actionId) {
								@if (linkOf(button); as url) {
									<a class="app-button" [class.primary]="button.style === 'primary'" [class.danger]="button.style === 'danger'" [href]="url" target="_blank" rel="noopener noreferrer nofollow">
										{{ button.text }}
										<nb-icon icon="external-link-outline"></nb-icon>
									</a>
								} @else {
									<button
										type="button"
										class="app-button"
										[class.primary]="button.style === 'primary'"
										[class.danger]="button.style === 'danger'"
										[attr.data-test]="'app-button-' + button.actionId"
										[attr.aria-busy]="stateOf(blockIdOf(block), button) === 'pending'"
										[disabled]="readOnly() || stateOf(blockIdOf(block), button) === 'pending'"
										(click)="click(blockIdOf(block), button)"
									>
										{{ button.text }}
										@switch (stateOf(blockIdOf(block), button)) {
											@case ('pending') {
												<span class="state" [attr.aria-label]="'CHAT.APP.PENDING' | translate"><nb-icon icon="loader-outline" class="spin"></nb-icon></span>
											}
											@case ('done') {
												<span class="state" [attr.aria-label]="'CHAT.APP.DONE' | translate"><nb-icon icon="checkmark-outline"></nb-icon></span>
											}
											@case ('failed') {
												<span class="state failed" [attr.aria-label]="'CHAT.APP.FAILED' | translate"><nb-icon icon="alert-circle-outline"></nb-icon></span>
											}
										}
									</button>
								}
							}
						</div>
						@if (failureOf(blockIdOf(block)); as failure) {
							<p class="app-failure" role="alert" data-test="app-failure">{{ failure | translate }}</p>
						}
					}
				}
			}
		</div>
	`,
	styles: [
		`
			.app-blocks {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
				margin: 0.25rem 0;
				padding-left: 0.5rem;
				border-left: 3px solid var(--chat-border-strong);
			}
			.app-header {
				margin: 0;
				font-weight: 600;
				font-size: 0.9375rem;
			}
			.app-text {
				margin: 0;
				white-space: pre-line;
				overflow-wrap: anywhere;
			}
			.app-fields {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
				gap: 0.25rem 1rem;
				margin: 0;
			}
			.app-field {
				white-space: pre-line;
				overflow-wrap: anywhere;
				font-size: 0.875rem;
			}
			.app-divider {
				width: 100%;
				margin: 0.25rem 0;
				border: 0;
				border-top: 1px solid var(--chat-border);
			}
			.app-context {
				margin: 0;
				font-size: 0.75rem;
				opacity: 0.7;
			}
			.app-actions {
				display: flex;
				flex-wrap: wrap;
				gap: 0.5rem;
			}
			.app-button {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				min-height: 2rem;
				padding: 0.25rem 1rem;
				border: 1px solid var(--chat-border-strong);
				border-radius: var(--border-radius);
				background: transparent;
				color: inherit;
				font-size: 0.8125rem;
				text-decoration: none;
				cursor: pointer;
			}
			.app-button.primary {
				border-color: var(--chat-accent);
				color: var(--chat-accent);
			}
			.app-button.danger {
				border-color: var(--chat-danger);
				color: var(--chat-danger);
			}
			.app-button:disabled {
				cursor: default;
				opacity: 0.7;
			}
			.app-button nb-icon {
				font-size: 0.875rem;
			}
			.state.failed {
				color: var(--chat-danger);
			}
			.spin {
				animation: app-spin 1s linear infinite;
			}
			@keyframes app-spin {
				to {
					transform: rotate(360deg);
				}
			}
			@media (prefers-reduced-motion: reduce) {
				.spin {
					animation: none;
				}
			}
			.app-failure {
				margin: 0;
				font-size: 0.75rem;
				color: var(--chat-danger);
			}
		`
	]
})
export class AppBlocksComponent {
	private readonly api = inject(ChatWebhooksService);
	private readonly destroyRef = inject(DestroyRef);

	readonly message = input.required<IChatMessageWithRelations>();
	/** An archived conversation, or a reader who may not write: the buttons show but do not click. */
	readonly readOnly = input(false);
	/** The message as the app's reply left it. */
	readonly replaced = output<IChatMessageWithRelations>();

	protected readonly blocks = computed(() => appBlocksOf(this.message()));
	private readonly states = signal<ReadonlyMap<string, AppButtonState>>(new Map());
	/** Why the last click of an actions block failed, by block id (a translation key). */
	private readonly failures = signal<ReadonlyMap<string, string>>(new Map());
	/** The idempotency key of each button's click that got no answer yet (by button key): its next click sends it again. */
	private readonly unanswered = new Map<string, string>();

	protected readonly types = ChatAppBlockTypeEnum;

	protected textOf(block: IChatAppBlock): string {
		return 'text' in block && typeof block.text === 'string' ? block.text : '';
	}

	protected fieldsOf(block: IChatAppBlock): string[] {
		return block.type === ChatAppBlockTypeEnum.SECTION ? (block.fields ?? []) : [];
	}

	protected contextOf(block: IChatAppBlock): string {
		return block.type === ChatAppBlockTypeEnum.CONTEXT ? block.elements.join(' · ') : '';
	}

	protected buttonsOf(block: IChatAppBlock): IChatAppButton[] {
		return block.type === ChatAppBlockTypeEnum.ACTIONS ? block.elements : [];
	}

	protected blockIdOf(block: IChatAppBlock): string | null {
		return block.type === ChatAppBlockTypeEnum.ACTIONS ? (block.blockId ?? null) : null;
	}

	protected linkOf(button: IChatAppButton): string | null {
		return safeButtonUrl(button);
	}

	protected stateOf(blockId: string | null | undefined, button: IChatAppButton): AppButtonState | null {
		return this.states().get(buttonKey(blockId, button.actionId)) ?? null;
	}

	protected failureOf(blockId: string | null | undefined): string | null {
		return this.failures().get(blockId ?? '') ?? null;
	}

	protected click(blockId: string | null, button: IChatAppButton): void {
		const key = buttonKey(blockId, button.actionId);
		if (this.readOnly() || this.states().get(key) === 'pending') return;
		this.setState(key, 'pending');
		this.setFailure(blockId, null);
		// One key per click, sent again on each retry of it, and on the next click of a button whose click got no
		// answer (the API may have taken it): the API answers a repeat with that click and calls the app no second time.
		const idempotencyKey = this.unanswered.get(key) ?? newNonce();
		this.unanswered.set(key, idempotencyKey);
		this.api
			.interact(this.message().id as ID, button.actionId, blockId, idempotencyKey)
			.pipe(
				// A send still open after the deadline counts as unanswered (a timeout has no status). A click that got no
				// answer is sent again (the same request, so the same key, each send with its own deadline); any answer
				// settles it.
				timeout(APP_INTERACTION_TIMEOUT_MS),
				retry({
					count: APP_INTERACTION_RETRY_DELAYS_MS.length,
					delay: (error: { status?: number }, attempt: number) => (isUnansweredClick(error?.status) ? timer(APP_INTERACTION_RETRY_DELAYS_MS[attempt - 1]) : throwError(() => error))
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe({
				next: (result) => {
					this.unanswered.delete(key);
					if (result.message) this.replaced.emit(result.message);
					const state = buttonStateOf(result.interaction.status);
					// A repeat answered as delivered without its reply: the first request may be applying the reply right
					// now (the API writes the delivery just before), so it is asked about once more, as a retry's is, and
					// the button stays pending (so disabled) until that ask answers.
					const replyMayFollow = !!result.replayed && state === 'done' && !result.interaction.replyApplied;
					this.setState(key, replyMayFollow ? 'pending' : state);
					if (state === 'failed') this.setFailure(blockId, 'CHAT.APP.CALLBACK_FAILED');
					if (state === 'pending' || replyMayFollow) this.follow(key, blockId, result.interaction.interactionId, replyMayFollow);
				},
				error: (error: { status?: number }) => {
					// A refusal settles the click (the next one is a new click); a click with no answer, or a server error
					// (the app may have been called), keeps its key for the button's next click.
					if (!keepsClickKey(error?.status)) this.unanswered.delete(key);
					this.setState(key, 'failed');
					this.setFailure(blockId, error?.status === 409 ? 'CHAT.APP.NO_INTERACTIONS' : error?.status === 404 ? 'CHAT.APP.GONE' : 'CHAT.APP.CLICK_FAILED');
				}
			});
	}

	/**
	 * Asks again about a click whose callback is being retried, until it settles or the page stops asking. A retry the
	 * app answered with a reply replaced the message on the server: the message is read again and handed up, so the
	 * page shows the reply without waiting for realtime. The API writes a retry's delivery just before it applies the
	 * reply, so a delivery without its reply is asked about once more. A slow answer is waited for (the next ask is
	 * skipped, not the answer). When the asking stops first, the button clicks again and says the app has not answered
	 * yet. `delivered`: the click's own answer already said it was delivered (a repeat answered before its reply landed):
	 * only the one more ask is left, and the button ends done whatever it answers.
	 */
	private follow(key: string, blockId: string | null, interactionId: ID, delivered = false): void {
		let settled = false;
		let lookedAgain = delivered;
		/** A delivery without its reply was seen, and the one more ask is under way. */
		let deliveredSeen = delivered;
		timer(APP_INTERACTION_POLL_MS, APP_INTERACTION_POLL_MS)
			.pipe(
				take(APP_INTERACTION_POLL_MAX),
				// A failed ask is asked again at the next tick (the click may still be delivered), and so is one still open
				// after the deadline; a 404 (the click or the webhooks are gone) ends the asking.
				exhaustMap(() =>
					this.api.interaction(interactionId).pipe(
						timeout(APP_INTERACTION_TIMEOUT_MS),
						catchError((error: { status?: number }) => (error?.status === 404 ? throwError(() => error) : EMPTY))
					)
				),
				takeWhile((interaction) => {
					const state = buttonStateOf(interaction.status);
					if (state === 'pending') return true;
					if (state === 'done' && !interaction.replyApplied && !lookedAgain) {
						lookedAgain = true;
						return true;
					}
					return false;
				}, true),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe({
				next: (interaction) => {
					const state = buttonStateOf(interaction.status);
					if (state === 'pending') return;
					// A delivery without its reply, with the one more ask still to come: the button stays pending (and so
					// disabled) until that ask answers, so no second click starts while this one is followed.
					if (state === 'done' && !interaction.replyApplied && !deliveredSeen) {
						deliveredSeen = true;
						return;
					}
					settled = true;
					this.setState(key, state);
					if (state === 'failed') this.setFailure(blockId, 'CHAT.APP.CALLBACK_FAILED');
					if (interaction.replyApplied) this.readReplaced(interaction.conversationId, interaction.messageId);
				},
				error: () => {
					settled = true;
					// The click was delivered already: only the extra ask failed.
					if (deliveredSeen) {
						this.setState(key, 'done');
						return;
					}
					this.setState(key, 'failed');
					this.setFailure(blockId, 'CHAT.APP.CLICK_FAILED');
				},
				complete: () => {
					if (settled) return;
					if (deliveredSeen) {
						this.setState(key, 'done');
						return;
					}
					this.setState(key, null);
					this.setFailure(blockId, 'CHAT.APP.NO_ANSWER_YET');
				}
			});
	}

	/** The message as an app's reply left it, read again and handed up. */
	private readReplaced(conversationId: ID, messageId: ID): void {
		this.api
			.message(conversationId, messageId)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (message) => {
					if (message) this.replaced.emit(message);
				},
				// The button already says the click was delivered; realtime or the next read shows the reply.
				error: () => undefined
			});
	}

	private setState(key: string, state: AppButtonState | null): void {
		const next = new Map(this.states());
		if (state) next.set(key, state);
		else next.delete(key);
		this.states.set(next);
	}

	private setFailure(blockId: string | null, failure: string | null): void {
		const next = new Map(this.failures());
		if (failure) next.set(blockId ?? '', failure);
		else next.delete(blockId ?? '');
		this.failures.set(next);
	}
}
