import { Component, Input } from '@angular/core';
import { IDocument, IDocumentCategory } from '@gauzy/contracts';

/** Category chips: up to 3 colored chips + "+N" overflow. */
@Component({
	selector: 'gz-docs-category-chips',
	template: `
		<span class="docs-chips">
			<span
				class="docs-chip"
				*ngFor="let category of visible"
				[style.border-color]="category.color || null"
				[nbTooltip]="category.description || category.name"
				nbTooltipStatus="basic"
			>
				{{ category.name }}
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
				border: 1px solid var(--border-basic-color-4);
				border-radius: 1rem;
				padding: 0 0.5rem;
				white-space: nowrap;
			}
			.docs-chip.overflow {
				color: var(--text-hint-color);
			}
		`
	],
	standalone: false
})
export class CategoryChipsComponent {
	@Input() rowData: IDocument;
	@Input() value: IDocumentCategory[];
	@Input() max = 3;

	get categories(): IDocumentCategory[] {
		return this.value ?? this.rowData?.categories ?? [];
	}

	get visible(): IDocumentCategory[] {
		return this.categories.slice(0, this.max);
	}

	get overflow(): number {
		return Math.max(0, this.categories.length - this.max);
	}
}
