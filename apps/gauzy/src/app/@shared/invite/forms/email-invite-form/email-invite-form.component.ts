import { Component, Input, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, Validators } from '@angular/forms';
import {
	ICreateEmailInvitesOutput,
	InvitationTypeEnum,
	IOrganizationProject,
	RolesEnum,
	IOrganizationContact,
	IOrganizationDepartment,
	IOrganization
} from '@gauzy/contracts';
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
	
	@Input() public organizationProjects: IOrganizationProject[];

	@Input() public organizationContact: IOrganizationContact[];

	@Input() public organizationDepartments: IOrganizationDepartment[];

	@Input() public selectedOrganization: IOrganization;

	@Input() public currentUserId: string;

	@Input() public isSuperAdmin: boolean;

	@Input()
	invitationType: InvitationTypeEnum;

	invitationTypeEnum = InvitationTypeEnum;

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

	emailListValidator(
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

	addTagFn(emailAddress: string) {
		return { emailAddress: emailAddress, tag: true };
	}

	loadFormData = () => {
		this.form = this.fb.group({
			emails: [
				'',
				Validators.compose([
					Validators.required,
					this.emailListValidator
				])
			],
			projects: [],
			startedWorkOn: [],
			appliedDate: [],
			departments: [],
			organizationContacts: [],
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
		if (this.isEmployeeInvitation()) {
			return RolesEnum.EMPLOYEE;
		}
		if (this.isCandidateInvitation()) {
			return RolesEnum.CANDIDATE;
		}
		return this.roleName.value || RolesEnum.VIEWER;
	};

	async saveInvites(): Promise<ICreateEmailInvitesOutput> {
		if (this.form.valid) {
			const { tenantId } = this.store.user;
			const role = await this.roleService
				.getRoleByName({
					name: this.getRoleNameFromForm(),
					tenantId
				})
				.pipe(first())
				.toPromise();
			
			const { startedWorkOn, appliedDate } = this.form.value;
			return this.inviteService.createWithEmails({
				emailIds: this.emails.value.map((email: any) => email.emailAddress),
				projectIds: this.projects.value,
				departmentIds: this.departments.value,
				organizationContactIds: this.organizationContacts.value,
				roleId: role.id,
				organizationId: this.selectedOrganization.id,
				tenantId,
				invitedById: this.currentUserId,
				inviteType: this.router.url,
				startedWorkOn: startedWorkOn ? new Date(startedWorkOn) : null,
				appliedDate: appliedDate ? new Date(appliedDate) : null
			});
		}

		return;
	}
}
