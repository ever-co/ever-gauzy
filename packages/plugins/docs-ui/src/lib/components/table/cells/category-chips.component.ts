import { Component, Input } from '@angular/core';
import { IDocument, IDocumentCategory } from '@gauzy/contracts';

/** Category chips: up to 3 colored chips + "+N" overflow. */
@Component({
	selector: 'gz-docs-category-chips',
	template: `
		<span class="docs-chips">
			<span
				class="docs-chip"
				*ngFor="let category of visible; trackBy: trackById"
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

	/** Cache so `visible` keeps a stable array reference across change-detection cycles. */
	private visibleCache: { source: IDocumentCategory[] | undefined; max: number; result: IDocumentCategory[] } = {
		source: undefined,
		max: -1,
		result: []
	};

	get categories(): IDocumentCategory[] {
		return this.value ?? this.rowData?.categories ?? [];
	}

	/**
	 * Rendered per table row on every browse-list change detection. `slice()` mints a new array
	 * identity each call; memoizing it (keyed on the source array reference + `max`) keeps the
	 * `*ngFor` reference stable, and `trackById` keeps the chip DOM stable when the content is
	 * unchanged — the same reference-stability discipline as `FacetMultiselectComponent`.
	 */
	get visible(): IDocumentCategory[] {
		const source = this.categories;
		if (this.visibleCache.source !== source || this.visibleCache.max !== this.max) {
			this.visibleCache = { source, max: this.max, result: source.slice(0, this.max) };
		}
		return this.visibleCache.result;
	}

	get overflow(): number {
		return Math.max(0, this.categories.length - this.max);
	}

	trackById(_index: number, category: IDocumentCategory): string {
		return category.id;
	}
}
