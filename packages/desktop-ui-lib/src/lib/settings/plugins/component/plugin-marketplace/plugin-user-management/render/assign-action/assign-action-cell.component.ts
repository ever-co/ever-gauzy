import { ChangeDetectionStrategy, Component, EventEmitter } from '@angular/core';
import { NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';

@Component({
	selector: 'lib-assign-action-cell',
	template: `
		<button
			nbButton
			ghost
			size="small"
			[status]="isSelected ? 'danger' : 'primary'"
			[nbTooltip]="isSelected ? 'Remove from selection' : 'Add to selection'"
			(click)="onClick($event)"
		>
			<nb-icon [icon]="isSelected ? 'minus-circle-outline' : 'plus-circle-outline'"></nb-icon>
		</button>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbButtonModule, NbIconModule, NbTooltipModule]
})
export class AssignActionCellComponent {
	public rowData: any;
	public toggle = new EventEmitter<any>();

	get isSelected(): boolean {
		return !!this.rowData?.selected;
	}

	onClick(event: Event): void {
		event.stopPropagation();
		this.toggle.emit(this.rowData);
	}
}
