import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'lib-assignment-date-cell',
	template: `{{ date | date: 'mediumDate' }}`,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe]
})
export class AssignmentDateCellComponent {
	public rowData: any;

	get date(): Date | null {
		const raw = this.rowData?.assignedAt || this.rowData?.createdAt;
		if (!raw) return null;
		const d = new Date(raw);
		return isNaN(d.getTime()) ? null : d;
	}
}
