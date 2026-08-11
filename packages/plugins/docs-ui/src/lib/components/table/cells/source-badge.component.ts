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
			{{ 'DOCS.SOURCE.' + source | translate }}
		</span>
	`,
	styles: [
		`
			.docs-source {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				font-size: 0.75rem;
				color: var(--text-hint-color);
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
