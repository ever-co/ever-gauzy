import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
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
			@for (chip of chips; track chip) {
				<button
					type="button"
					class="docs-preset"
					[class.active]="isActive(chip)"
					(click)="toggle(chip)"
					[attr.aria-pressed]="isActive(chip)"
				>
					<span class="docs-preset-label">{{ chip.labelKey | translate }}</span>
					@if (counts) {
						<span class="docs-preset-count">({{ counts[chip.countKey] }})</span>
					}
				</button>
			}
		</div>
	`,
	styles: [
		`
			:host {
				display: block;
				min-width: 0;
			}
			/* One segmented control: a bordered group, the active preset a quiet fill. */
			.docs-presets {
				display: inline-flex;
				flex-wrap: wrap;
				gap: 0.125rem;
				max-width: 100%;
				padding: 0.125rem;
				border: 1px solid var(--docs-hairline, rgba(126, 126, 143, 0.18));
				border-radius: var(--docs-radius, 0.375rem);
			}
			.docs-preset {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				gap: 0.25rem;
				height: 1.625rem;
				max-width: 100%;
				padding: 0 0.625rem;
				border: 0;
				border-radius: 0.25rem;
				background: transparent;
				color: var(--docs-text-muted, var(--text-hint-color));
				font: inherit;
				font-size: 0.75rem;
				font-weight: 500;
				line-height: 1;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
				cursor: pointer;
				transition: background-color 0.12s ease, color 0.12s ease;
			}
			.docs-preset:hover {
				background: var(--docs-hover, rgba(126, 126, 143, 0.12));
				color: var(--docs-text, var(--text-basic-color));
			}
			.docs-preset.active {
				background: var(--docs-active, rgba(126, 126, 143, 0.2));
				color: var(--docs-text, var(--text-basic-color));
			}
			.docs-preset:focus-visible {
				outline: 2px solid var(--color-primary-default);
				outline-offset: -2px;
			}
			@media (prefers-reduced-motion: reduce) {
				.docs-preset {
					transition: none;
				}
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
	changeDetection: ChangeDetectionStrategy.Eager,
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
