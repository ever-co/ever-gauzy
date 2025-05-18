import { Component, OnChanges, SimpleChanges } from '@angular/core';
import { DefaultFilter } from 'angular2-smart-table';
import { CustomFilterConfig, ITaskStatus } from '@gauzy/contracts';

@Component({
	selector: 'ga-task-status-select-filter',
	template: `
		<ga-task-status-select
			[status]="initialValue"
			[defaultSelected]="false"
			[addTag]="false"
			[placeholder]="'TASKS_PAGE.TASKS_STATUS' | translate"
			(onChanged)="onChange($event)"
		></ga-task-status-select>
	`,
	standalone: false
})
export class TaskStatusFilterComponent extends DefaultFilter implements OnChanges {
	public initialValue: ITaskStatus;

	constructor() {
		super();
	}

	ngOnInit() {
		const config = this.column?.filter?.config as CustomFilterConfig;
		if (config?.initialValueStatus) {
			this.initialValue = config?.initialValueStatus;
		}
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
