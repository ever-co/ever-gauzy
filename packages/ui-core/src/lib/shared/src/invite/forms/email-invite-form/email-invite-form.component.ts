import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import {
	ICreateEmailInvitesOutput,
	InvitationTypeEnum,
	IOrganizationProject,
	RolesEnum,
	IOrganizationContact,
	IOrganizationDepartment,
	IOrganization,
	IUser,
	InvitationExpirationEnum,
	IRole,
	IOrganizationTeam
} from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { NbTagComponent, NbTagInputAddEvent, NbTagInputDirective } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { AuthService, EmailValidator, InviteService, RoleService } from '@gauzy/ui-core/core';
import { Store } from '@gauzy/ui-core/common';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { FormHelpers } from '../../../forms/helpers';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-email-invite-form',
	templateUrl: 'email-invite-form.component.html',
	styleUrls: ['email-invite-form.component.scss']
})
export class EmailInviteFormComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	FormHelpers: typeof FormHelpers = FormHelpers;

	invitationTypeEnum = InvitationTypeEnum;

	@Input() public organizationProjects: IOrganizationProject[] = [];
	@Input() public organizationContacts: IOrganizationContact[] = [];
	@Input() public organizationDepartments: IOrganizationDepartment[] = [];
	@Input() public organizationTeams: IOrganizationTeam[] = [];

	/*
	 * Getter & Setter for InvitationTypeEnum
	 */
	private _invitationType: InvitationTypeEnum;
	get invitationType(): InvitationTypeEnum {
		return this._invitationType;
	}
	@Input() set invitationType(value: InvitationTypeEnum) {
		this._invitationType = value;
		this.setFormValidators();
	}

	/**
	 * Build email invite form group
	 *
	 */
	public form: UntypedFormGroup = this._fb.group(
		{
			emails: [null, Validators.required],
			projects: [[]],
			startedWorkOn: [new Date()],
			appliedDate: [],
			departments: [[]],
			organizationContacts: [[]],
			role: [],
			invitationExpirationPeriod: [],
			teams: [[]]
		},
		{
			validators: [EmailValidator.pattern('emails')]
		}
	);

	@ViewChild(NbTagInputDirective, { read: ElementRef })
	tagInput: ElementRef<HTMLInputElement>;

	public user: IUser;
	public organization: IOrganization;
	public emails: Set<string> = new Set([]);
	public excludes: RolesEnum[] = [];
	public invitationExpiryOptions = [
		{
			label: this.getTranslation('INVITE_PAGE.INVITATION_EXPIRATION_OPTIONS.DAY'),
			value: InvitationExpirationEnum.DAY
		},
		{
			label: this.getTranslation('INVITE_PAGE.INVITATION_EXPIRATION_OPTIONS.WEEK'),
			value: InvitationExpirationEnum.WEEK
		},
		{
			label: this.getTranslation('INVITE_PAGE.INVITATION_EXPIRATION_OPTIONS.TWO_WEEK'),
			value: InvitationExpirationEnum.TWO_WEEK
		},
		{
			label: this.getTranslation('INVITE_PAGE.INVITATION_EXPIRATION_OPTIONS.MONTH'),
			value: InvitationExpirationEnum.MONTH
		},
		{
			label: this.getTranslation('INVITE_PAGE.INVITATION_EXPIRATION_OPTIONS.NEVER'),
			value: InvitationExpirationEnum.NEVER
		}
	];

	constructor(
		public readonly translateService: TranslateService,
		private readonly _fb: UntypedFormBuilder,
		private readonly _inviteService: InviteService,
		private readonly _rolesService: RoleService,
		private readonly _store: Store,
		private readonly _authService: AuthService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				tap(() => this.excludeRoles()),
				untilDestroyed(this)
			)
			.subscribe();
		this._store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap((organization: IOrganization) => this.setInvitationPeriodFormValue(organization)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {}

	/**
	 * Exclude roles
	 */
	async excludeRoles() {
		const hasSuperAdminRole = await firstValueFrom(this._authService.hasRole([RolesEnum.SUPER_ADMIN]));
		this.excludes = [RolesEnum.EMPLOYEE];
		if (!hasSuperAdminRole) {
			this.excludes.push(RolesEnum.SUPER_ADMIN);
		}
	}

	isEmployeeInvitation(): boolean {
		return this.invitationType === InvitationTypeEnum.EMPLOYEE;
	}

	isCandidateInvitation(): boolean {
		return this.invitationType === InvitationTypeEnum.CANDIDATE;
	}

	/**
	 * SELECT all organization projects
	 */
	selectAllProjects() {
		const organizationProjects = this.organizationProjects.map((project) => project.id).filter(Boolean);

		this.form.get('projects').setValue(organizationProjects);
		this.form.get('projects').updateValueAndValidity();
	}

	/**
	 * SELECT all organization departments and update form control value
	 */
	selectAllDepartments() {
		const departmentIds = this.organizationDepartments.map((department) => department.id).filter(Boolean);

		this.form.patchValue({
			departments: departmentIds
		});
	}

	/**
	 * SELECT all organization contacts and update form control value
	 */
	selectAllOrganizationContacts() {
		const organizationContactIds = this.organizationContacts.map((contact) => contact.id).filter(Boolean);

		this.form.patchValue({
			organizationContacts: organizationContactIds
		});
	}

	/**
	 * SELECT all organization teams and update form control value
	 */
	selectAllTeams() {
		const organizationTeamsIds = this.organizationTeams.map((team) => team.id).filter(Boolean);

		this.form.patchValue({
			teams: organizationTeamsIds
		});
	}

	/**
	 * Retrieves the role from the form based on the invitation type.
	 * Defaults to a viewer role if no specific role is found in the form.
	 * @returns The role enum value.
	 */
	getRoleFromForm(): RolesEnum {
		if (this.isEmployeeInvitation()) {
			return RolesEnum.EMPLOYEE;
		}
		if (this.isCandidateInvitation()) {
			return RolesEnum.CANDIDATE;
		}

		// Default to viewer role if form role value is not set
		const formRole = this.form.get('role').value;
		return formRole ? formRole.name : RolesEnum.VIEWER;
	}

	/**
	 *
	 * @returns
	 */
	async saveInvites(): Promise<ICreateEmailInvitesOutput> {
		if (this.form.invalid) {
			return;
		}
		const { id: organizationId, tenantId } = this.organization;
		const role: IRole = await firstValueFrom(
			this._rolesService.getRoleByOptions({
				name: this.getRoleFromForm(),
				tenantId
			})
		);

		const {
			startedWorkOn,
			appliedDate,
			emails,
			invitationExpirationPeriod,
			projects = [],
			departments = [],
			organizationContacts = [],
			teams = []
		} = this.form.value;

		return await this._inviteService.createWithEmails({
			emailIds: emails,
			projectIds: projects,
			departmentIds: departments,
			organizationContactIds: organizationContacts,
			teamIds: teams,
			roleId: role.id,
			organizationId,
			tenantId,
			inviteType: this.invitationType,
			startedWorkOn: startedWorkOn ? new Date(startedWorkOn) : null,
			appliedDate: appliedDate ? new Date(appliedDate) : null,
			invitationExpirationPeriod
		});
	}

	/**
	 * Remove email from emails form control
	 *
	 * @param tagToRemove
	 */
	onEmailRemove(tagToRemove: NbTagComponent): void {
		this.emails.delete(tagToRemove.text);
		this.form.patchValue({
			emails: [...this.emails.entries()].map(([email]) => email)
		});
	}

	/**
	 * Add emails to form emails control
	 *
	 * @param param0
	 */
	onEmailAdd({ value, input }: NbTagInputAddEvent): void {
		if (value) {
			this.emails.add(value);
		}
		input.nativeElement.value = '';

		this.form.patchValue({
			emails: [...this.emails.entries()].map(([email]) => email)
		});
	}

	/**
	 * Email focus out event fire
	 *
	 * @param event
	 */
	onFocusOut(event: any) {
		const value = event.target.value;
		this.onEmailAdd({
			value,
			input: this.tagInput
		});
	}

	/**
	 * Reset emails form control
	 *
	 */
	onResetEmails() {
		[...this.emails.entries()].forEach(([email]) => {
			this.emails.delete(email);
		});

		this.form.patchValue({
			emails: [...this.emails.entries()].map(([email]) => email)
		});
	}

	/**
	 * SET form validators
	 *
	 */
	setFormValidators() {
		if (this.isEmployeeInvitation() || this.isCandidateInvitation()) {
			this.form.get('role').clearValidators();
		} else {
			this.form.get('role').setValidators([Validators.required]);
		}
		this.form.get('role').updateValueAndValidity();
	}

	/**
	 * SET invitation period as per organization selection
	 *
	 * @param organization
	 */
	setInvitationPeriodFormValue(organization: IOrganization) {
		if (organization.invitesAllowed) {
			const inviteExpiryPeriod = organization.inviteExpiryPeriod || InvitationExpirationEnum.TWO_WEEK;

			this.form.get('invitationExpirationPeriod').setValue(inviteExpiryPeriod);
			this.form.get('invitationExpirationPeriod').updateValueAndValidity();
		}
	}

	/**
	 * On Selection Change
	 * @param role
	 */
	onSelectionChange(role: IRole) {
		this.form.get('role').setValue(role);
		this.form.get('role').updateValueAndValidity();
	}

	ngOnDestroy() {
		this.emails.clear();
	}
}
