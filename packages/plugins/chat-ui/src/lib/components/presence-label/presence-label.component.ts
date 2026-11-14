import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, LOCALE_ID, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ChatPresence } from '../../chat-presence';
import { ChatPresenceService } from '../../services/chat-presence.service';

/** What the label says of someone not here. */
export type LastSeenText =
	| { key: 'CHAT.PRESENCE.OFFLINE' }
	| { key: 'CHAT.PRESENCE.LAST_SEEN_JUST_NOW' }
	| { key: 'CHAT.PRESENCE.LAST_SEEN_MINUTES'; count: number }
	| { key: 'CHAT.PRESENCE.LAST_SEEN_TODAY'; at: number }
	| { key: 'CHAT.PRESENCE.LAST_SEEN_DATE'; at: number };

/** "Last seen …" for a time: just now, minutes ago within the hour, the time earlier today, the date before that. */
export function lastSeenText(lastSeenAt: number | null, now: number = Date.now()): LastSeenText {
	if (!lastSeenAt) return { key: 'CHAT.PRESENCE.OFFLINE' };
	const minutes = Math.floor((now - lastSeenAt) / 60_000);
	if (minutes < 1) return { key: 'CHAT.PRESENCE.LAST_SEEN_JUST_NOW' };
	if (minutes < 60) return { key: 'CHAT.PRESENCE.LAST_SEEN_MINUTES', count: minutes };
	const seen = new Date(lastSeenAt);
	const today = new Date(now);
	const sameDay = seen.getFullYear() === today.getFullYear() && seen.getMonth() === today.getMonth() && seen.getDate() === today.getDate();
	return sameDay ? { key: 'CHAT.PRESENCE.LAST_SEEN_TODAY', at: lastSeenAt } : { key: 'CHAT.PRESENCE.LAST_SEEN_DATE', at: lastSeenAt };
}

/** How often "minutes ago" moves on. */
const PRESENCE_LABEL_TICK_MS = 30_000;

/**
 * Whether a person is here, in words: "Online", "Away", or when they were last seen, with a dot in the same colour as
 * the one on their avatar. Shown under a direct conversation's title and on a person's card.
 */
@Component({
	selector: 'ngx-chat-presence-label',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<span class="label" data-test="presence-label" [class]="presence()">
			<span class="dot" aria-hidden="true"></span>
			@switch (presence()) {
				@case ('online') {
					{{ 'CHAT.PRESENCE.ONLINE' | translate }}
				}
				@case ('away') {
					{{ 'CHAT.PRESENCE.AWAY' | translate }}
				}
				@default {
					@let text = lastSeen();
					{{ text.key | translate: text.params }}
				}
			}
		</span>
	`,
	styles: [
		`
			:host {
				display: inline-flex;
				min-width: 0;
			}
			.label {
				display: inline-flex;
				align-items: center;
				gap: 0.375rem;
				font-size: 0.75rem;
				line-height: 1.2;
				color: var(--chat-muted, var(--text-hint-color));
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}
			.dot {
				flex: 0 0 auto;
				width: 0.5rem;
				height: 0.5rem;
				border-radius: 50%;
				background: var(--text-hint-color);
			}
			.online .dot {
				background: var(--color-success-default);
			}
			.away .dot {
				background: var(--color-warning-default);
			}
		`
	]
})
export class PresenceLabelComponent {
	readonly employeeId = input<string | null | undefined>(null);

	private readonly presenceService = inject(ChatPresenceService);
	private readonly locale = inject(LOCALE_ID);
	private readonly now = signal(Date.now());

	readonly presence = computed<ChatPresence>(() => this.presenceService.presenceOf(this.employeeId()));
	/** The words for someone not here, and what they take (minutes, a time, a date in the app's locale). */
	readonly lastSeen = computed(() => {
		const text = lastSeenText(this.presenceService.lastSeenOf(this.employeeId()), this.now());
		switch (text.key) {
			case 'CHAT.PRESENCE.LAST_SEEN_MINUTES':
				return { key: text.key, params: { count: text.count } };
			case 'CHAT.PRESENCE.LAST_SEEN_TODAY':
				return { key: text.key, params: { time: formatDate(text.at, 'shortTime', this.locale) } };
			case 'CHAT.PRESENCE.LAST_SEEN_DATE':
				return { key: text.key, params: { date: formatDate(text.at, 'mediumDate', this.locale) } };
			default:
				return { key: text.key, params: {} };
		}
	});

	constructor() {
		const timer = setInterval(() => this.now.set(Date.now()), PRESENCE_LABEL_TICK_MS);
		inject(DestroyRef).onDestroy(() => clearInterval(timer));
	}
}
