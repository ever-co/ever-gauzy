import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { IBaseEntityWithMembers, IEditEntityByMemberInput, IEmployee, IOrganization } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-sdk/common';

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

	public showAddCard: boolean;
	public organization: IOrganization = this.store.selectedOrganization;

	public form: UntypedFormGroup = EditEmployeeMembershipFormComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			departments: ['', Validators.required]
		});
	}

	constructor(private readonly fb: UntypedFormBuilder, private readonly store: Store) {}

	ngOnInit(): void {}

	async removeDepartment(id: string) {
		if (!this.organization) {
			return;
		}
		const { id: organizationId } = this.organization;
		this.entitiesRemoved.emit({
			member: this.selectedEmployee,
			removedEntityIds: [id],
			organizationId: organizationId
		});
	}

	async submitForm() {
		if (!this.organization) {
			return;
		}
		if (this.form.valid) {
			const { id: organizationId } = this.organization;
			this.entitiesAdded.emit({
				member: this.selectedEmployee,
				addedEntityIds: this.form.value.departments,
				organizationId: organizationId
			});
			this.showAddCard = !this.showAddCard;
			this.form.reset();
		}
	}
}
