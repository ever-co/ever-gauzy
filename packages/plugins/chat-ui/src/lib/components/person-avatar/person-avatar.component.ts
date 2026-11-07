import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ChatPerson, initialsOf } from '../../chat-ui.helpers';

/** A person's picture, or their initials on a tinted disc when they have none. */
@Component({
	selector: 'ngx-chat-person-avatar',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (person()?.imageUrl) {
			<img class="avatar" [class.small]="size() === 'small'" [src]="person()!.imageUrl" [alt]="name()" />
		} @else {
			<span class="avatar initials" [class.small]="size() === 'small'" [attr.aria-label]="name()">{{ initials() }}</span>
		}
	`,
	styles: [
		`
			.avatar {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 2rem;
				height: 2rem;
				border-radius: 50%;
				object-fit: cover;
				flex: 0 0 auto;
				font-size: 0.75rem;
				font-weight: 600;
				background: rgba(127, 127, 127, 0.18);
				color: inherit;
				overflow: hidden;
			}
			.avatar.small {
				width: 1.5rem;
				height: 1.5rem;
				font-size: 0.625rem;
			}
		`
	]
})
export class PersonAvatarComponent {
	readonly person = input<ChatPerson | null | undefined>(null);
	readonly fallbackName = input<string>('');
	readonly size = input<'small' | 'normal'>('normal');

	readonly name = computed(() => this.person()?.name || this.fallbackName() || '');
	readonly initials = computed(() => initialsOf(this.name()));
}
