import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
	BaseEntityWithMembers,
	EditEntityByMemberInput,
	Employee
} from '@gauzy/models';
import { EmployeeStore } from 'apps/gauzy/src/app/@core/services/employee-store.service';
import { Subject } from 'rxjs';

@Component({
	selector: 'ga-edit-employee-membership',
	templateUrl: './edit-employee-membership-form.component.html',
	styleUrls: ['./edit-employee-membership-form.component.scss']
})
export class EditEmployeeMembershipFormComponent implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	@Input() organizationEntities: BaseEntityWithMembers[];
	@Input() employeeEntities: BaseEntityWithMembers[];
	@Input() selectedEmployee: Employee;
	@Input() placeholder: string;
	@Input() title: string;

	@Output() entitiesAdded = new EventEmitter<EditEntityByMemberInput>();
	@Output() entitiesRemoved = new EventEmitter<EditEntityByMemberInput>();

	showAddCard: boolean;

	form: FormGroup;

	constructor(private fb: FormBuilder) {}

	ngOnInit() {
		this._initializeForm();
	}

	private _initializeForm() {
		this.form = this.fb.group({
			departments: ['', Validators.required]
		});
	}

	async removeDepartment(id: string) {
		this.entitiesRemoved.emit({
			member: this.selectedEmployee,
			removedEntityIds: [id]
		});
	}

	async submitForm() {
		if (this.form.valid) {
			this.entitiesAdded.emit({
				member: this.selectedEmployee,
				addedEntityIds: this.form.value.departments
			});
			this.showAddCard = !this.showAddCard;
			this.form.reset();
		}
	}
}
