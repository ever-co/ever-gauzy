import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NbIconModule } from '@nebular/theme';
import { linkCardsOf } from '../../chat-links';
import { ChatLinkPreviewsService } from '../../services/chat-link-previews.service';

/**
 * A card under a message for each web link it holds (a few at most), opening in a new tab. The card shows the site
 * and the path, and once the platform has a preview of the page (it fetches it, `GET /chat/link-preview`), the page's
 * own site name, title and description as text, and its picture when the platform serves it (from its own fetch, as a
 * `blob:` URL). Nothing is loaded from the linked site by the reader's browser: not the page, not its picture, not its
 * icon.
 */
@Component({
	selector: 'ngx-chat-link-cards',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbIconModule],
	template: `
		@for (card of cards(); track card.url) {
			@let preview = card.preview();
			<a
				class="card"
				data-test="link-card"
				[class.rich]="!!preview"
				[href]="card.url"
				target="_blank"
				rel="noopener noreferrer nofollow"
				[title]="card.url"
			>
				<nb-icon icon="globe-2-outline"></nb-icon>
				<span class="text">
					<span class="host">{{ preview?.siteName || card.host }}</span>
					@if (preview?.title) {
						<span class="title" data-test="link-preview-title">{{ preview?.title }}</span>
					}
					@if (preview?.description) {
						<span class="description" data-test="link-preview-description">{{ preview?.description }}</span>
					}
					@if (!preview && card.path) {
						<span class="path">{{ card.path }}</span>
					}
				</span>
				@if (preview?.imageUrl) {
					<img class="thumb" data-test="link-preview-image" [src]="preview?.imageUrl" [alt]="preview?.imageAlt || ''" />
				}
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
			.card.rich {
				align-items: flex-start;
				border-left: 3px solid var(--color-primary-default);
				padding: 0.5rem 0.75rem;
			}
			.card:hover,
			.card:focus-visible {
				background: var(--background-basic-color-2);
			}
			.text {
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
				min-width: 0;
			}
			.host {
				font-weight: 600;
			}
			.card.rich .host {
				font-weight: 400;
				font-size: 0.75rem;
				color: var(--text-hint-color);
			}
			.title {
				font-weight: 600;
				overflow-wrap: anywhere;
				display: -webkit-box;
				-webkit-line-clamp: 2;
				-webkit-box-orient: vertical;
				overflow: hidden;
			}
			.description {
				font-size: 0.75rem;
				overflow-wrap: anywhere;
				display: -webkit-box;
				-webkit-line-clamp: 3;
				-webkit-box-orient: vertical;
				overflow: hidden;
			}
			.path {
				font-size: 0.75rem;
				color: var(--text-hint-color);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.thumb {
				flex: 0 0 auto;
				width: 4.5rem;
				height: 4.5rem;
				object-fit: cover;
				border-radius: var(--border-radius);
			}
			.out {
				flex: 0 0 auto;
				color: var(--text-hint-color);
			}
		`
	]
})
export class LinkCardsComponent {
	private readonly previews = inject(ChatLinkPreviewsService);

	/** The message body (Markdown with mention tokens). */
	readonly body = input<string>('');

	protected readonly cards = computed(() =>
		linkCardsOf(this.body() ?? '').map((card) => ({ ...card, preview: this.previews.preview(card.url) }))
	);
}
