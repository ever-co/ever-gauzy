import { ChangeDetectionStrategy, Component, computed, EventEmitter, signal } from '@angular/core';
import { NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';

/** Row data expected by AssignActionCellComponent */
export interface AssignActionRow {
	selected?: boolean;
	[key: string]: unknown;
}

@Component({
	selector: 'lib-assign-action-cell',
	template: `
		<button
			nbButton
			ghost
			size="small"
			[status]="isSelected() ? 'danger' : 'primary'"
			[nbTooltip]="isSelected() ? 'Remove from selection' : 'Add to selection'"
			[attr.aria-label]="isSelected() ? 'Remove from selection' : 'Add to selection'"
			(click)="onClick($event)"
		>
			<nb-icon [icon]="isSelected() ? 'minus-circle-outline' : 'plus-circle-outline'"></nb-icon>
		</button>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbButtonModule, NbIconModule, NbTooltipModule]
})
export class AssignActionCellComponent {
	private readonly _rowData = signal<AssignActionRow | undefined>(undefined);
	public toggle = new EventEmitter<AssignActionRow>();

	set rowData(value: AssignActionRow) {
		this._rowData.set(value);
	}

	readonly isSelected = computed(() => !!this._rowData()?.selected);

	onClick(event: Event): void {
		event.stopPropagation();
		this.toggle.emit(this._rowData());
	}
}
