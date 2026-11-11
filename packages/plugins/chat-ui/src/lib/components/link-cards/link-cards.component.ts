// cspell:ignore referrerpolicy -- the HTML attribute
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NbIconModule } from '@nebular/theme';
import { switchMap } from 'rxjs/operators';
import { ChatLinkCard, linkCardsOf } from '../../chat-links';
import { ChatLinkPreview, imageAspectRatio } from '../../chat-link-previews';
import { ChatLinkPreviewService } from '../../services/chat-link-previews.service';

/**
 * One web link of a message. With the platform's preview of the page (fetched and cached server side): the site's
 * icon and name, the title, the description (two lines at most) and the picture, laid out at its own aspect ratio so
 * nothing moves when it loads. Without one (previews off, not ready, nothing to show): the site and the path. The
 * texts are shown as text; the picture and the icon load lazily and send no referrer.
 */
@Component({
	selector: 'ngx-chat-link-card',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbIconModule],
	template: `
		@let card = link();
		@if (preview(); as shown) {
			<a class="card rich" data-test="link-card" data-preview="ready" [href]="card.url" target="_blank" rel="noopener noreferrer nofollow" [title]="card.url">
				<span class="body">
					<span class="site">
						@if (shown.icon) {
							<img class="icon" [src]="shown.icon" alt="" width="16" height="16" loading="lazy" decoding="async" referrerpolicy="no-referrer" />
						} @else {
							<nb-icon icon="globe-2-outline"></nb-icon>
						}
						<span class="site-name">{{ shown.siteName || card.host }}</span>
					</span>
					@if (shown.title) {
						<span class="title" data-test="link-preview-title">{{ shown.title }}</span>
					}
					@if (shown.description) {
						<span class="description" data-test="link-preview-description">{{ shown.description }}</span>
					}
				</span>
				@if (shown.image) {
					<img
						class="image"
						data-test="link-preview-image"
						[src]="shown.image"
						[alt]="shown.imageAlt || ''"
						[attr.width]="shown.imageWidth || null"
						[attr.height]="shown.imageHeight || null"
						[style.aspect-ratio]="ratio(shown)"
						loading="lazy"
						decoding="async"
						referrerpolicy="no-referrer"
					/>
				}
			</a>
		} @else {
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
				display: block;
				max-width: min(28rem, 100%);
				margin-top: 0.25rem;
			}
			.card {
				display: inline-flex;
				align-items: center;
				gap: 0.5rem;
				max-width: 100%;
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
			.card.rich {
				display: flex;
				flex-direction: column;
				align-items: stretch;
				gap: 0.5rem;
				padding: 0.5rem 0.625rem;
			}
			.text,
			.body {
				display: flex;
				flex-direction: column;
				min-width: 0;
			}
			.body {
				gap: 0.125rem;
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
			.site {
				display: flex;
				align-items: center;
				gap: 0.375rem;
				min-width: 0;
				font-size: 0.75rem;
				color: var(--text-hint-color);
			}
			.icon {
				flex: 0 0 auto;
				width: 1rem;
				height: 1rem;
				border-radius: calc(var(--border-radius) / 2);
				object-fit: contain;
			}
			.site-name {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.title {
				font-weight: 600;
				color: var(--color-primary-default);
				overflow-wrap: anywhere;
			}
			.description {
				display: -webkit-box;
				-webkit-box-orient: vertical;
				-webkit-line-clamp: 2;
				line-clamp: 2;
				overflow: hidden;
				color: var(--text-basic-color);
				overflow-wrap: anywhere;
			}
			.image {
				display: block;
				width: 100%;
				height: auto;
				max-height: 16rem;
				object-fit: cover;
				border-radius: var(--border-radius);
				background: var(--background-basic-color-2);
			}
		`
	]
})
export class LinkCardComponent {
	private readonly previews = inject(ChatLinkPreviewService);

	readonly link = input.required<ChatLinkCard>();

	/** The platform's preview of the link once it is ready, or null (the link-only card). */
	protected readonly preview = toSignal(toObservable(computed(() => this.link().url)).pipe(switchMap((url) => this.previews.preview(url))), {
		initialValue: null
	});

	protected ratio(preview: ChatLinkPreview): string | null {
		return imageAspectRatio(preview);
	}
}

/** The cards under a message: one per web link it holds, a few at most (see `linkCardsOf`). */
@Component({
	selector: 'ngx-chat-link-cards',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [LinkCardComponent],
	template: `
		@for (card of cards(); track card.url) {
			<ngx-chat-link-card [link]="card"></ngx-chat-link-card>
		}
	`,
	styles: [
		`
			:host {
				display: flex;
				flex-direction: column;
				align-items: flex-start;
			}
		`
	]
})
export class LinkCardsComponent {
	/** The message body (Markdown with mention tokens). */
	readonly body = input<string>('');

	protected readonly cards = computed(() => linkCardsOf(this.body() ?? ''));
}
