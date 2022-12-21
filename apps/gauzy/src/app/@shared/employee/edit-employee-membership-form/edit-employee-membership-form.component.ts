import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
	IBaseEntityWithMembers,
	IEditEntityByMemberInput,
	IEmployee
} from '@gauzy/contracts';

@Component({
	selector: 'ga-edit-employee-membership',
	templateUrl: './edit-employee-membership-form.component.html',
	styleUrls: ['./edit-employee-membership-form.component.scss']
})
export class EditEmployeeMembershipFormComponent implements OnInit {

	@Input() organizationEntities: IBaseEntityWithMembers[] = [];
	@Input() employeeEntities: IBaseEntityWithMembers[] = [];
	@Input() selectedEmployee: IEmployee;
	@Input() placeholder: string;
	@Input() title: string;

	@Output() entitiesAdded = new EventEmitter<IEditEntityByMemberInput>();
	@Output() entitiesRemoved = new EventEmitter<IEditEntityByMemberInput>();

	showAddCard: boolean;

	public form: FormGroup = EditEmployeeMembershipFormComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			departments: ['', Validators.required]
		});
	}

	constructor(
		private readonly fb: FormBuilder
	) {}

	ngOnInit(): void {}

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
