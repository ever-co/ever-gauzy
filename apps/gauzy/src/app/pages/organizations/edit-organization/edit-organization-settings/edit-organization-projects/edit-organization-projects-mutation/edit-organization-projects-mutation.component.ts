import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import {
	CurrenciesEnum,
	Employee,
	Organization,
	OrganizationClients,
	OrganizationProjects,
	ProjectTypeEnum
} from '@gauzy/models';

@Component({
	selector: 'ga-edit-organization-projects-mutation',
	templateUrl: './edit-organization-projects-mutation.component.html'
})
export class EditOrganizationProjectsMutationComponent implements OnInit {
	@Input()
	employees: Employee[];
	@Input()
	organization: Organization;
	@Input()
	clients?: OrganizationClients[];
	@Input()
	project: OrganizationProjects;

	@Output()
	canceled = new EventEmitter();
	@Output()
	addOrEditProject = new EventEmitter();

	form: FormGroup;
	members: string[];
	selectedEmployeeIds: string[];
	types: string[] = Object.values(ProjectTypeEnum);
	currencies: string[] = Object.values(CurrenciesEnum);
	defaultCurrency: string;
	public: boolean = true;

	constructor(private readonly fb: FormBuilder) {}

	ngOnInit() {
		this._initializeForm();
	}

	private _initializeForm() {
		if (!this.organization) {
			return;
		}

		if (this.project) {
			this.selectedEmployeeIds = this.project.members.map(
				(member) => member.id
			);
		}

		this.defaultCurrency = this.organization.currency || 'USD';

		this.form = this.fb.group({
			public: this.project ? this.project.public : this.public,
			name: [this.project ? this.project.name : ''],
			client: [
				this.project && this.project.client
					? this.project.client.id
					: ''
			],
			type: [this.project ? this.project.type : 'RATE'],
			currency: [
				{
					value: this.project
						? this.project.currency
						: this.defaultCurrency,
					disabled: true
				}
			],
			startDate: [this.project ? this.project.startDate : null],
			endDate: [this.project ? this.project.endDate : null]
		});
	}

	togglePublic(state: boolean) {
		this.public = state;
	}

	onMembersSelected(members: string[]) {
		this.members = members;
	}

	cancel() {
		this.canceled.emit();
	}

	async submitForm() {
		if (this.form.valid) {
			this.addOrEditProject.emit({
				public: this.form.value['public'],
				id: this.project ? this.project.id : undefined,
				organizationId: this.organization.id,
				name: this.form.value['name'],
				client: this.clients.find(
					(c) => c.id === this.form.value['client']
				),
				type: this.form.value['type'],
				currency: this.form.value['currency'] || this.defaultCurrency,
				startDate: this.form.value['startDate'],
				endDate: this.form.value['endDate'],
				members: (this.members || this.selectedEmployeeIds || [])
					.map((id) => this.employees.find((e) => e.id === id))
					.filter((e) => !!e)
			});

			this.selectedEmployeeIds = [];
			this.members = [];
		}
	}
}
