import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
	ICreateEmailInvitesOutput,
	InvitationTypeEnum,
	IOrganizationProject,
	RolesEnum,
	IOrganizationContact,
	IOrganizationDepartment,
	IOrganization,
	IUser,
	InvitationExpirationEnum
} from '@gauzy/contracts';
import { filter, first, tap } from 'rxjs/operators';
import { NbTagComponent, NbTagInputAddEvent, NbTagInputDirective } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { InviteService, RoleService, Store } from './../../../../@core/services';
import { EmailValidator } from '../../../../@core/validators';
import { TranslationBaseComponent } from '../../../language-base';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-email-invite-form',
	templateUrl: 'email-invite-form.component.html',
	styleUrls: ['email-invite-form.component.scss']
})
export class EmailInviteFormComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	invitationTypeEnum = InvitationTypeEnum;
	roles: any[] = [];
	invitationExpiryOptions: any = [];
	
	@Input() public organizationProjects: IOrganizationProject[];
	@Input() public organizationContacts: IOrganizationContact[];
	@Input() public organizationDepartments: IOrganizationDepartment[];

	/*
	* Getter & Setter for check Super Admin
	*/
	_isSuperAdmin: boolean;
	get isSuperAdmin(): boolean {
		return this._isSuperAdmin;
	}
	@Input() set isSuperAdmin(value: boolean) {
		this._isSuperAdmin = value;
	}

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
	public form: FormGroup = EmailInviteFormComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			emails: ['', Validators.required],
			projects: [],
			startedWorkOn: [],
			appliedDate: [],
			departments: [],
			organizationContacts: [],
			roleName: [],
			invitationExpirationPeriod: []
		}, {
			validators: [
				EmailValidator.pattern('emails')
			] 
		});
	}

	@ViewChild(NbTagInputDirective, { read: ElementRef }) 
	tagInput: ElementRef<HTMLInputElement>;

	user: IUser;
	organization: IOrganization;

	emails: Set<string> = new Set([]);

	constructor(
		private readonly fb: FormBuilder,
		private readonly inviteService: InviteService,
		private readonly roleService: RoleService,
		private readonly router: Router,
		private readonly store: Store,
		public readonly translateService: TranslateService
	) {
		super(translateService)
	}

	ngOnInit(): void {
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				tap(() => this.renderRoles()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this.renderInvitationExpiryOptions()),
				filter((organization) => !!organization.invitesAllowed),
				tap((organization) => this.setInvitationPeriodFormValue(organization)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	renderRoles() {
		this.roles = Object.values(RolesEnum).filter(
			(role) => role !== RolesEnum.EMPLOYEE
		).filter((role) =>
			role === RolesEnum.SUPER_ADMIN ? this.isSuperAdmin : true
		);
	}

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
		]
	}

	ngOnDestroy() {
		this.emails.clear();
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
			.map((department) => department.id)

		this.form.get('departments').setValue(organizationDepartments);
		this.form.get('departments').updateValueAndValidity();
	}

	/**
	 * SELECT all organization contacts
	 */
	selectAllOrganizationContacts() {
		const organizationContacts = this.organizationContacts
			.filter((organizationContact) => !!organizationContact.id)
			.map((organizationContact) => organizationContact.id)

		this.form.get('organizationContacts').setValue(organizationContacts);
		this.form.get('organizationContacts').updateValueAndValidity();
	}

	getRoleNameFromForm = () => {
		if (this.isEmployeeInvitation()) {
			return RolesEnum.EMPLOYEE;
		}
		if (this.isCandidateInvitation()) {
			return RolesEnum.CANDIDATE;
		}
		return this.form.get('roleName').value || RolesEnum.VIEWER;
	};

	async saveInvites(): Promise<ICreateEmailInvitesOutput> {
		if (this.form.invalid) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const role = await this.roleService
			.getRoleByName({
				name: this.getRoleNameFromForm(),
				tenantId
			})
			.pipe(first())
			.toPromise();
		
		const {
			startedWorkOn,
			appliedDate,
			emails,
			invitationExpirationPeriod,
			projects = [],
			departments = [],
			organizationContacts = []
		} = this.form.value;

		return this.inviteService.createWithEmails({
			emailIds: emails,
			projectIds: projects,
			departmentIds: departments,
			organizationContactIds: organizationContacts,
			roleId: role.id,
			organizationId,
			tenantId,
			invitedById: this.user.id,
			inviteType: this.router.url,
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
			emails: [
				...this.emails.entries()
			].map(([email]) => email)
		});
	}
	
	/**
	 * Add emails to form emails control
	 * 
	 * @param param0 
	 */
	onEmailAdd({ value, input }: NbTagInputAddEvent): void {
		if (value) {
			this.emails.add(value)
		}
		input.nativeElement.value = '';

		this.form.patchValue({
			emails: [
				...this.emails.entries()
			].map(([email]) => email)
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
			emails: [
				...this.emails.entries()
			].map(([email]) => email)
		});
	}

	/**
	 * Form invalid control validate
	 * 
	 * @param control 
	 * @returns 
	 */
	isInvalidControl(control: string) {
		if (!this.form.contains(control)) {
			return true;
		}
		return this.form.get(control).touched && 
			this.form.get(control).invalid;
	}

	/**
	 * SET form validators
	 * 
	 */
	setFormValidators() {
		if (this.isEmployeeInvitation() || this.isCandidateInvitation()) {
			this.form.get('roleName').clearValidators();
		} else {
			this.form.get('roleName').setValidators([
				Validators.required
			]);
		}
		this.form.updateValueAndValidity();
	}

	/**
	 * SET invitation period as per organization selection 
	 * 
	 * @param organization 
	 */
	setInvitationPeriodFormValue(organization: IOrganization) {
		this.form.get('invitationExpirationPeriod').setValue(
			organization.inviteExpiryPeriod || InvitationExpirationEnum.TWO_WEEK
		);
		this.form.get('invitationExpirationPeriod').updateValueAndValidity();
	}
}
