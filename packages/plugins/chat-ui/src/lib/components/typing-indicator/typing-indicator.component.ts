import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { interval } from 'rxjs';
import { afterHint, ChatTypingState, typingLine, typistsIn, withoutExpired, withTyping } from '../../chat-typing';
import { ChatLiveService } from '../../services/chat-live.service';
import { ChatPeople } from '../../services/chat-people.service';

/** How often the line drops the signals past their time. */
const TYPING_SWEEP_MS = 1000;

/**
 * "Anna is typing…" under a conversation or a thread: the members' typing signals of the live channel (the platform's
 * `typing.signalled`, addressed to the members), each shown for the few seconds it asks unless told again, and ended by
 * a message from its typist. Nothing shows where the platform has no live channel. Announced politely to assistive
 * technology.
 */
@Component({
	selector: 'ngx-chat-typing-indicator',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<div class="typing" aria-live="polite" data-test="typing-indicator">
			@if (line(); as line) {
				<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
				<span>{{ line.key | translate: line.params }}</span>
			}
		</div>
	`,
	styles: [
		`
			.typing {
				display: flex;
				align-items: center;
				gap: 0.375rem;
				min-height: 1.125rem;
				padding: 0 1rem;
				font-size: 0.75rem;
				opacity: 0.7;
			}
			.dots {
				display: inline-flex;
				gap: 2px;
			}
			.dots i {
				width: 4px;
				height: 4px;
				border-radius: 50%;
				background: currentColor;
				animation: chat-typing 1.2s infinite ease-in-out;
			}
			.dots i:nth-child(2) {
				animation-delay: 0.2s;
			}
			.dots i:nth-child(3) {
				animation-delay: 0.4s;
			}
			@keyframes chat-typing {
				0%,
				80%,
				100% {
					opacity: 0.25;
				}
				40% {
					opacity: 1;
				}
			}
			@media (prefers-reduced-motion: reduce) {
				.dots i {
					animation: none;
				}
			}
		`
	]
})
export class TypingIndicatorComponent {
	readonly conversationId = input.required<string>();
	/** The thread, for the line under a thread; null under the conversation itself. */
	readonly threadRootId = input<string | null>(null);
	readonly people = input.required<ChatPeople>();
	readonly meUserId = input<string | null>(null);

	private readonly state = signal<ChatTypingState>(new Map());
	private readonly now = signal(Date.now());

	protected readonly line = computed(() => {
		const people = this.people();
		const userIds = typistsIn(this.state(), { conversationId: this.conversationId(), threadRootId: this.threadRootId() }, this.meUserId(), this.now());
		const names = userIds.map((userId) => people.byUser.get(userId)?.name).filter((name): name is string => !!name);
		return typingLine(names);
	});

	constructor() {
		const live = inject(ChatLiveService);
		const destroyRef = inject(DestroyRef);
		live.typing$.pipe(takeUntilDestroyed(destroyRef)).subscribe((typing) => {
			this.now.set(Date.now());
			this.state.update((state) => withTyping(state, typing));
		});
		live.hints$.pipe(takeUntilDestroyed(destroyRef)).subscribe((hint) => this.state.update((state) => afterHint(state, hint)));
		interval(TYPING_SWEEP_MS)
			.pipe(takeUntilDestroyed(destroyRef))
			.subscribe(() => {
				if (!this.state().size) return;
				const now = Date.now();
				this.now.set(now);
				this.state.update((state) => withoutExpired(state, now));
			});
	}
}
