import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NbBadgeModule } from '@nebular/theme';

@Component({
	selector: 'lib-assignment-status-cell',
	template: `<nb-badge [status]="status" [text]="label"></nb-badge>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbBadgeModule]
})
export class AssignmentStatusCellComponent {
	public rowData: any;

	get status(): string {
		return this.rowData?.isActive ? 'success' : 'warning';
	}

	get label(): string {
		return this.rowData?.isActive ? 'Active' : 'Inactive';
	}
}
