import { Component, Input, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, Validators } from '@angular/forms';
import {
	CreateEmailInvitesOutput,
	InvitationTypeEnum,
	OrganizationProjects,
	RolesEnum
} from '@gauzy/models';
import { InviteService } from 'apps/gauzy/src/app/@core/services/invite.service';
import { RoleService } from 'apps/gauzy/src/app/@core/services/role.service';
import { first } from 'rxjs/operators';

@Component({
	selector: 'ga-email-invite-form',
	templateUrl: 'email-invite-form.component.html',
	styleUrls: ['email-invite-form.component.scss']
})
export class EmailInviteFormComponent implements OnInit {
	@Input() public organizationProjects: OrganizationProjects[];

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
	roleName: any;

	constructor(
		private readonly fb: FormBuilder,
		private readonly inviteService: InviteService,
		private readonly roleService: RoleService
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
			roleName: [
				'',
				this.isEmployeeInvitation() ? null : Validators.required
			]
		});

		this.emails = this.form.get('emails');
		this.projects = this.form.get('projects');
		this.roleName = this.form.get('roleName');
	};

	selectAllProjects() {
		this.projects.setValue(
			this.organizationProjects
				.filter((project) => !!project.id)
				.map((project) => project.id)
		);
	}

	getRoleNameFromForm = () => {
		return this.roleName.value || RolesEnum.VIEWER;
	};

	async saveInvites(): Promise<CreateEmailInvitesOutput> {
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
				roleId: role.id,
				organizationId: this.selectedOrganizationId,
				invitedById: this.currentUserId
			});
		}

		return;
	}
}
