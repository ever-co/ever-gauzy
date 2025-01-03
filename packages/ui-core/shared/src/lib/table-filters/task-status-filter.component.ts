import { Component, OnChanges, SimpleChanges } from '@angular/core';
import { DefaultFilter } from 'angular2-smart-table';
import { ITaskStatus } from '@gauzy/contracts';

@Component({
    selector: 'ga-task-status-select-filter',
    template: `
		<ga-task-status-select
			[defaultSelected]="false"
			[addTag]="false"
			[placeholder]="'TASKS_PAGE.TASKS_STATUS' | translate"
			(onChanged)="onChange($event)"
		></ga-task-status-select>
	`,
    standalone: false
})
export class TaskStatusFilterComponent extends DefaultFilter implements OnChanges {
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
		this.column.filterFunction(value, this.column.id);
	}
}
