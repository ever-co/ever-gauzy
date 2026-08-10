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
