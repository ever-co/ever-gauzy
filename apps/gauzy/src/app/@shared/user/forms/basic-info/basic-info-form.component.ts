import {
	Component,
	ViewChild,
	ElementRef,
	Input,
	OnInit,
	AfterViewInit
} from '@angular/core';
import { Validators, FormBuilder, FormGroup } from '@angular/forms';
import { RolesEnum, ITag, IUser, IRole, IOrganization } from '@gauzy/contracts';
import { filter, firstValueFrom, tap } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { distinctUntilChange } from '@gauzy/common-angular';
import { TranslationBaseComponent } from '../../../language-base/translation-base.component';
import { AuthService, EmployeesService, RoleService, Store } from './../../../../@core/services';
import { CompareDateValidator, UrlPatternValidator } from './../../../../@core/validators';
import { FormHelpers } from '../../../forms/helpers';

@Component({
	selector: 'ga-user-basic-info-form',
	templateUrl: 'basic-info-form.component.html',
	styleUrls: ['basic-info-form.component.scss']
})
export class BasicInfoFormComponent
	extends TranslationBaseComponent
	implements OnInit, AfterViewInit {

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
	* Getter & Setter for check Super Admin
	*/
	private _isSuperAdmin: boolean = false;
	public get isSuperAdmin(): boolean {
		return this._isSuperAdmin;
	}
	@Input() public set isSuperAdmin(value: boolean) {
		this._isSuperAdmin = value;
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
	excludes: RolesEnum[] = [];
	public organization: IOrganization;

	public form: FormGroup = BasicInfoFormComponent.buildForm(this.fb, this);
	static buildForm(fb: FormBuilder, self: BasicInfoFormComponent): FormGroup {
		return fb.group({
			firstName: [],
			lastName: [],
			username: [],
			email: [
				'',
				Validators.compose([Validators.required, Validators.email])
			],
			imageUrl: [''],
			password: [
				'',
				Validators.compose([
					Validators.required,
					Validators.minLength(4)
				])
			],
			startedWorkOn: [],
			role: [],
			offerDate: [],
			acceptDate: [],
			appliedDate: [],
			hiredDate: [],
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
		});
	}

	constructor(
		private readonly fb: FormBuilder,
		private readonly authService: AuthService,
		private readonly roleService: RoleService,
		private readonly employeesService: EmployeesService,
		public readonly translateService: TranslateService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit(): void {
		if (!this.isSuperAdmin) {
			this.excludes.push(RolesEnum.SUPER_ADMIN);
		}
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
			)
			.subscribe();
	}

	public enableEmployee() {
		return this.form.get('role').value && (
			(this.form.get('role').value).name === RolesEnum.SUPER_ADMIN ||
			(this.form.get('role').value).name === RolesEnum.ADMIN
		);
	}

	get showImageMeta() {
		return this.form.get('imageUrl') && this.form.get('imageUrl').value !== '';
	}

	async registerUser(
		defaultRoleName: RolesEnum,
		organizationId?: string,
		createdById?: string
	) {
		if (this.form.invalid) {
			return;
		}
		const { firstName, lastName, email, username, password } = this.form.getRawValue();
		const { tags, imageUrl, featureAsEmployee, role: { name } } = this.form.getRawValue();

		const { tenantId, tenant } = this.store.user;
		/**
		* Removed feature organizations from payload, 
		* which is not necessary to send into the payload 
		*/
		if (tenant.hasOwnProperty('featureOrganizations')) {
			delete tenant['featureOrganizations'];
		}

		const role = await firstValueFrom(
			this.roleService.getRoleByName({
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
			role: role,
			tenant: tenant,
			tags: tags
		};

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

	deleteImageUrl() {
		this.form.get('imageUrl').setValue('');
		this.form.get('imageUrl').updateValueAndValidity();
	}

	selectedTagsHandler(tags: ITag[]) {
		this.form.get('tags').setValue(tags);
		this.form.get('tags').updateValueAndValidity();
	}

	ngAfterViewInit() {
		this._setupLogoUrlValidation();
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
			this.isCandidate = (role.name === RolesEnum.CANDIDATE);
			this.isEmployee = (role.name === RolesEnum.EMPLOYEE);
		}
	}

	/**
	 * SET role field validations
	 * 
	 * @param value 
	 */
	setRoleValidations(value: boolean) {
		if (value === true) {
			this.form.get('role').setValidators([ Validators.required ]);
		} else {
			this.form.get('role').clearValidators();
		}
		this.form.get('role').updateValueAndValidity();
	}
}
