import { Component, Input } from '@angular/core';
import { DocumentSourceEnum, IDocument } from '@gauzy/contracts';

const SOURCE_ICONS: Record<DocumentSourceEnum, string> = {
	[DocumentSourceEnum.UPLOAD]: 'upload-outline',
	[DocumentSourceEnum.EDITOR]: 'edit-2-outline',
	[DocumentSourceEnum.CHAT]: 'message-circle-outline',
	[DocumentSourceEnum.EMAIL]: 'email-outline',
	[DocumentSourceEnum.INTEGRATION]: 'link-2-outline',
	[DocumentSourceEnum.SYSTEM]: 'settings-2-outline',
	[DocumentSourceEnum.IMPORT]: 'download-outline'
};

/** Source badge: Eva icon + label per DocumentSourceEnum. */
@Component({
	selector: 'gz-docs-source-badge',
	template: `
		<span class="docs-source" *ngIf="source">
			<nb-icon [icon]="icon" size="tiny"></nb-icon>
			<span class="docs-source__label">{{ 'DOCS.SOURCE.' + source | translate }}</span>
		</span>
	`,
	styles: [
		`
			.docs-source {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				max-width: 100%;
				height: var(--gauzy-table-badge-height, 1.25rem);
				font-size: var(--docs-meta-size, 0.75rem);
				line-height: 1;
				color: var(--docs-text-muted, var(--text-hint-color));
				white-space: nowrap;
				overflow: hidden;
			}
			/* text-overflow is ignored on the flex container itself - the label needs
			   its own block box for the ellipsis to appear. */
			.docs-source__label {
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.docs-source nb-icon {
				flex: 0 0 auto;
				font-size: 0.875rem;
			}
		`
	],
	standalone: false
})
export class SourceBadgeComponent {
	@Input() rowData: IDocument;
	@Input() value: DocumentSourceEnum;

	get source(): DocumentSourceEnum | undefined {
		return this.value ?? this.rowData?.source;
	}

	get icon(): string {
		return this.source ? SOURCE_ICONS[this.source] ?? 'file-outline' : 'file-outline';
	}
}
