import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ChatPerson, initialsOf, nameHue, ownPicture } from '../../chat-ui.helpers';

/** The sizes an avatar comes in: a list row, a message, a conversation intro. */
export type PersonAvatarSize = 'tiny' | 'small' | 'medium' | 'normal' | 'large';

/**
 * A person's picture, or their initials on a disc tinted from their name (the same name always gets the same
 * colour) when they have none. Square with rounded corners by default, as chat apps draw people; `round` for a
 * circle.
 */
@Component({
	selector: 'ngx-chat-person-avatar',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (imageUrl(); as url) {
			<img class="avatar" [class]="size()" [class.round]="round()" [src]="url" [alt]="name()" loading="lazy" (error)="failedUrl.set(url)" />
		} @else {
			<span class="avatar initials" [class]="size()" [class.round]="round()" [style.background]="tint()" role="img" [attr.aria-label]="name()">{{ initials() }}</span>
		}
	`,
	styles: [
		`
			:host {
				display: inline-flex;
				flex: 0 0 auto;
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
				border-radius: 0.4375rem;
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
}
