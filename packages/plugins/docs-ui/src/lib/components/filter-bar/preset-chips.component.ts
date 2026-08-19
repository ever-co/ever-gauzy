import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DocsPresetCounts } from '../../+state/documents.store';
import { DocsPresetId } from '../../models/docs-filter.model';

interface IPresetChip {
	id: DocsPresetId | null;
	labelKey: string;
	countKey: keyof DocsPresetCounts;
}

/**
 * Preset chips with live facet counts: All / Needs review / Not in AI
 * knowledge / Archived. Toggling the active preset returns to All.
 */
@Component({
	selector: 'gz-docs-preset-chips',
	template: `
		<div class="docs-presets" role="group">
			<button
				*ngFor="let chip of chips"
				nbButton
				size="tiny"
				[status]="isActive(chip) ? 'primary' : 'basic'"
				[appearance]="isActive(chip) ? 'filled' : 'outline'"
				(click)="toggle(chip)"
				[attr.aria-pressed]="isActive(chip)"
			>
				<span class="docs-preset-label">{{ chip.labelKey | translate }}</span>
				<span class="docs-preset-count" *ngIf="counts">({{ counts[chip.countKey] }})</span>
			</button>
		</div>
	`,
	styles: [
		`
			:host {
				display: block;
				min-width: 0;
			}
			.docs-presets {
				display: flex;
				gap: 0.375rem;
				flex-wrap: wrap;
			}
			/* One geometry for all four chips: a Nebular tiny button sizes itself
			   from its own label, so "All (14)" and "Not in AI knowledge (9)"
			   used to sit on two different heights and baselines. */
			.docs-presets button[nbButton] {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				gap: 0.25rem;
				/* The band's own control height when rendered inside the filter
				   bar (its first row), the compact step anywhere else — the chips
				   share a line with the search field and must match its box. */
				height: var(--docs-filter-control-height, var(--docs-control-height-sm, 1.75rem));
				min-height: var(--docs-filter-control-height, var(--docs-control-height-sm, 1.75rem));
				padding-inline: 0.5625rem;
				border-radius: var(--docs-radius, 0.375rem);
				/* The band's meta step: the chips share their row with the search
				   field, so they must not be the heaviest text on that line. */
				font-size: var(--docs-meta-size, 0.75rem);
				font-weight: 500;
				line-height: 1;
				white-space: nowrap;
				max-width: 100%;
				overflow: hidden;
				text-overflow: ellipsis;
			}
			.docs-preset-label {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.docs-preset-count {
				font-variant-numeric: tabular-nums;
				opacity: 0.7;
			}
		`
	],
	standalone: false
})
export class PresetChipsComponent {
	@Input() counts: DocsPresetCounts | null = null;
	@Input() active: DocsPresetId | undefined;
	@Output() presetToggled = new EventEmitter<DocsPresetId | undefined>();

	public readonly chips: IPresetChip[] = [
		{ id: null, labelKey: 'DOCS.FILTERS.PRESET_ALL', countKey: 'all' },
		{ id: 'needs-review', labelKey: 'DOCS.FILTERS.PRESET_NEEDS_REVIEW', countKey: 'needsReview' },
		{ id: 'not-in-knowledge', labelKey: 'DOCS.FILTERS.PRESET_NOT_IN_KNOWLEDGE', countKey: 'notInKnowledge' },
		{ id: 'archived', labelKey: 'DOCS.FILTERS.PRESET_ARCHIVED', countKey: 'archived' }
	];

	isActive(chip: IPresetChip): boolean {
		return chip.id === null ? !this.active : this.active === chip.id;
	}

	toggle(chip: IPresetChip): void {
		if (chip.id === null || this.isActive(chip)) {
			this.presetToggled.emit(undefined);
		} else {
			this.presetToggled.emit(chip.id);
		}
	}
}
