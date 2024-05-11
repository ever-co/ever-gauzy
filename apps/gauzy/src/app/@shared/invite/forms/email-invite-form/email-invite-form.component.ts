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
import { EmailValidator } from '@gauzy/ui-sdk/core';
import { AuthService, InviteService, RoleService, Store } from './../../../../@core/services';
import { TranslationBaseComponent } from '../../../language-base';
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
	invitationExpiryOptions: any = [];

	@Input() public organizationProjects: IOrganizationProject[] = [];
	@Input() public organizationContacts: IOrganizationContact[] = [];
	@Input() public organizationDepartments: IOrganizationDepartment[] = [];
	@Input() public organizationTeams: IOrganizationTeam[] = [];

	/*
	 * Getter & Setter for InvitationTypeEnum
	 */
	_invitationType: InvitationTypeEnum;
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
	public form: UntypedFormGroup = EmailInviteFormComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group(
			{
				emails: ['', Validators.required],
				projects: [],
				startedWorkOn: [new Date()],
				appliedDate: [],
				departments: [],
				organizationContacts: [],
				role: [],
				invitationExpirationPeriod: [],
				teams: []
			},
			{
				validators: [EmailValidator.pattern('emails')]
			}
		);
	}

	@ViewChild(NbTagInputDirective, { read: ElementRef })
	tagInput: ElementRef<HTMLInputElement>;

	public user: IUser;
	public organization: IOrganization;

	emails: Set<string> = new Set([]);
	excludes: RolesEnum[] = [];

	constructor(
		private readonly fb: UntypedFormBuilder,
		private readonly inviteService: InviteService,
		private readonly rolesService: RoleService,
		private readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly authService: AuthService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				tap(() => this.excludeRoles()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.renderInvitationExpiryOptions()),
				filter((organization) => !!organization.invitesAllowed),
				tap((organization) => this.setInvitationPeriodFormValue(organization)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Exclude roles
	 */
	async excludeRoles() {
		const hasSuperAdminRole = await firstValueFrom(this.authService.hasRole([RolesEnum.SUPER_ADMIN]));
		this.excludes = [RolesEnum.EMPLOYEE];
		if (!hasSuperAdminRole) {
			this.excludes.push(RolesEnum.SUPER_ADMIN);
		}
	}

	/**
	 * Render Invitation Expiry Options
	 */
	renderInvitationExpiryOptions() {
		this.invitationExpiryOptions = [
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
	}

	isEmployeeInvitation() {
		return this.invitationType === InvitationTypeEnum.EMPLOYEE;
	}

	isCandidateInvitation() {
		return this.invitationType === InvitationTypeEnum.CANDIDATE;
	}

	/**
	 * SELECT all organization projects
	 */
	selectAllProjects() {
		const organizationProjects = this.organizationProjects
			.filter((project) => !!project.id)
			.map((project) => project.id);

		this.form.get('projects').setValue(organizationProjects);
		this.form.get('projects').updateValueAndValidity();
	}

	/**
	 * SELECT all organization departments
	 */
	selectAllDepartments() {
		const organizationDepartments = this.organizationDepartments
			.filter((department) => !!department.id)
			.map((department) => department.id);

		this.form.get('departments').setValue(organizationDepartments);
		this.form.get('departments').updateValueAndValidity();
	}

	/**
	 * SELECT all organization contacts
	 */
	selectAllOrganizationContacts() {
		const organizationContacts = this.organizationContacts
			.filter((organizationContact) => !!organizationContact.id)
			.map((organizationContact) => organizationContact.id);

		this.form.get('organizationContacts').setValue(organizationContacts);
		this.form.get('organizationContacts').updateValueAndValidity();
	}

	/**
	 * SELECT all organization teams
	 */
	selectAllTeams() {
		const organizationTeams = this.organizationTeams
			.filter((department) => !!department.id)
			.map((department) => department.id);

		this.form.get('teams').setValue(organizationTeams);
		this.form.get('teams').updateValueAndValidity();
	}

	getRoleFromForm = () => {
		if (this.isEmployeeInvitation()) {
			return RolesEnum.EMPLOYEE;
		}
		if (this.isCandidateInvitation()) {
			return RolesEnum.CANDIDATE;
		}
		return this.form.get('role').value.name || RolesEnum.VIEWER;
	};

	async saveInvites(): Promise<ICreateEmailInvitesOutput> {
		if (this.form.invalid) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const role = await firstValueFrom(
			this.rolesService.getRoleByOptions({
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

		return await this.inviteService.createWithEmails({
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
		this.form.updateValueAndValidity();
	}

	/**
	 * SET invitation period as per organization selection
	 *
	 * @param organization
	 */
	setInvitationPeriodFormValue(organization: IOrganization) {
		this.form
			.get('invitationExpirationPeriod')
			.setValue(organization.inviteExpiryPeriod || InvitationExpirationEnum.TWO_WEEK);
		this.form.get('invitationExpirationPeriod').updateValueAndValidity();
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
