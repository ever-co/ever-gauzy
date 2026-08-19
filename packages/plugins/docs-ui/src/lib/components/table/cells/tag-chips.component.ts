import { Component, Input } from '@angular/core';
import { IDocument, ITag } from '@gauzy/contracts';

/** Tag chips: core tag colors, up to 3 + "+N" overflow. */
@Component({
	selector: 'gz-docs-tag-chips',
	template: `
		<span class="docs-chips">
			<span
				class="docs-chip"
				*ngFor="let tag of visible; trackBy: trackById"
				[style.background-color]="tag.color || null"
				[nbTooltip]="tag.name"
				nbTooltipStatus="basic"
			>
				{{ tag.name }}
			</span>
			<span class="docs-chip overflow" *ngIf="overflow > 0">+{{ overflow }}</span>
		</span>
	`,
	styles: [
		`
			.docs-chips {
				display: inline-flex;
				align-items: center;
				gap: var(--gauzy-table-chip-gap, 0.1875rem);
				flex-wrap: wrap;
				max-width: 100%;
				min-width: 0;
			}
			/* One chip geometry for categories and tags alike: the table's chip
			   density tokens, and the theme's control radius rather than a 1rem
			   stadium pill — a pill on a 17px box reads as a different design
			   language from the buttons and selects around it. */
			.docs-chip {
				display: inline-flex;
				align-items: center;
				max-width: 9rem;
				height: var(--gauzy-table-badge-height, 1.25rem);
				padding: 0 var(--gauzy-table-chip-padding-x, 0.375rem);
				border-radius: var(--docs-radius, 0.375rem);
				font-size: var(--gauzy-table-chip-font-size, 0.6875rem);
				line-height: var(--gauzy-table-chip-line-height, 0.875rem);
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}
			.docs-chip {
				color: var(--text-control-color);
				background: var(--background-basic-color-3);
			}
			.docs-chip.overflow {
				background: transparent;
				color: var(--docs-text-muted, var(--text-hint-color));
				box-shadow: inset 0 0 0 1px var(--docs-hairline, rgba(126, 126, 143, 0.18));
			}
		`
	],
	standalone: false
})
export class TagChipsComponent {
	@Input() rowData: IDocument;
	@Input() value: ITag[];
	@Input() max = 3;

	/** Cache so `visible` keeps a stable array reference across change-detection cycles. */
	private visibleCache: { source: ITag[] | undefined; max: number; result: ITag[] } = {
		source: undefined,
		max: -1,
		result: []
	};

	get tags(): ITag[] {
		return this.value ?? this.rowData?.tags ?? [];
	}

	/**
	 * Rendered per table row on every browse-list change detection. `slice()` mints a new array
	 * identity each call; memoizing it (keyed on the source array reference + `max`) keeps the
	 * `*ngFor` reference stable, and `trackById` keeps the chip DOM stable when the content is
	 * unchanged — the same reference-stability discipline as `FacetMultiselectComponent`.
	 */
	get visible(): ITag[] {
		const source = this.tags;
		if (this.visibleCache.source !== source || this.visibleCache.max !== this.max) {
			this.visibleCache = { source, max: this.max, result: source.slice(0, this.max) };
		}
		return this.visibleCache.result;
	}

	get overflow(): number {
		return Math.max(0, this.tags.length - this.max);
	}

	trackById(_index: number, tag: ITag): string {
		return tag.id;
	}
}
