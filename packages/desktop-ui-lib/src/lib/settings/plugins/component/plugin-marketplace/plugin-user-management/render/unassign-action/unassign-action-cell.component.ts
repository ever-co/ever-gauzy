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
			[nbTooltip]="tooltipText"
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

	get userName(): string {
		const first = this.rowData?.firstName || '';
		const last = this.rowData?.lastName || '';
		return `${first} ${last}`.trim() || 'this user';
	}

	get tooltipText(): string {
		return `Remove ${this.userName} from plugin entirely`;
	}

	onClick(event: Event): void {
		event.stopPropagation();
		this.unassign.emit(this.rowData);
	}
}
