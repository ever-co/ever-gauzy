import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { IChatFile } from '@gauzy/contracts';
import {
	fileSizeLabel,
	imageBox,
	isImageFile,
	isPlainClick,
	messageAttachments,
	objectUrlOf,
	PreviewableFile,
	releaseObjectUrl
} from '../../chat-attachments';
import { ChatUiService } from '../../services/chat-ui.service';
import { FilePreviewComponent } from '../file-preview/file-preview.component';

/**
 * The files of a message: pictures shown inline (their thumbnail when the platform made one), other files as
 * links with their size, and a count of the ones not read yet. A click shows the file in a popup over the page
 * (a click with a modifier key keeps the link's way: the stored file in a new tab).
 */
@Component({
	selector: 'ngx-chat-message-attachments',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbIconModule, TranslatePipe, FilePreviewComponent],
	template: `
		@if (shown().images.length) {
			<div class="images" data-test="attachment-images">
				@for (file of shown().images; track file.documentId) {
					<a class="image" [href]="file.fileUrl || file.thumbUrl" target="_blank" rel="noopener noreferrer" [attr.aria-label]="file.name" [title]="file.name" (click)="open(file, $event)">
						<img
							[src]="source(file)"
							[alt]="file.name"
							loading="lazy"
							[attr.width]="box(file)?.width ?? null"
							[attr.height]="box(file)?.height ?? null"
							[style.width.px]="box(file)?.width ?? null"
							[style.aspect-ratio]="ratio(file)"
							[class.sized]="!!box(file)"
							(load)="onImageLoad(file, $event)"
							(error)="onImageError(file)"
						/>
					</a>
				}
			</div>
		}
		@if (shown().files.length) {
			<div class="files" data-test="attachment-files">
				@for (file of shown().files; track file.documentId) {
					@if (file.fileUrl) {
						<a class="file" [href]="file.fileUrl" target="_blank" rel="noopener noreferrer" (click)="open(file, $event)">
							<nb-icon [icon]="isImage(file) ? 'image-outline' : 'file-text-outline'"></nb-icon>
							<span class="name">{{ file.name }}</span>
							@if (size(file)) {
								<span class="size">{{ size(file) }}</span>
							}
						</a>
					} @else {
						<span class="file">
							<nb-icon icon="file-text-outline"></nb-icon>
							<span class="name">{{ file.name }}</span>
						</span>
					}
				}
			</div>
		}
		@if (shown().unknown > 0) {
			<p class="unknown"><nb-icon icon="attach-outline"></nb-icon> {{ 'CHAT.MESSAGE.ATTACHMENTS' | translate: { count: shown().unknown } }}</p>
		}
		@if (preview(); as file) {
			<ngx-chat-file-preview [file]="file" (closed)="preview.set(null)"></ngx-chat-file-preview>
		}
	`,
	styles: [
		`
			:host {
				display: block;
			}
			/* Pictures sit under the message's text, large and with rounded corners, as chat apps show them. */
			.images {
				display: flex;
				flex-wrap: wrap;
				gap: 0.25rem;
				margin-top: 0.375rem;
			}
			.image {
				display: block;
				max-width: 100%;
				border-radius: 0.5rem;
				overflow: hidden;
				line-height: 0;
				cursor: zoom-in;
			}
			.image:focus-visible {
				outline: 2px solid var(--chat-accent, var(--color-primary-default, #3366ff));
				outline-offset: 2px;
			}
			/* Before its size is known a picture is held inside the box; once known, it takes exactly its fitted size. */
			.image img {
				display: block;
				max-width: min(550px, 100%);
				max-height: 350px;
				border-radius: 0.5rem;
				object-fit: contain;
			}
			.image img.sized {
				max-width: 100%;
				max-height: none;
				background: var(--chat-hover, var(--background-basic-color-3, rgba(127, 127, 127, 0.12)));
			}
			/* A picture of known size keeps its box while it loads, and its proportions in a narrow column. */
			.image img.sized {
				height: auto;
			}
			.files {
				display: flex;
				flex-wrap: wrap;
				gap: 0.375rem;
				margin-top: 0.25rem;
			}
			.file {
				display: inline-flex;
				align-items: center;
				gap: 0.375rem;
				max-width: 100%;
				padding: 0.25rem 0.5rem;
				border: 1px solid var(--border-basic-color-3);
				border-radius: var(--border-radius);
				background: var(--background-basic-color-1);
				font-size: 0.8125rem;
				color: inherit;
				text-decoration: none;
			}
			a.file:hover,
			a.file:focus-visible {
				background: var(--background-basic-color-2);
			}
			.name {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.size {
				font-size: 0.6875rem;
				color: var(--text-hint-color);
			}
			.unknown {
				margin: 0.25rem 0 0;
				font-size: 0.75rem;
				color: var(--text-hint-color);
			}
		`
	]
})
export class MessageAttachmentsComponent {
	private readonly api = inject(ChatUiService);
	private readonly destroyRef = inject(DestroyRef);

