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
				{{ chip.labelKey | translate }}
				<span class="docs-preset-count" *ngIf="counts">({{ counts[chip.countKey] }})</span>
			</button>
		</div>
	`,
	styles: [
		`
			.docs-presets {
				display: inline-flex;
				gap: 0.375rem;
				flex-wrap: wrap;
			}
			.docs-preset-count {
				margin-left: 0.25rem;
				opacity: 0.75;
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
