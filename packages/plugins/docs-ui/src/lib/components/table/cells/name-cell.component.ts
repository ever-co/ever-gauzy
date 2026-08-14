import { Component, Input } from '@angular/core';
import { DocumentKindEnum, DocumentVisibilityEnum, IDocument } from '@gauzy/contracts';
import { sanitizeMediaUrl } from '../../../editor/read-only/safe-url.util';

/**
 * Name cell: thumbnail or kind icon (Eva; per-mime variants for FILE), name with
 * summary/original-filename tooltip, and inline pills (archived, private,
 * locked, version).
 *
 * The leading slot is a FIXED-size box whatever it holds, so a row keeps its height and its
 * text alignment whether the document has a generated thumbnail or not — and gaining one on
 * a later poll never shifts the column.
 */
@Component({
	selector: 'gz-docs-name-cell',
	template: `
		<div class="docs-name-cell" [nbTooltip]="tooltip" nbTooltipStatus="basic">
			<span class="docs-name-lead">
				<img
					*ngIf="thumbnailUrl as thumbnail; else leadIcon"
					class="docs-name-thumb"
					[src]="thumbnail"
					alt=""
					loading="lazy"
					(error)="onThumbnailError()"
				/>
				<ng-template #leadIcon>
					<span class="docs-name-icon" *ngIf="rowData?.icon; else evaIcon">{{ rowData.icon }}</span>
					<ng-template #evaIcon>
						<nb-icon [icon]="icon" size="small" [style.color]="rowData?.color || null"></nb-icon>
					</ng-template>
				</ng-template>
			</span>
			<span class="docs-name-text">{{ rowData?.name }}</span>
			<nb-badge *ngIf="rowData?.isArchived" status="basic" [text]="'DOCS.FILTERS.PRESET_ARCHIVED' | translate"></nb-badge>
			<nb-icon
				*ngIf="rowData?.visibility === visibilityEnum.PRIVATE"
				icon="eye-off-outline"
				size="tiny"
				[nbTooltip]="'DOCS.VISIBILITY.PRIVATE' | translate"
			></nb-icon>
			<nb-icon *ngIf="rowData?.isLocked" icon="lock-outline" size="tiny"></nb-icon>
			<span class="docs-name-version" *ngIf="rowData?.version > 1">v{{ rowData.version }}</span>
		</div>
	`,
	styles: [
		`
			.docs-name-cell {
				display: inline-flex;
				align-items: center;
				gap: 0.375rem;
				max-width: 100%;
			}
			.docs-name-lead {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				flex: 0 0 auto;
				width: 1.5rem;
				height: 1.5rem;
			}
			.docs-name-thumb {
				width: 100%;
				height: 100%;
				object-fit: cover;
				border-radius: 0.1875rem;
				background: var(--background-basic-color-2);
			}
			.docs-name-text {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.docs-name-version {
				font-size: 0.6875rem;
				color: var(--text-hint-color);
			}
		`
	],
	standalone: false
})
export class NameCellComponent {
	@Input() rowData: IDocument & { isArchived?: boolean };
	@Input() value: string;

	public readonly visibilityEnum = DocumentVisibilityEnum;

	/** Set once the thumbnail failed to load (expired signed URL, deleted object). */
	private thumbnailFailed = false;

	/**
	 * The row's preview image, or `null` when the kind icon should stand in.
	 *
	 * `thumbUrl` is the virtual column the backend resolves from `storageProvider` +
	 * `thumbKey`, so it is absent on every document the thumbnail job has not processed
	 * (folders and pages included) — the icon is the normal case, not the error case.
	 *
	 * 🛑 Sanitized before it is bound: the value comes from the storage provider and lands in
	 * `<img [src]>`, where Angular's own check only refuses `javascript:`
	 * (`editor/read-only/safe-url.util.ts` carries the full reasoning).
	 */
	get thumbnailUrl(): string | null {
		if (!this.rowData?.thumbUrl || this.thumbnailFailed) return null;
		return sanitizeMediaUrl(this.rowData.thumbUrl);
	}

	/** Falls back to the kind icon instead of leaving a broken image in the column. */
	onThumbnailError(): void {
		this.thumbnailFailed = true;
	}

	get tooltip(): string {
		return this.rowData?.summary ?? this.rowData?.originalFilename ?? this.rowData?.name ?? '';
	}

	get icon(): string {
		switch (this.rowData?.kind) {
			case DocumentKindEnum.FOLDER:
				return 'folder-outline';
			case DocumentKindEnum.PAGE:
				return 'file-text-outline';
			default:
				return this.fileIcon(this.rowData?.mimeType);
		}
	}

	private fileIcon(mimeType?: string): string {
		if (!mimeType) return 'file-outline';
		if (mimeType === 'application/pdf') return 'file-text-outline';
		if (mimeType.startsWith('image/')) return 'image-outline';
		if (mimeType.includes('spreadsheet') || mimeType.includes('csv') || mimeType.includes('excel'))
			return 'grid-outline';
		if (mimeType.includes('word') || mimeType.includes('opendocument.text')) return 'file-text-outline';
		return 'file-outline';
	}
}
