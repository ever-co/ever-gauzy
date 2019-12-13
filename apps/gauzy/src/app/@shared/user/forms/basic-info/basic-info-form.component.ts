import { Component, ViewChild, ElementRef } from '@angular/core';
import { Validators, FormBuilder } from '@angular/forms';
import { User, RolesEnum } from '@gauzy/models';
import { AuthService } from 'apps/gauzy/src/app/@core/services/auth.service';
import { first } from 'rxjs/operators';
import { RoleService } from 'apps/gauzy/src/app/@core/services/role.service';

@Component({
	selector: 'ga-user-basic-info-form',
	templateUrl: 'basic-info-form.component.html',
	styleUrls: ['basic-info-form.component.scss']
})
export class BasicInfoFormComponent {
	uploaderPlaceholder: string = 'Image';

	@ViewChild('imagePreview', { static: false })
	imagePreviewElement: ElementRef;

	readonly form = this.fb.group({
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
			Validators.compose([Validators.required, Validators.minLength(4)])
		],
		startedWorkOn: ['', Validators.compose([Validators.required])]
	});

	username = this.form.get('username');
	firstName = this.form.get('firstName');
	lastName = this.form.get('lastName');
	email = this.form.get('email');
	imageUrl = this.form.get('imageUrl');
	password = this.form.get('password');
	off: string;
	startedWorkOn = this.form.get('startedWorkOn');

	constructor(
		private readonly fb: FormBuilder,
		private readonly authService: AuthService,
		private readonly roleService: RoleService
	) {}

	get showImageMeta() {
		return this.imageUrl && this.imageUrl.value !== '';
	}

	async registerUser(roleName: RolesEnum): Promise<User> {
		if (this.form.valid) {
			const role = await this.roleService
				.getRoleByName({ name: roleName })
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
						startedWorkOn: this.startedWorkOn.value
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
