import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NbIconModule } from '@nebular/theme';
import { linkCardsOf } from '../../chat-links';

/**
 * A card under a message for each web link it holds (a few at most): the site and the path, opening in a new tab.
 * Nothing is fetched from the linked site, by the reader's browser or otherwise: the card is made from the link.
 */
@Component({
	selector: 'ngx-chat-link-cards',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbIconModule],
	template: `
		@for (card of cards(); track card.url) {
			<a class="card" data-test="link-card" [href]="card.url" target="_blank" rel="noopener noreferrer nofollow" [title]="card.url">
				<nb-icon icon="globe-2-outline"></nb-icon>
				<span class="text">
					<span class="host">{{ card.host }}</span>
					@if (card.path) {
						<span class="path">{{ card.path }}</span>
					}
				</span>
				<nb-icon class="out" icon="external-link-outline"></nb-icon>
			</a>
		}
	`,
	styles: [
		`
			:host {
				display: flex;
				flex-direction: column;
				align-items: flex-start;
			}
			.card {
				display: inline-flex;
				margin-top: 0.25rem;
				align-items: center;
				gap: 0.5rem;
				max-width: min(28rem, 100%);
				padding: 0.375rem 0.625rem;
				border: 1px solid var(--border-basic-color-3);
				border-radius: var(--border-radius);
				background: var(--background-basic-color-1);
				color: inherit;
				text-decoration: none;
				font-size: 0.8125rem;
			}
			.card:hover,
			.card:focus-visible {
				background: var(--background-basic-color-2);
			}
			.text {
				display: flex;
				flex-direction: column;
				min-width: 0;
			}
			.host {
				font-weight: 600;
			}
			.path {
				font-size: 0.75rem;
				color: var(--text-hint-color);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.out {
				flex: 0 0 auto;
				color: var(--text-hint-color);
			}
		`
	]
})
export class LinkCardsComponent {
	/** The message body (Markdown with mention tokens). */
	readonly body = input<string>('');

	protected readonly cards = computed(() => linkCardsOf(this.body() ?? ''));
}
