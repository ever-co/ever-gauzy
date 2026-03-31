import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

/** Row data expected by AssignmentDateCellComponent */
export interface AssignmentDateRow {
	assignedAt?: string | Date;
	createdAt?: string | Date;
	[key: string]: unknown;
}

@Component({
	selector: 'lib-assignment-date-cell',
	template: `{{ date() | date: 'mediumDate' }}`,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe]
})
export class AssignmentDateCellComponent {
	private readonly _rowData = signal<AssignmentDateRow | undefined>(undefined);

	set rowData(value: AssignmentDateRow) {
		this._rowData.set(value);
	}

	readonly date = computed(() => {
		const data = this._rowData();
		const raw = data?.assignedAt || data?.createdAt;
		if (!raw) return null;
		const d = new Date(raw as string);
		return isNaN(d.getTime()) ? null : d;
	});
}
