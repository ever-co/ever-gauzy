import { Component, Input, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, Validators } from '@angular/forms';
import {
	ICreateEmailInvitesOutput,
	InvitationTypeEnum,
	OrganizationProjects,
	RolesEnum,
	OrganizationContact,
	OrganizationDepartment
} from '@gauzy/models';
import { InviteService } from '../../../../@core/services/invite.service';
import { RoleService } from '../../../../@core/services/role.service';
import { first } from 'rxjs/operators';
import { Router } from '@angular/router';
import { Store } from '../../../../@core/services/store.service';

@Component({
	selector: 'ga-email-invite-form',
	templateUrl: 'email-invite-form.component.html',
	styleUrls: ['email-invite-form.component.scss']
})
export class EmailInviteFormComponent implements OnInit {
	@Input() public organizationProjects: OrganizationProjects[];

	@Input() public organizationContact: OrganizationContact[];

	@Input() public organizationDepartments: OrganizationDepartment[];

	@Input() public selectedOrganizationId: string;

	@Input() public currentUserId: string;

	@Input() public isSuperAdmin: boolean;

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
	organizationContacts: any;
	departments: any;
	roleName: any;
	startedWorkOn: string;
	appliedDate: string;

	constructor(
		private readonly fb: FormBuilder,
		private readonly inviteService: InviteService,
		private readonly roleService: RoleService,
		private router: Router,
		private store: Store
	) {}

	ngOnInit(): void {
		this.allRoles = this.allRoles.filter((role) =>
			role === RolesEnum.SUPER_ADMIN ? this.isSuperAdmin : true
		);
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
			organizationContacts: [''],
			roleName: [
				'',
				this.isEmployeeInvitation() || this.isCandidateInvitation()
					? null
					: Validators.required
			]
		});

		this.emails = this.form.get('emails');
		this.projects = this.form.get('projects');
		this.organizationContacts = this.form.get('organizationContacts');
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

	selectAllOrganizationContacts() {
		this.organizationContacts.setValue(
			this.organizationContact
				.filter((organizationContact) => !!organizationContact.id)
				.map((organizationContact) => organizationContact.id)
		);
	}

	getRoleNameFromForm = () => {
		return this.roleName.value || RolesEnum.VIEWER;
	};

	async saveInvites(): Promise<ICreateEmailInvitesOutput> {
		if (this.form.valid) {
			const role = await this.roleService
				.getRoleByName({
					name: this.isEmployeeInvitation()
						? RolesEnum.EMPLOYEE
						: this.getRoleNameFromForm(),
					tenant: this.store.user.tenant
				})
				.pipe(first())
				.toPromise();

			return this.inviteService.createWithEmails({
				emailIds: this.emails.value.map((email) => email.emailAddress),
				projectIds: this.projects.value,
				departmentIds: this.departments.value,
				organizationContactIds: this.organizationContacts.value,
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
