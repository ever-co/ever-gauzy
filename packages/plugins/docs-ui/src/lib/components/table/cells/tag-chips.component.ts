import { Component, Input } from '@angular/core';
import { IDocument, ITag } from '@gauzy/contracts';

/** Tag chips: core tag colors, up to 3 + "+N" overflow. */
@Component({
	selector: 'gz-docs-tag-chips',
	template: `
		<span class="docs-chips">
			<span class="docs-chip" *ngFor="let tag of visible" [style.background-color]="tag.color || null">
				{{ tag.name }}
			</span>
			<span class="docs-chip overflow" *ngIf="overflow > 0">+{{ overflow }}</span>
		</span>
	`,
	styles: [
		`
			.docs-chips {
				display: inline-flex;
				gap: 0.25rem;
				flex-wrap: wrap;
			}
			.docs-chip {
				font-size: 0.6875rem;
				border-radius: 1rem;
				padding: 0 0.5rem;
				white-space: nowrap;
				color: var(--text-control-color);
				background: var(--background-basic-color-3);
			}
			.docs-chip.overflow {
				background: transparent;
				color: var(--text-hint-color);
			}
		`
	],
	standalone: false
})
export class TagChipsComponent {
	@Input() rowData: IDocument;
	@Input() value: ITag[];
	@Input() max = 3;

	get tags(): ITag[] {
		return this.value ?? this.rowData?.tags ?? [];
	}

	get visible(): ITag[] {
		return this.tags.slice(0, this.max);
	}

	get overflow(): number {
		return Math.max(0, this.tags.length - this.max);
	}
}
