import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { NbBadgeModule, NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { EMPTY, merge, Subject, timer } from 'rxjs';
import { auditTime, catchError, filter, switchMap, takeUntil } from 'rxjs/operators';
import { CHAT_EVENT_NAMES, IChatStates } from '@gauzy/contracts';
import { CHAT_BADGE_POLL_MS, CHAT_LINK, CHAT_LIVE_LIST_AUDIT_MS } from '../../chat-ui.constants';
import { badgeText } from '../../chat-ui.helpers';
import { ChatAvailabilityService, isFinalRefusal } from '../../services/chat-availability.service';
import { ChatHint, coalesceReads } from '../../services/chat-live';
import { ChatLiveService, isTabVisible } from '../../services/chat-live.service';
import { ChatUiService } from '../../services/chat-ui.service';

/** How many conversations hold unread messages, plus the followed threads with unread replies. */
export function unreadOf(states: IChatStates | null | undefined): number {
	const conversations = (states?.states ?? []).filter((state) => (state.unreadCount ?? 0) > 0 || (state.mentionCount ?? 0) > 0).length;
	const threads = (states?.threads ?? []).filter((thread) => (thread.unreadReplies ?? 0) > 0).length;
	return conversations + threads;
}

/** The chat events that can move the badge's count: my state, a message created or deleted, a thread, a membership. */
const BADGE_EVENTS = new Set<string>([
	CHAT_EVENT_NAMES.MEMBER_STATE_CHANGED,
	CHAT_EVENT_NAMES.MESSAGE_CREATED,
	CHAT_EVENT_NAMES.MESSAGE_DELETED,
	CHAT_EVENT_NAMES.THREAD_CHANGED,
	CHAT_EVENT_NAMES.CONVERSATION_CHANGED
]);

/** Whether a chat event can change how many conversations and threads hold something unread. */
export function movesBadge(hint: Pick<ChatHint, 'name'>): boolean {
	return BADGE_EVENTS.has(hint.name);
}

/** The chat icon of the header with the count of conversations and threads holding something unread. */
@Component({
	selector: 'ngx-chat-header-badge',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink, NbBadgeModule, NbIconModule, TranslatePipe],
	template: `
		<a
			class="chat-badge"
			data-test="chat-badge"
			[routerLink]="link"
			[attr.aria-label]="'CHAT.BADGE_LABEL' | translate: { count: unread() }"
			[attr.title]="'CHAT.BADGE_LABEL' | translate: { count: unread() }"
		>
			<nb-icon icon="message-circle-outline"></nb-icon>
			@if (text()) {
				<nb-badge data-test="chat-badge-count" [text]="text()" status="danger" position="top right"></nb-badge>
			}
		</a>
	`,
	styles: [
		`
			.chat-badge {
				position: relative;
				display: inline-flex;
				align-items: center;
				padding: 0 0.25rem;
				color: inherit;
			}
		`
	]
})
export class ChatHeaderBadgeComponent implements OnInit {
	private readonly api = inject(ChatUiService);
	private readonly live = inject(ChatLiveService);
	private readonly availability = inject(ChatAvailabilityService);
	private readonly destroyRef = inject(DestroyRef);
	/** A final refusal (the chat went away for this scope) stops the polling until the scope changes. */
	private readonly refused$ = new Subject<void>();

	protected readonly link = CHAT_LINK;
	protected readonly unread = signal(0);
	protected readonly text = signal('');

	ngOnInit(): void {
		this.startPolling();
	}

	/**
	 * Reads my states, anew for every scope the chat is served in: at once, after every write of the page, when a chat
	 * event that moves a count arrives (live; a burst is read once), after a reconnect, and on a timer as the fallback.
	 */
	private startPolling(): void {
		this.availability.scope$
			.pipe(
				switchMap((scope) => {
					this.show(0);
					if (!scope) return EMPTY;
					const events$ = this.live.hints$.pipe(
						filter((hint) => movesBadge(hint) && isTabVisible()),
						auditTime(CHAT_LIVE_LIST_AUDIT_MS)
					);
					return merge(timer(0), this.live.ticks(CHAT_BADGE_POLL_MS), this.api.changed$, events$, this.live.catchUp$).pipe(
						// A read under way finishes; triggers meanwhile ask for one more after it.
						coalesceReads(() => this.readStates()),
						takeUntil(this.refused$)
					);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((states) => this.show(unreadOf(states)));
	}

	private readStates() {
		return this.api.states().pipe(
			catchError((error: HttpErrorResponse) => {
				if (isFinalRefusal(error)) {
					this.show(0);
					this.refused$.next();
				}
				return EMPTY;
			})
		);
	}

	private show(unread: number): void {
		this.unread.set(unread);
		this.text.set(badgeText(unread));
	}
}
