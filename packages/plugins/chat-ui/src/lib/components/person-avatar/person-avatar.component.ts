import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { ChatPerson, initialsOf, nameHue, ownPicture } from '../../chat-ui.helpers';
import { ChatPresenceService } from '../../services/chat-presence.service';

/** The sizes an avatar comes in: a list row, a message, a conversation intro. */
export type PersonAvatarSize = 'tiny' | 'small' | 'medium' | 'normal' | 'large';

/**
 * A person's picture, or their initials on a disc tinted from their name (the same name always gets the same
 * colour) when they have none. Square with rounded corners by default, as chat apps draw people; `round` for a
 * circle. A dot at its corner says whether they are here (online, away, offline: {@link ChatPresenceService}),
 * unless `presence` is off (a stack of faces, where one dot per face would be noise).
 */
@Component({
	selector: 'ngx-chat-person-avatar',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (imageUrl(); as url) {
			<img class="avatar" [class]="size()" [class.round]="round()" [src]="url" [alt]="name()" loading="lazy" (error)="failedUrl.set(url)" />
		} @else {
			<span class="avatar initials" [class]="size()" [class.round]="round()" [style.background]="tint()" role="img" [attr.aria-label]="name()">{{ initials() }}</span>
		}
		@if (status(); as status) {
			<span
				class="presence"
				data-test="presence-dot"
				[class]="status + ' ' + size()"
				[attr.title]="'CHAT.PRESENCE.' + status.toUpperCase() | translate"
				[attr.aria-label]="'CHAT.PRESENCE.' + status.toUpperCase() | translate"
				role="img"
			></span>
		}
	`,
	styles: [
		`
			:host {
				position: relative;
				display: inline-flex;
				flex: 0 0 auto;
			}
			.presence {
				position: absolute;
				right: -0.125rem;
				bottom: -0.125rem;
				width: 0.6875rem;
				height: 0.6875rem;
				border-radius: 50%;
				box-sizing: border-box;
				border: 2px solid var(--chat-raised, var(--gauzy-card-1, var(--card-background-color)));
				background: var(--text-hint-color);
			}
			.presence.online {
				background: var(--color-success-default);
			}
			.presence.away {
				background: var(--color-warning-default);
			}
			.presence.tiny {
				width: 0.5rem;
				height: 0.5rem;
				border-width: 1.5px;
				right: -0.1875rem;
				bottom: -0.1875rem;
			}
			.presence.small {
				width: 0.5625rem;
				height: 0.5625rem;
				border-width: 1.5px;
			}
			.presence.medium {
				width: 0.625rem;
				height: 0.625rem;
			}
			.presence.large {
				width: 1.125rem;
				height: 1.125rem;
				border-width: 3px;
				right: 0;
				bottom: 0;
			}
			.avatar {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 2.25rem;
				height: 2.25rem;
				border-radius: 0.5rem;
				object-fit: cover;
				flex: 0 0 auto;
				font-size: 0.8125rem;
				font-weight: 700;
				letter-spacing: 0.02em;
				color: #fff;
				overflow: hidden;
				user-select: none;
			}
			.avatar.round {
				border-radius: 50%;
			}
			.avatar.tiny {
				width: 1.25rem;
				height: 1.25rem;
				border-radius: 0.25rem;
				font-size: 0.5625rem;
			}
			.avatar.small {
				width: 1.5rem;
				height: 1.5rem;
				border-radius: 0.375rem;
				font-size: 0.625rem;
			}
			.avatar.medium {
				width: 1.875rem;
				height: 1.875rem;
				border-radius: calc(var(--border-radius) * 0.875);
				font-size: 0.6875rem;
			}
			.avatar.large {
				width: 4.5rem;
				height: 4.5rem;
				border-radius: 0.875rem;
				font-size: 1.5rem;
			}
			.avatar.round.tiny,
			.avatar.round.small,
			.avatar.round.medium,
			.avatar.round.large {
				border-radius: 50%;
			}
		`
	]
})
export class PersonAvatarComponent {
	readonly person = input<ChatPerson | null | undefined>(null);
	readonly fallbackName = input<string>('');
	readonly size = input<PersonAvatarSize>('normal');
	readonly round = input(false);
	/** Whether to show the presence dot. */
	readonly presence = input(true);

	private readonly presenceService = inject(ChatPresenceService);

	/** A picture that failed to load: the initials show in its place (a broken link must not show a broken image). */
	protected readonly failedUrl = signal<string | null>(null);
	/** Their own picture (not the generic silhouette), unless it failed to load. */
	protected readonly imageUrl = computed(() => {
		const url = ownPicture(this.person()?.imageUrl);
		return url && url !== this.failedUrl() ? url : null;
	});
	readonly name = computed(() => this.person()?.name || this.fallbackName() || '');
	readonly initials = computed(() => initialsOf(this.name()));
	/** A hue picked from the name, dark enough for white initials in the light and the dark themes. */
	readonly tint = computed(() => `hsl(${nameHue(this.name())} 48% 42%)`);
	/** The dot to show: only for a person (an employee), and only where it is asked for. */
	readonly status = computed(() => {
		const employeeId = this.person()?.employeeId;
		return this.presence() && employeeId ? this.presenceService.presenceOf(employeeId) : null;
	});

	constructor() {
		// While a person is on screen, their presence is followed.
		this.presenceService.watch().pipe(takeUntilDestroyed()).subscribe();
	}
}
