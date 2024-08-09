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
	IImageAsset,
	IEmployee
} from '@gauzy/contracts';
import { filter, firstValueFrom, tap } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	AuthService,
	CandidatesService,
	EmployeesService,
	ErrorHandlingService,
	RoleService,
	CompareDateValidator,
	UrlPatternValidator
} from '@gauzy/ui-core/core';
import { Store, distinctUntilChange } from '@gauzy/ui-core/common';
import { FormHelpers } from '../../../forms/helpers';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-user-basic-info-form',
	templateUrl: 'basic-info-form.component.html',
	styleUrls: ['basic-info-form.component.scss']
})
export class BasicInfoFormComponent extends TranslationBaseComponent implements OnInit, AfterViewInit {
	FormHelpers: typeof FormHelpers = FormHelpers;
	public excludes: RolesEnum[] = [];
	public organization: IOrganization;

	@Input() public selectedTags: ITag[] = [];

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

	public form: UntypedFormGroup = BasicInfoFormComponent.buildForm(this._fb, this);
	static buildForm(fb: UntypedFormBuilder, self: BasicInfoFormComponent): UntypedFormGroup {
		return fb.group(
			{
				firstName: [null, Validators.required],
				lastName: [null],
				username: [null],
				email: [null, [Validators.required, Validators.email]],
				imageUrl: { value: null, disabled: true },
				imageId: [null],
				password: [null, [Validators.required, Validators.minLength(4)]],
				startedWorkOn: [null],
				role: [null],
				offerDate: [null],
				acceptDate: [null],
				appliedDate: [null],
				rejectDate: [null],
				source: [null],
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

	@ViewChild('imagePreview') imagePreviewElement: ElementRef;

	constructor(
		public readonly translateService: TranslateService,
		private readonly _location: Location,
		private readonly _fb: UntypedFormBuilder,
		private readonly _authService: AuthService,
		private readonly _roleService: RoleService,
		private readonly _employeesService: EmployeesService,
		private readonly _candidatesService: CandidatesService,
		private readonly _store: Store,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.excludeRoles();
		this._store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				filter(() => !!this._location.getState()),
				tap(() => this.patchUsingLocationState(this._location.getState())),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Excludes the SUPER_ADMIN role if the current user doesn't have the necessary permissions.
	 */
	async excludeRoles(): Promise<void> {
		const hasSuperAdminRole = await firstValueFrom(this._authService.hasRole([RolesEnum.SUPER_ADMIN]));
		if (!hasSuperAdminRole) {
			this.excludes.push(RolesEnum.SUPER_ADMIN);
		}
	}

	/**
	 * Checks if the current form's role is either SUPER_ADMIN or ADMIN.
	 *
	 * @returns A boolean indicating whether the role is SUPER_ADMIN or ADMIN.
	 */
	public enableEmployee(): boolean {
		const role = this.form.get('role').value?.name;
		return role === RolesEnum.SUPER_ADMIN || role === RolesEnum.ADMIN;
	}

	get showImageMeta() {
		return this.form.get('imageUrl') && this.form.get('imageUrl').value;
	}

	/**
	 * Registers a user with different roles
	 *
	 * @param defaultRoleName - Default role to assign if none is specified
	 * @param organizationId - ID of the organization
	 * @param createdById - ID of the user who created this user
	 * @returns A promise of the created user or employee
	 */
	async registerUser(defaultRoleName: RolesEnum, organizationId?: string, createdById?: string) {
		if (this.form.invalid) {
			return;
		}

		const {
			firstName,
			lastName,
			email,
			username,
			password,
			tags,
			imageUrl,
			imageId,
			featureAsEmployee,
			role: formRole
		} = this.form.value;
		const { tenantId, tenant } = this._store.user;

		// Remove unnecessary featureOrganizations property
		delete tenant.featureOrganizations;

		const roleName = formRole?.name || defaultRoleName;
		const role: IRole = await this.getRole(roleName, tenantId);

		const user: IUser = {
			firstName,
			lastName,
			email,
			username: username || null,
			imageUrl,
			imageId,
			role,
			tenant,
			tags
		};

		if (role.name === RolesEnum.EMPLOYEE) {
			return await this.createEmployee(user);
		} else if (role.name === RolesEnum.CANDIDATE) {
			return await this.createCandidate(user);
		} else {
			return await this.createUser(user, password, organizationId, createdById, featureAsEmployee);
		}
	}

	/**
	 * Creates a user with the specified attributes, either as an employee or a regular user.
	 *
	 * @param user - The user details.
	 * @param password - The password for the user.
	 * @param organizationId - (Optional) The ID of the organization.
	 * @param createdById - (Optional) The ID of the user who created this user.
	 * @param featureAsEmployee - (Optional) Whether to create the user as an employee.
	 * @returns A promise resolving to the created user or employee.
	 */
	private async createUser(
		user: IUser,
		password: string,
		organizationId?: string,
		createdById?: string,
		featureAsEmployee?: boolean
	): Promise<any> {
		return await firstValueFrom(
			this._authService.register({
				user,
				password,
				confirmPassword: password,
				organizationId,
				createdById,
				featureAsEmployee
			})
		);
	}

	/**
	 * Fetches a role based on the provided role name and tenant ID.
	 *
	 * @param roleName - The name of the role to fetch.
	 * @param tenantId - The ID of the tenant to which the role belongs.
	 * @returns A promise resolving to the role object.
	 */
	private async getRole(roleName: RolesEnum, tenantId: string): Promise<IRole> {
		return await firstValueFrom(
			this._roleService.getRoleByOptions({
				name: roleName,
				tenantId
			})
		);
	}

	/**
	 * Delete existing image
	 */
	deleteImageUrl() {
		this.form.get('imageId').setValue(null);
		this.form.get('imageId').updateValueAndValidity();

		this.form.get('imageUrl').setValue(null);
		this.form.get('imageUrl').updateValueAndValidity();
	}

	/**
	 * Handle selected tags
	 *
	 * @param tags An array of tags to set in the form control.
	 */
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
	 * @param imageUrl The URL of the image to update in the form control.
	 */
	updateImageUrl(imageUrl: string) {
		try {
			const imageUrlControl = this.form.get('imageUrl') as FormControl;
			if (imageUrl) {
				imageUrlControl.enable();
				imageUrlControl.setValue(imageUrl);
			} else {
				imageUrlControl.setValue(null);
				imageUrlControl.disable();
			}
		} catch (error) {
			console.error('Error while updating user profile/avatar by third party URL:', error);
		}
	}

	/**
	 * Sets up validation for image URL based on image loading status.
	 */
	private _setupLogoUrlValidation() {
		// Clear errors on image load
		this.imagePreviewElement.nativeElement.onload = () => {
			this.form.get('imageUrl').setErrors(null);
		};

		// Set error on image load error, if showImageMeta is true
		this.imagePreviewElement.nativeElement.onerror = () => {
			if (this.showImageMeta) {
				this.form.get('imageUrl').setErrors({ invalidUrl: true });
			}
		};
	}

	/**
	 * Handle selection change for roles.
	 *
	 * @param role The selected role object.
	 */
	onSelectionChange(role: IRole) {
		if (this.isShowRole) {
			this.isCandidate = role.name === RolesEnum.CANDIDATE;
			this.isEmployee = role.name === RolesEnum.EMPLOYEE;
		}
	}

	/**
	 * SET role field validations based on the given value.
	 *
	 * @param value Indicates whether role validation is required (true) or not (false).
	 */
	setRoleValidations(value: boolean) {
		const control = this.form.get('role');
		if (value) {
			control.setValidators([Validators.required]);
		} else {
			control.clearValidators();
		}
		control.updateValueAndValidity();
	}

	/**
	 * Create an employee from the user page.
	 *
	 * @param user The user object containing employee details.
	 * @returns A promise that resolves to the created employee.
	 */
	async createEmployee(user: IUser): Promise<IEmployee> {
		const { id: organizationId, tenantId } = this.organization;
		const { password, tags } = this.form.value;
		const { offerDate = null, acceptDate = null, rejectDate = null, startedWorkOn = null } = this.form.value;

		const employee: IEmployeeCreateInput = {
			tenantId,
			user,
			startedWorkOn,
			password,
			organizationId,
			organization: { id: organizationId },
			offerDate,
			acceptDate,
			rejectDate,
			tags
		};

		try {
			// Create the employee using the employeesService
			return await firstValueFrom(this._employeesService.create(employee));
		} catch (error) {
			// Handle any errors here, e.g., log them or rethrow as needed
			this._errorHandlingService.handleError(`Failed to create employee: ${error.message}`);
		}
	}

	/**
	 * Create a candidate from user page.
	 *
	 * @param user The IUser object containing candidate's user details.
	 * @returns A Promise resolving to the created ICandidate object.
	 */
	async createCandidate(user: IUser): Promise<ICandidate> {
		const { id: organizationId, tenantId } = this.organization;
		const { password, tags } = this.form.value;
		const { appliedDate = null, rejectDate = null, source: sourceName = null } = this.form.value;

		let source: ICandidateSource | null = null;
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

		try {
			// Create the candidate using the _candidatesService
			return await firstValueFrom(this._candidatesService.create(candidate));
		} catch (error) {
			// Handle any errors here, e.g., log them or rethrow as needed
			this._errorHandlingService.handleError(`Failed to create candidate: ${error.message}`);
		}
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
