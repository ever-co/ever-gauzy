import {
	Component,
	ViewChild,
	ElementRef,
	Input,
	OnInit,
	AfterViewInit
} from '@angular/core';
import { Validators, FormBuilder } from '@angular/forms';
import { RolesEnum, Tag, ITenant } from '@gauzy/models';
import { AuthService } from 'apps/gauzy/src/app/@core/services/auth.service';
import { first } from 'rxjs/operators';
import { RoleService } from 'apps/gauzy/src/app/@core/services/role.service';
import { TranslateService } from '@ngx-translate/core';
import { ValidationService } from 'apps/gauzy/src/app/@core/services/validation.service';
import { TagsService } from 'apps/gauzy/src/app/@core/services/tags.service';

@Component({
	selector: 'ga-user-basic-info-form',
	templateUrl: 'basic-info-form.component.html',
	styleUrls: ['basic-info-form.component.scss']
})
export class BasicInfoFormComponent implements OnInit, AfterViewInit {
	UPLOADER_PLACEHOLDER = 'FORM.PLACEHOLDERS.UPLOADER_PLACEHOLDER';

	@ViewChild('imagePreview', { static: false })
	imagePreviewElement: ElementRef;

	@Input() public isEmployee: boolean;
	@Input() public isCandidate: boolean;
	@Input() public isCandidateCV: boolean;
	@Input() public isSuperAdmin: boolean;

	allRoles: string[] = Object.values(RolesEnum).filter(
		(e) => e !== RolesEnum.EMPLOYEE
	);

	//Fields for the form
	form: any;
	imageUrl: any;
	username: any;
	firstName: any;
	lastName: any;
	email: any;
	password: any;
	off: any;
	role: any;
	tenant: ITenant;
	offerDate: any;
	acceptDate: any;
	appliedDate: any;
	hiredDate: any;
	rejectDate: any;
	tags: Tag[] = [];
	selectedTags: any;
	items: any;
	cvUrl: any;

	constructor(
		private readonly fb: FormBuilder,
		private readonly authService: AuthService,
		private readonly roleService: RoleService,
		private readonly translateService: TranslateService,
		private readonly validatorService: ValidationService,
		private readonly tagsService: TagsService
	) {}

	ngOnInit(): void {
		this.allRoles = this.allRoles.filter((role) =>
			role === RolesEnum.SUPER_ADMIN ? this.isSuperAdmin : true
		);
		this.loadFormData();

		// this.getAllTags();
	}

	get uploaderPlaceholder() {
		return this._translate(this.UPLOADER_PLACEHOLDER);
	}

	private _translate(key: string): string {
		let translationResult = '';

		this.translateService.get(key).subscribe((res) => {
			translationResult = res;
		});

		return translationResult;
	}

	loadFormData = () => {
		this.form = this.fb.group(
			{
				username: [''],
				firstName: [''],
				lastName: [''],
				email: [
					'',
					Validators.compose([Validators.required, Validators.email])
				],
				imageUrl: [
					'',
					Validators.compose([
						Validators.pattern(
							new RegExp(
								`(http)?s?:?(\/\/[^"']*\.(?:png|jpg|jpeg|gif|png|svg))`,
								'g'
							)
						)
					])
				],
				password: [
					'',
					Validators.compose([
						Validators.required,
						Validators.minLength(4)
					])
				],
				startedWorkOn: [''],
				role: [
					'',
					this.isCandidate || this.isEmployee
						? null
						: Validators.required
				],
				offerDate: [''],
				acceptDate: [''],
				appliedDate: [''],
				hiredDate: [''],
				rejectDate: [''],
				cvUrl: [
					'',
					Validators.compose([
						Validators.pattern(
							new RegExp(
								`(http)?s?:?(\/\/[^"']*\.(?:doc|docx|pdf|))`,
								'g'
							)
						)
					])
				]
			},
			{
				validator: this.validatorService.validateDate
			}
		);

		this.imageUrl = this.form.get('imageUrl');
		this.cvUrl = this.form.get('cvUrl');
		this.username = this.form.get('username');
		this.firstName = this.form.get('firstName');
		this.lastName = this.form.get('lastName');
		this.email = this.form.get('email');
		this.password = this.form.get('password');
		this.role = this.form.get('role');
		this.offerDate = this.form.get('offerDate');
		this.acceptDate = this.form.get('acceptDate');
		this.appliedDate = this.form.get('appliedDate');
		this.hiredDate = this.form.get('hiredDate');
		this.rejectDate = this.form.get('rejectDate');
		this.selectedTags = this.form.get('selectedTags');
	};

	get showImageMeta() {
		return this.imageUrl && this.imageUrl.value !== '';
	}

	async registerUser(defaultRoleName: RolesEnum, organizationId?: string) {
		if (this.form.valid) {
			const role = await this.roleService
				.getRoleByName({
					name: this.role.value ? this.role.value : defaultRoleName
				})
				.pipe(first())
				.toPromise();

			return this.authService
				.register({
					user: {
						firstName: this.firstName.value,
						lastName: this.lastName.value,
						email: this.email.value,
						username: this.username.value || null,
						imageUrl: this.imageUrl.value,
						role,
						tenant: this.tenant,
						tags: this.selectedTags
					},
					password: this.password.value,
					organizationId
				})
				.pipe(first())
				.toPromise();
		}

		return;
	}

	deleteImg() {
		this.imageUrl.setValue('');
	}

	selectedTagsHandler(ev) {
		this.form.get('selectedTags').setValue(ev);
	}

	ngAfterViewInit() {
		this._setupLogoUrlValidation();
	}

	private _setupLogoUrlValidation() {
		this.imagePreviewElement.nativeElement.onload = () => {
			this.imageUrl.setErrors(null);
		};

		this.imagePreviewElement.nativeElement.onerror = () => {
			if (this.showImageMeta) {
				this.imageUrl.setErrors({ invalidUrl: true });
			}
		};
	}
}