	/** The documents the message carries. */
	readonly documentIds = input<readonly string[] | null | undefined>([]);
	/** The conversation's files read so far, by document id. */
	readonly files = input<ReadonlyMap<string, IChatFile>>(new Map());

	/** The pictures whose stored file did not load (the thumbnail is shown instead), and those that did not load at all. */
	private readonly fullFailed = signal<ReadonlySet<string>>(new Set());
	private readonly imageFailed = signal<ReadonlySet<string>>(new Set());
	/** The pictures read through the API after their own address did not load: an address of their bytes, by document. */
	private readonly readUrls = signal<ReadonlyMap<string, string>>(new Map());
	/** The pictures asked for that way (each once). */
	private readonly asked = new Set<string>();

	constructor() {
		this.destroyRef.onDestroy(() => {
			for (const url of this.readUrls().values()) releaseObjectUrl(url);
		});
	}

	/** What the message shows: a picture that cannot be loaded goes with the other files, as its name. */
	protected readonly shown = computed(() => {
		const all = messageAttachments(this.documentIds(), this.files());
		const broken = this.imageFailed();
		if (!broken.size) return all;
		const lost = all.images.filter((file) => broken.has(String(file.documentId)));
		return { ...all, images: all.images.filter((file) => !broken.has(String(file.documentId))), files: [...lost, ...all.files] };
	});

	/**
	 * The picture's address: the stored picture itself (it is shown large, and the thumbnail is small), or its
	 * thumbnail when there is no stored address or it did not load.
	 */
	protected source(file: IChatFile): string | null {
		const id = String(file.documentId);
		const read = this.readUrls().get(id);
		if (read) return read;
		const full = this.fullFailed().has(id) ? null : file.fileUrl;
		return full || file.thumbUrl || null;
	}

	/**
	 * A picture that did not load: its thumbnail is tried after the stored picture, then its bytes read through the
	 * API, and only then is it shown as a file.
	 */
	protected onImageError(file: IChatFile): void {
		const id = String(file.documentId);
		const triedFull = !!file.fileUrl && !this.fullFailed().has(id);
		if (this.readUrls().has(id)) this.imageFailed.update((set) => new Set(set).add(id));
		else if (triedFull && file.thumbUrl && file.thumbUrl !== file.fileUrl) this.fullFailed.update((set) => new Set(set).add(id));
		else this.readThroughApi(file);
	}

	/**
	 * Neither address of the picture loads in the browser (a storage it cannot reach directly): its bytes are read
	 * through the API as the signed-in person, once; a picture that cannot be read that way either is shown as a file.
	 */
	private readThroughApi(file: IChatFile): void {
		const id = String(file.documentId);
		const fail = () => this.imageFailed.update((set) => new Set(set).add(id));
		if (this.asked.has(id)) {
			fail();
			return;
		}
		this.asked.add(id);
		this.api
			.fileBytes(file.documentId)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (blob) => {
					// The API states a kind only for what is safe to show: anything else is not drawn as a picture.
					const url = isImageFile(blob.type) ? objectUrlOf(blob) : null;
					if (url) this.readUrls.update((map) => new Map(map).set(id, url));
					else fail();
				},
				error: fail
			});
	}

	/** The file shown in the popup. */
	protected readonly preview = signal<PreviewableFile | null>(null);

	/** A plain click shows the file in the popup; with a modifier key the link opens as links do. */
	protected open(file: IChatFile, event: MouseEvent): void {
		if (!isPlainClick(event)) return;
		event.preventDefault();
		// A picture read through the API is shown from those bytes in the popup too.
		const read = this.readUrls().get(String(file.documentId));
		this.preview.set(read ? { ...file, fileUrl: read, thumbUrl: null } : file);
	}

	protected isImage(file: IChatFile): boolean {
		return isImageFile(file.mimeType);
	}

	protected size(file: IChatFile): string {
		return fileSizeLabel(file.fileSize);
	}

	/** The sizes read from the pictures themselves as they loaded (the platform recorded none for them). */
	private readonly loadedSizes = signal<ReadonlyMap<string, { width: number; height: number }>>(new Map());

	/**
	 * The size a picture is shown at: fitted from the size the platform recorded (the space it reserves before it
	 * loads), or from the picture's own once it loaded; null until one is known.
	 */
	protected box(file: IChatFile): { width: number; height: number } | null {
		return imageBox(file) ?? imageBox(this.loadedSizes().get(String(file.documentId)) ?? {});
	}

	/** The picture's proportions, so its container is exactly the picture in a narrow column too. */
	protected ratio(file: IChatFile): string | null {
		const box = this.box(file);
		return box ? `${box.width} / ${box.height}` : null;
	}

	/** A picture the platform recorded no size for tells its own as it loads. */
	protected onImageLoad(file: IChatFile, event: Event): void {
		if (imageBox(file)) return;
		const image = event.target as HTMLImageElement | null;
		const id = String(file.documentId);
		if (!image?.naturalWidth || !image.naturalHeight || this.loadedSizes().has(id)) return;
		this.loadedSizes.update((map) => new Map(map).set(id, { width: image.naturalWidth, height: image.naturalHeight }));
	}
}
