import { Component, OnChanges, type SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { RestorableFilterComponent } from './restorable-filter.component';
import { ITaskStatus } from '@gauzy/contracts';

@Component({
	selector: 'ga-task-status-select-filter',
	template: `
		<ga-task-status-select
			[ngModel]="restored"
			[defaultSelected]="false"
			[addTag]="false"
			[placeholder]="'TASKS_PAGE.TASKS_STATUS' | translate"
			(onChanged)="onChange($event)"
		></ga-task-status-select>
	`,
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class TaskStatusFilterComponent extends RestorableFilterComponent implements OnChanges {
	constructor() {
		super();
	}

	/**
	 *
	 * @param changes
	 */
	ngOnChanges(changes: SimpleChanges) {}

	/**
	 *
	 * @param value
	 */
	onChange(value: ITaskStatus | null) {
		this.applyFilter(value);
	}
}
