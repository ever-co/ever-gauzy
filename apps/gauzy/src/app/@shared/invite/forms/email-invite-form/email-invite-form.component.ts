import { Component, Input, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, Validators } from '@angular/forms';
import {
	CreateEmailInvitesOutput,
	InvitationTypeEnum,
	OrganizationProjects,
	RolesEnum,
	OrganizationClients,
	OrganizationDepartment
} from '@gauzy/models';
import { InviteService } from 'apps/gauzy/src/app/@core/services/invite.service';
import { RoleService } from 'apps/gauzy/src/app/@core/services/role.service';
import { first } from 'rxjs/operators';
import { Router } from '@angular/router';

@Component({
	selector: 'ga-email-invite-form',
	templateUrl: 'email-invite-form.component.html',
	styleUrls: ['email-invite-form.component.scss']
})
export class EmailInviteFormComponent implements OnInit {
	@Input() public organizationProjects: OrganizationProjects[];

	@Input() public organizationClients: OrganizationClients[];

	@Input() public organizationDepartments: OrganizationDepartment[];

	@Input() public selectedOrganizationId: string;

	@Input() public currentUserId: string;

	@Input()
	invitationType: InvitationTypeEnum;

	allRoles: string[] = Object.values(RolesEnum).filter(
		(e) => e !== RolesEnum.EMPLOYEE
	);

	emailAddresses: any[] = [];
	alertText = '';

	//Fields for the form
	form: any;
	emails: any;
	projects: any;
	clients: any;
	departments: any;
	roleName: any;
	startedWorkOn: string;
	appliedDate: string;

	constructor(
		private readonly fb: FormBuilder,
		private readonly inviteService: InviteService,
		private readonly roleService: RoleService,
		private router: Router
	) {}

	ngOnInit(): void {
		this.loadFormData();
	}

	EmailListValidator(
		control: AbstractControl
	): { [key: string]: boolean } | null {
		const emailPattern = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
		const invalid = (control.value || []).find((tag) => {
			return !emailPattern.test(tag.emailAddress || '');
		});
		return invalid ? { emails: invalid } : null;
	}

	isEmployeeInvitation = () => {
		return this.invitationType === InvitationTypeEnum.EMPLOYEE;
	};
	isCandidateInvitation = () => {
		return this.invitationType === InvitationTypeEnum.CANDIDATE;
	};

	addTagFn(emailAddress) {
		return { emailAddress: emailAddress, tag: true };
	}

	loadFormData = () => {
		this.form = this.fb.group({
			emails: [
				'',
				Validators.compose([
					Validators.required,
					this.EmailListValidator
				])
			],
			projects: [''],
			startedWorkOn: [''],
			appliedDate: [''],
			departments: [''],
			clients: [''],
			roleName: [
				'',
				this.isEmployeeInvitation() || this.isCandidateInvitation()
					? null
					: Validators.required
			]
		});

		this.emails = this.form.get('emails');
		this.projects = this.form.get('projects');
		this.clients = this.form.get('clients');
		this.departments = this.form.get('departments');
		this.roleName = this.form.get('roleName');
		this.startedWorkOn = this.form.get('startedWork');
		this.appliedDate = this.form.get('appliedDate');
	};

	selectAllProjects() {
		this.projects.setValue(
			this.organizationProjects
				.filter((project) => !!project.id)
				.map((project) => project.id)
		);
	}

	selectAllDepartments() {
		this.departments.setValue(
			this.organizationDepartments
				.filter((department) => !!department.id)
				.map((department) => department.id)
		);
	}

	selectAllClients() {
		this.clients.setValue(
			this.organizationClients
				.filter((client) => !!client.id)
				.map((client) => client.id)
		);
	}

	getRoleNameFromForm = () => {
		return this.roleName.value || RolesEnum.VIEWER;
	};

	async saveInvites(): Promise<CreateEmailInvitesOutput> {
		const inviteType = 'user';

		if (this.form.valid) {
			const role = await this.roleService
				.getRoleByName({
					name: this.isEmployeeInvitation()
						? RolesEnum.EMPLOYEE
						: this.getRoleNameFromForm()
				})
				.pipe(first())
				.toPromise();

			return this.inviteService.createWithEmails({
				emailIds: this.emails.value.map((email) => email.emailAddress),
				projectIds: this.projects.value,
				departmentIds: this.departments.value,
				clientIds: this.clients.value,
				roleId: role.id,
				organizationId: this.selectedOrganizationId,
				invitedById: this.currentUserId,
				inviteType: this.router.url,
				startedWorkOn: this.startedWorkOn
			});
		}

		return;
	}
}
