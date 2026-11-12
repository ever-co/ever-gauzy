import { afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { fileSizeLabel, PreviewableFile, previewKindOf } from '../../chat-attachments';

/**
 * A file of a message (or one waiting in the composer), shown in a popup over the page: a picture, a video, a sound or a PDF as itself, any other
 * file as its name with a way to open it. A native modal dialog: it sits above everything, holds the focus, and
 * closes with Escape, its close button, or a press outside the file.
 */
@Component({
	selector: 'ngx-chat-file-preview',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbIconModule, TranslatePipe],
	template: `
		@let shown = file();
		<dialog #dialog class="preview" data-test="file-preview" [attr.aria-label]="shown.name" (close)="closed.emit()" (click)="onBackdrop($event)">
			<header class="bar">
				<span class="title">
					<span class="name" [attr.title]="shown.name">{{ shown.name }}</span>
					@if (size()) {
						<span class="size">{{ size() }}</span>
					}
				</span>
				@if (shown.fileUrl) {
					<a class="bar-button" data-test="file-preview-open" [href]="shown.fileUrl" target="_blank" rel="noopener noreferrer">
						<nb-icon icon="external-link-outline" aria-hidden="true"></nb-icon>
						{{ 'CHAT.FILES.OPEN_IN_TAB' | translate }}
					</a>
				}
				<button type="button" class="bar-button icon" data-test="file-preview-close" [attr.aria-label]="'CHAT.FILES.CLOSE_PREVIEW' | translate" (click)="close()">
					<nb-icon icon="close-outline"></nb-icon>
				</button>
			</header>
			<div class="stage">
				@switch (kind()) {
					@case ('image') {
						<img class="media" [src]="shown.fileUrl || shown.thumbUrl" [alt]="shown.name" />
					}
					@case ('video') {
						<video class="media" controls [src]="shown.fileUrl"></video>
					}
					@case ('audio') {
						<audio class="sound" controls [src]="shown.fileUrl"></audio>
					}
					@case ('pdf') {
						<iframe class="page" [src]="frameUrl()" [attr.title]="shown.name"></iframe>
					}
					@default {
						<div class="none">
							<nb-icon icon="file-text-outline" aria-hidden="true"></nb-icon>
							<p>{{ 'CHAT.FILES.NO_PREVIEW' | translate }}</p>
						</div>
					}
				}
			</div>
		</dialog>
	`,
	styles: [
		`
			.preview {
				flex-direction: column;
				width: min(64rem, calc(100vw - 2rem));
				max-width: none;
				height: min(48rem, calc(100vh - 2rem));
				max-height: none;
				padding: 0;
				overflow: hidden;
				border: 1px solid var(--chat-border, var(--border-basic-color-3, rgba(127, 127, 127, 0.3)));
				border-radius: 0.75rem;
				background: var(--chat-raised, var(--background-basic-color-1, Canvas));
				color: var(--chat-text, var(--text-basic-color, CanvasText));
			}
			.preview[open] {
				display: flex;
			}
			.preview::backdrop {
				background: rgba(0, 0, 0, 0.6);
			}
			.bar {
				display: flex;
				flex: 0 0 auto;
				align-items: center;
				gap: 0.5rem;
				padding: 0.5rem 0.5rem 0.5rem 1rem;
				border-bottom: 1px solid var(--chat-border, var(--border-basic-color-3, rgba(127, 127, 127, 0.3)));
			}
			.title {
				display: flex;
				flex: 1 1 auto;
				align-items: baseline;
				gap: 0.5rem;
				min-width: 0;
			}
			.name {
				overflow: hidden;
				font-size: 0.875rem;
				font-weight: 600;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.size {
				flex: 0 0 auto;
				color: var(--chat-muted, var(--text-hint-color, inherit));
				font-size: 0.75rem;
			}
			.bar-button {
				display: inline-flex;
				flex: 0 0 auto;
				align-items: center;
				gap: 0.375rem;
				height: 2rem;
				padding: 0 0.625rem;
				border: 0;
				border-radius: 0.375rem;
				background: transparent;
				color: inherit;
				font: inherit;
				font-size: 0.8125rem;
				text-decoration: none;
				cursor: pointer;
			}
			.bar-button.icon {
				justify-content: center;
				width: 2rem;
				padding: 0;
			}
			.bar-button:hover,
			.bar-button:focus-visible {
				background: var(--chat-hover, var(--background-basic-color-3, rgba(127, 127, 127, 0.15)));
				color: inherit;
				text-decoration: none;
			}
			.bar-button nb-icon {
				font-size: 1.125rem;
			}
			.stage {
				display: flex;
				flex: 1 1 auto;
				align-items: center;
				justify-content: center;
				min-height: 0;
				padding: 1rem;
				overflow: auto;
				background: var(--chat-bg, var(--background-basic-color-2, transparent));
			}
			.media {
				max-width: 100%;
				max-height: 100%;
				object-fit: contain;
				border-radius: 0.25rem;
			}
			.sound {
				width: min(32rem, 100%);
			}
			.page {
				width: 100%;
				height: 100%;
				border: 0;
				border-radius: 0.25rem;
				background: Canvas;
			}
			.none {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 0.5rem;
				color: var(--chat-muted, var(--text-hint-color, inherit));
				font-size: 0.875rem;
			}
			.none nb-icon {
				font-size: 3rem;
			}
			.none p {
				margin: 0;
			}
		`
	]
})
export class FilePreviewComponent {
	private readonly sanitizer = inject(DomSanitizer);

	readonly file = input.required<PreviewableFile>();
	/** The popup closed (Escape, its button, a press outside): the owner lets go of the file. */
	readonly closed = output<void>();

	private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

	protected readonly kind = computed(() => previewKindOf(this.file()));
	protected readonly size = computed(() => fileSizeLabel(this.file().fileSize));
	/** The PDF's address for the frame: only a stored file's own http(s) address is ever framed. */
	protected readonly frameUrl = computed<SafeResourceUrl | null>(() => {
		const url = this.file().fileUrl;
		return url && this.kind() === 'pdf' ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
	});

	constructor() {
		afterNextRender(() => {
			const dialog = this.dialog()?.nativeElement;
			// Where the browser has no modal dialogs, the element is shown in place.
			if (dialog && !dialog.open) {
				if (typeof dialog.showModal === 'function') dialog.showModal();
				else dialog.setAttribute('open', '');
			}
		});
	}

	protected close(): void {
		const dialog = this.dialog()?.nativeElement;
		if (dialog && typeof dialog.close === 'function' && dialog.open) dialog.close();
		else this.closed.emit();
	}

	/** A press on the dimmed page around the popup (the dialog element itself, not what it holds) closes it. */
	protected onBackdrop(event: MouseEvent): void {
		if (event.target === this.dialog()?.nativeElement) this.close();
	}
}
