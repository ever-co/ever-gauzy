import { Component, ViewChild, ElementRef, Input, OnInit, AfterViewInit } from '@angular/core';
import { Validators, UntypedFormBuilder, UntypedFormGroup, FormControl } from '@angular/forms';
import { Location } from '@angular/common';
import {
	RolesEnum,
	ITag,
	IUser,
	IRole,
	IOrganization,
	IEmployeeCreateInput,
	ICandidateSource,
	ICandidateCreateInput,
	ICandidate,
	IImageAsset
} from '@gauzy/contracts';
import { filter, firstValueFrom, tap } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import {
	AuthService,
	CandidatesService,
	EmployeesService,
	RoleService,
	CompareDateValidator,
	UrlPatternValidator
} from '@gauzy/ui-sdk/core';
import { Store, distinctUntilChange } from '@gauzy/ui-sdk/common';
import { FormHelpers } from '../../../forms/helpers';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-user-basic-info-form',
	templateUrl: 'basic-info-form.component.html',
	styleUrls: ['basic-info-form.component.scss']
})
export class BasicInfoFormComponent extends TranslationBaseComponent implements OnInit, AfterViewInit {
	@ViewChild('imagePreview')
	imagePreviewElement: ElementRef;

	@Input() public selectedTags: ITag[];

	/*
	 * Getter & Setter for check is for candidate mutation
	 */
	private _isCandidate: boolean = false;
	public get isCandidate(): boolean {
		return this._isCandidate;
	}
	@Input() public set isCandidate(value: boolean) {
		this._isCandidate = value;
	}

	/*
	 * Getter & Setter for check is for employee mutation
	 */
	private _isEmployee: boolean = false;
	public get isEmployee(): boolean {
		return this._isEmployee;
	}
	@Input() public set isEmployee(value: boolean) {
		this._isEmployee = value;
	}

	/*
	 * Getter & Setter for dynamic hide/show roles dropdown
	 */
	private _isShowRole: boolean = false;
	public get isShowRole(): boolean {
		return this._isShowRole;
	}
	@Input() public set isShowRole(value: boolean) {
		this._isShowRole = value;
		this.setRoleValidations(value);
	}

	FormHelpers: typeof FormHelpers = FormHelpers;
	public excludes: RolesEnum[] = [];
	public organization: IOrganization;

	public form: UntypedFormGroup = BasicInfoFormComponent.buildForm(this.fb, this);
	static buildForm(fb: UntypedFormBuilder, self: BasicInfoFormComponent): UntypedFormGroup {
		return fb.group(
			{
				firstName: [],
				lastName: [],
				username: [],
				email: ['', Validators.compose([Validators.required, Validators.email])],
				imageUrl: [{ value: null, disabled: true }],
				imageId: [],
				password: ['', Validators.compose([Validators.required, Validators.minLength(4)])],
				startedWorkOn: [],
				role: [],
				offerDate: [],
				acceptDate: [],
				appliedDate: [],
				rejectDate: [],
				source: [],
				tags: [self.selectedTags],
				featureAsEmployee: [false]
			},
			{
				validators: [
					CompareDateValidator.validateDate('offerDate', 'acceptDate'),
					CompareDateValidator.validateDate('offerDate', 'rejectDate'),
					UrlPatternValidator.imageUrlValidator('imageUrl')
				]
			}
		);
	}

