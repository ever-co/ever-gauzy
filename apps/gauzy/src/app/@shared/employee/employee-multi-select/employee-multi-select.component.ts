import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Employee } from '@gauzy/models';

@Component({
	selector: 'ga-employee-multi-select',
	templateUrl: './employee-multi-select.component.html'
})
export class EmployeeSelectComponent {
	@Input() selectedEmployeeIds: string[];
	@Input() allEmployees: Employee[];

	@Output() selectedChange = new EventEmitter();

	constructor() {}

	onMembersSelected(selectEvent: any): void {
		this.selectedChange.emit(selectEvent);
	}
}
