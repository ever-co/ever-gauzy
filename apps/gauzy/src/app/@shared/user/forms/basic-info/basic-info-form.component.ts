import { Tenant } from './../../../../../../../../libs/models/src/lib/tenant.model';
import {
	Component,
	ViewChild,
	ElementRef,
	Input,
	OnInit,
	AfterViewInit
} from '@angular/core';
import { Validators, FormBuilder } from '@angular/forms';
import { User, RolesEnum } from '@gauzy/models';
import { AuthService } from 'apps/gauzy/src/app/@core/services/auth.service';
import { first } from 'rxjs/operators';
import { RoleService } from 'apps/gauzy/src/app/@core/services/role.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'ga-user-basic-info-form',
	templateUrl: 'basic-info-form.component.html',
	styleUrls: ['basic-info-form.component.scss']
})
export class BasicInfoFormComponent implements OnInit, AfterViewInit {
	UPLOADER_PLACEHOLDER: string = 'FORM.PLACEHOLDERS.UPLOADER_PLACEHOLDER';

	@ViewChild('imagePreview', { static: false })
	imagePreviewElement: ElementRef;

	@Input() public isEmployee: boolean;

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
	tenant: Tenant;

	constructor(
		private readonly fb: FormBuilder,
		private readonly authService: AuthService,
		private readonly roleService: RoleService,
		private readonly translateService: TranslateService
	) {}

	ngOnInit(): void {
		this.loadFormData();
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
		this.form = this.fb.group({
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
			startedWorkOn: ['', this.isEmployee ? Validators.required : null],
			role: ['', this.isEmployee ? null : Validators.required],
			offerDate: [''],
			acceptDate: [''],
			rejectDate: ['']
		});

		this.imageUrl = this.form.get('imageUrl');
		this.username = this.form.get('username');
		this.firstName = this.form.get('firstName');
		this.lastName = this.form.get('lastName');
		this.email = this.form.get('email');
		this.password = this.form.get('password');
		this.role = this.form.get('role');
	};

	get showImageMeta() {
		return this.imageUrl && this.imageUrl.value !== '';
	}

	async registerUser(defaultRoleName: RolesEnum) {
		const startedWorkOn = this.form.get('startedWorkOn');

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
						startedWorkOn: startedWorkOn.value,
						tenant: this.tenant
					},
					password: this.password.value
				})
				.pipe(first())
				.toPromise();
		}

		return;
	}

	deleteImg() {
		this.imageUrl.setValue('');
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