	constructor(
		private readonly fb: UntypedFormBuilder,
		private readonly authService: AuthService,
		private readonly roleService: RoleService,
		private readonly employeesService: EmployeesService,
		private readonly candidatesService: CandidatesService,
		public readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly location: Location
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.excludeRoles();
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				filter(() => !!this.location.getState()),
				tap(() => this.patchUsingLocationState(this.location.getState())),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Exclude SUPER_ADMIN role, if don't have permissions
	 */
	async excludeRoles() {
		const hasSuperAdminRole = await firstValueFrom(this.authService.hasRole([RolesEnum.SUPER_ADMIN]));
		if (!hasSuperAdminRole) {
			this.excludes.push(RolesEnum.SUPER_ADMIN);
		}
	}

	public enableEmployee() {
		return (
			this.form.get('role').value &&
			(this.form.get('role').value.name === RolesEnum.SUPER_ADMIN ||
				this.form.get('role').value.name === RolesEnum.ADMIN)
		);
	}

	get showImageMeta() {
		return this.form.get('imageUrl') && this.form.get('imageUrl').value;
	}

	async registerUser(defaultRoleName: RolesEnum, organizationId?: string, createdById?: string) {
		if (this.form.invalid) {
			return;
		}
		const { firstName, lastName, email, username, password } = this.form.value;
		const {
			tags,
			imageUrl,
			imageId,
			featureAsEmployee,
			role: { name }
		} = this.form.value;

		const { tenantId, tenant } = this.store.user;
		/**
		 * Removed feature organizations from payload,
		 * which is not necessary to send into the payload
		 */
		if (tenant.hasOwnProperty('featureOrganizations')) {
			delete tenant['featureOrganizations'];
		}

		const role = await firstValueFrom(
			this.roleService.getRoleByOptions({
				name: name || defaultRoleName,
				tenantId
			})
		);
		const user: IUser = {
			firstName: firstName,
			lastName: lastName,
			email: email,
			username: username || null,
			imageUrl: imageUrl,
			imageId: imageId,
			role: role,
			tenant: tenant,
			tags: tags
		};
		if (role.name === RolesEnum.EMPLOYEE) {
			return this.createEmployee(user);
		} else if (role.name === RolesEnum.CANDIDATE) {
			return this.createCandidate(user);
		} else {
			if (featureAsEmployee === true) {
				return await firstValueFrom(
					this.employeesService.create({
						user: user,
						organization: this.organization,
						password: password
					})
				);
			} else {
				return await firstValueFrom(
					this.authService.register({
						user: user,
						password: password,
						confirmPassword: password,
						organizationId,
						createdById
					})
				);
			}
		}
	}

	/**
	 * Delete existing image
	 *
	 */
	deleteImageUrl() {
		this.form.get('imageId').setValue(null);
		this.form.get('imageId').updateValueAndValidity();

		this.form.get('imageUrl').setValue(null);
		this.form.get('imageUrl').updateValueAndValidity();
	}

	selectedTagsHandler(tags: ITag[]) {
		this.form.get('tags').setValue(tags);
		this.form.get('tags').updateValueAndValidity();
	}

	ngAfterViewInit() {
		this._setupLogoUrlValidation();
	}

	/**
	 * Upload profile image/avatar
	 *
	 * @param image
	 */
	updateImageAsset(image: IImageAsset) {
		try {
			if (image && image.id) {
				this.form.get('imageId').setValue(image.id);
				this.form.get('imageUrl').setValue(image.fullUrl);
				this.form.updateValueAndValidity();

				const imageUrlControl = <FormControl>this.form.get('imageUrl');
				imageUrlControl.disable();
			}
		} catch (error) {
			console.log('Error while updating user profile/avatar by uploading');
		}
	}

	/**
	 * Upload third party URL as image/avatar
	 *
	 * @param image
	 */
	updateImageUrl(imageUrl: string) {
		try {
			const imageUrlControl = <FormControl>this.form.get('imageUrl');
			if (imageUrl) {
				imageUrlControl.enable();
				imageUrlControl.setValue(imageUrl);
			} else {
				imageUrlControl.setValue(null);
				imageUrlControl.disable();
			}
		} catch (error) {
			console.log('Error while updating user profile/avatar by third party URL');
		}
	}

	private _setupLogoUrlValidation() {
		this.imagePreviewElement.nativeElement.onload = () => {
			this.form.get('imageUrl').setErrors(null);
		};

		this.imagePreviewElement.nativeElement.onerror = () => {
			if (this.showImageMeta) {
				this.form.get('imageUrl').setErrors({ invalidUrl: true });
			}
		};
	}

	/**
	 * On Selection Change
	 * @param role
	 */
	onSelectionChange(role: IRole) {
		if (this.isShowRole) {
			this.isCandidate = role.name === RolesEnum.CANDIDATE;
			this.isEmployee = role.name === RolesEnum.EMPLOYEE;
		}
	}

	/**
	 * SET role field validations
	 *
	 * @param value
	 */
	setRoleValidations(value: boolean) {
		if (value === true) {
			this.form.get('role').setValidators([Validators.required]);
		} else {
			this.form.get('role').clearValidators();
		}
		this.form.get('role').updateValueAndValidity();
	}

	/**
	 * Create employee from user page
	 *
	 * @param user
	 * @returns
	 */
	async createEmployee(user: IUser) {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { password, tags } = this.form.value;
		const { offerDate = null, acceptDate = null, rejectDate = null, startedWorkOn = null } = this.form.value;

		const employee: IEmployeeCreateInput = {
			tenantId,
			user,
			startedWorkOn: startedWorkOn,
			password: password,
			organizationId,
			offerDate,
			acceptDate,
			rejectDate,
			tags: tags
		};
		return await firstValueFrom(this.employeesService.create(employee));
	}

	/**
	 * Create candidate from user page
	 *
	 * @param user
	 * @returns
	 */
	async createCandidate(user: IUser): Promise<ICandidate> {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { password, tags } = this.form.value;
		const { appliedDate = null, rejectDate = null, source: sourceName = null } = this.form.value;

		let source: ICandidateSource = null;
		if (sourceName !== null) {
			source = {
				name: sourceName,
				tenantId,
				organizationId
			};
		}
		const candidate: ICandidateCreateInput = {
			user,
			password,
			documents: [],
			appliedDate,
			source,
			rejectDate,
			tags,
			tenantId,
			organizationId
		};
		return await firstValueFrom(this.candidatesService.create(candidate));
	}

	/**
	 * GET location old state & patch form value
	 * We are using such functionality for create new employee from header selector
	 *
	 * @param state
	 */
	patchUsingLocationState(state: any) {
		if (!this.form) {
			return;
		}
		this.form.patchValue({ ...state });
		this.form.updateValueAndValidity();
	}
}
