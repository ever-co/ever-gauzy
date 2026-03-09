import { ChangeDetectionStrategy, Component, EventEmitter } from '@angular/core';
import { NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';

@Component({
	selector: 'lib-unassign-action-cell',
	template: `
		<button
			nbButton
			ghost
			size="small"
			status="danger"
			[disabled]="!isActive"
			nbTooltip="Unassign user from plugin"
			(click)="onClick($event)"
		>
			<nb-icon icon="person-remove-outline"></nb-icon>
		</button>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbButtonModule, NbIconModule, NbTooltipModule]
})
export class UnassignActionCellComponent {
	public rowData: any;
	public unassign = new EventEmitter<any>();

	get isActive(): boolean {
		return !!this.rowData?.isActive;
	}

	onClick(event: Event): void {
		event.stopPropagation();
		this.unassign.emit(this.rowData);
	}
}
