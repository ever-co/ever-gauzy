import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
	Employee,
	OrganizationContacts,
	OrganizationProjects
} from '@gauzy/models';

@Component({
	selector: 'ga-edit-organization-contacts-mutation',
	templateUrl: './edit-organization-contacts-mutation.component.html'
})
export class EditOrganizationClientMutationComponent implements OnInit {
	@Input()
	employees: Employee[];
	@Input()
	organizationId: string;
	@Input()
	client?: OrganizationContacts;
	@Input()
	projectsWithoutClients: OrganizationProjects[];

	@Output()
	canceled = new EventEmitter();
	@Output()
	addOrEditClient = new EventEmitter();

	form: FormGroup;
	members: string[];
	selectedEmployeeIds: string[];
	allProjects: OrganizationProjects[] = [];

	constructor(private readonly fb: FormBuilder) {}

	ngOnInit() {
		this._initializeForm();
		this.allProjects = (this.projectsWithoutClients || []).concat(
			this.client ? this.client.projects : []
		);
		if (this.client) {
			this.selectedEmployeeIds = this.client.members.map(
				(member) => member.id
			);
		}
	}

	private _initializeForm() {
		if (!this.organizationId) {
			return;
		}

		this.form = this.fb.group({
			name: [this.client ? this.client.name : '', Validators.required],
			primaryEmail: [
				this.client ? this.client.primaryEmail : '',
				[Validators.required, Validators.email]
			],
			primaryPhone: [
				this.client ? this.client.primaryPhone : '',
				Validators.required
			],
			country: [this.client ? this.client.country : ''],
			city: [this.client ? this.client.city : ''],
			street: [this.client ? this.client.street : ''],
			selectProjects: [
				this.client ? (this.client.projects || []).map((m) => m.id) : []
			]
		});
	}

	onMembersSelected(members: string[]) {
		this.members = members;
	}

	cancel() {
		this.canceled.emit();
	}

	async submitForm() {
		if (this.form.valid) {
			this.addOrEditClient.emit({
				id: this.client ? this.client.id : undefined,
				organizationId: this.organizationId,
				name: this.form.value['name'],
				primaryEmail: this.form.value['primaryEmail'],
				primaryPhone: this.form.value['primaryPhone'],
				country: this.form.value['country'],
				city: this.form.value['city'],
				street: this.form.value['street'],
				projects: this.form.value['selectProjects']
					.map((id) => this.allProjects.find((e) => e.id === id))
					.filter((e) => !!e),
				members: (this.members || this.selectedEmployeeIds || [])
					.map((id) => this.employees.find((e) => e.id === id))
					.filter((e) => !!e)
			});

			this.selectedEmployeeIds = [];
			this.members = [];
			this.form.reset({
				name: '',
				primaryEmail: '',
				primaryPhone: '',
				country: '',
				city: '',
				street: '',
				selectProjects: []
			});
		}
	}
}
