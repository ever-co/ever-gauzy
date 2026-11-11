import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { IChatFile } from '@gauzy/contracts';
import { fileSizeLabel, messageAttachments } from '../../chat-attachments';

/**
 * The files of a message: pictures shown inline (their thumbnail when the platform made one), other files as
 * links with their size, and a count of the ones not read yet. Each opens the stored file in a new tab.
 */
@Component({
	selector: 'ngx-chat-message-attachments',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbIconModule, TranslatePipe],
	template: `
		@if (shown().images.length) {
			<div class="images" data-test="attachment-images">
				@for (file of shown().images; track file.documentId) {
					<a class="image" [href]="file.fileUrl || file.thumbUrl" target="_blank" rel="noopener noreferrer" [attr.aria-label]="file.name" [title]="file.name">
						<img [src]="file.thumbUrl || file.fileUrl" [alt]="file.name" loading="lazy" />
					</a>
				}
			</div>
		}
		@if (shown().files.length) {
			<div class="files" data-test="attachment-files">
				@for (file of shown().files; track file.documentId) {
					@if (file.fileUrl) {
						<a class="file" [href]="file.fileUrl" target="_blank" rel="noopener noreferrer">
							<nb-icon icon="file-text-outline"></nb-icon>
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
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.images {
				display: flex;
				flex-wrap: wrap;
				gap: 0.375rem;
				margin-top: 0.25rem;
			}
			.image {
				display: block;
				border-radius: var(--border-radius);
				overflow: hidden;
				border: 1px solid var(--border-basic-color-3);
				line-height: 0;
			}
			.image img {
				max-width: min(20rem, 100%);
				max-height: 15rem;
				object-fit: contain;
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
	/** The documents the message carries. */
	readonly documentIds = input<readonly string[] | null | undefined>([]);
	/** The conversation's files read so far, by document id. */
	readonly files = input<ReadonlyMap<string, IChatFile>>(new Map());

	protected readonly shown = computed(() => messageAttachments(this.documentIds(), this.files()));

	protected size(file: IChatFile): string {
		return fileSizeLabel(file.fileSize);
	}
}
