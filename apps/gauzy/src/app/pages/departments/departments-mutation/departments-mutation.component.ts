import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IEmployee, ITag } from '@gauzy/contracts';

@Component({
	selector: 'ga-departments-mutation',
	templateUrl: './departments-mutation.component.html',
	styleUrls: ['./departments-mutation.component.scss']
})
export class DepartmentsMutationComponent implements OnInit {
	@Input()
	employees: IEmployee[];
	@Input()
	organizationId: string;
	@Input()
	department?: any;
	@Input()
	isGridEdit: boolean;

	@Output()
	canceled = new EventEmitter();
	@Output()
	addOrEditDepartment = new EventEmitter();

	members: string[];
	name: string;
	selectedEmployeeIds: string[];
	tags: ITag[] = [];

	ngOnInit() {
		if (this.department) {
			this.selectedEmployeeIds = this.department.members.map(
				(member) => member.id
			);
			this.name = this.isGridEdit
				? this.department.department_name
				: this.department.name;
			this.tags = this.department.tags;
		}
	}

	addOrEditDepartments() {
		this.addOrEditDepartment.emit({
			tags: this.tags,
			name: this.name,
			members: (this.members || this.selectedEmployeeIds || [])
				.map((id) => this.employees.find((e) => e.id === id))
				.filter((e) => !!e),
			organizationId: this.organizationId
		});

		this.name = '';
		this.selectedEmployeeIds = [];
		this.members = [];
	}

	onMembersSelected(members: string[]) {
		this.members = members;
	}

	cancel() {
		this.canceled.emit();
	}
	selectedTagsEvent(ev) {
		this.tags = ev;
	}
}
