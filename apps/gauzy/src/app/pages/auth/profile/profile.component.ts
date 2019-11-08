import { Component, OnInit, OnDestroy } from '@angular/core';
import {
	FormBuilder,
	FormGroup,
	Validators,
	AbstractControl
} from '@angular/forms';
import { UsersService } from '../../../@core/services/users.service';
import { Store } from '../../../@core/services/store.service';
import { User, UserFindInput } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { RoleService } from '../../../@core/services/role.service';
import { Subject } from 'rxjs';

@Component({
	selector: 'ngx-profile',
	templateUrl: './profile.component.html',
	styleUrls: [
		'../../employees/edit-employee/edit-employee-profile/edit-employee-profile.component.scss'
	]
})
export class ProfileComponent implements OnInit, OnDestroy {
	private ngDestroy$ = new Subject<void>();

	$password: any;

	form: FormGroup;
	hoverState: boolean;
	roleName: string;

	accountInfo: UserFindInput;
	password: AbstractControl;
	repeatPassword: AbstractControl;

	constructor(
		private fb: FormBuilder,
		private userService: UsersService,
		private store: Store,
		private toastrService: NbToastrService,
		private roleService: RoleService
	) {}

	async ngOnInit() {
		try {
			const user = await this.userService.getUserById(this.store.userId);
			this.roleName = (await this.roleService.getRoleById(
				user.roleId
			)).name;
			this._initializeForm(user);
			this.bindFormControls();
		} catch (error) {
			this.toastrService.danger(
				error.error.message || error.message,
				'Error'
			);
		}
	}

	handleImageUploadError(error: any) {
		this.toastrService.danger(
			error.error.message || error.message,
			'Error'
		);
	}

	async submitForm() {
		this.accountInfo = {
			email: this.form.value['email'],
			firstName: this.form.value['firstName'],
			imageUrl: this.form.value['imageUrl'],
			lastName: this.form.value['lastName'],
			hash: this.form.value['password']
		};
		try {
			console.log(this.accountInfo);
			await this.userService.update(this.store.userId, this.accountInfo);
			this.toastrService.primary(
				'Your profile has been updated successfully.',
				'Success'
			);
		} catch (error) {
			this.toastrService.danger(
				error.error.message || error.message,
				'Error'
			);
		}
	}

	private _initializeForm(user: User) {
		this.form = this.fb.group({
			firstName: [user.firstName],
			lastName: [user.lastName],
			email: [user.email, Validators.required],
			imageUrl: [user.imageUrl, Validators.required],
			password: ['', [Validators.required, Validators.minLength(4)]],
			repeatPassword: [
				'',
				[
					Validators.required,
					(control: AbstractControl) => {
						if (this.password) {
							console.log('control');

							console.log(control);
							return control.value === this.password.value
								? null
								: { validUrl: true };
						} else {
							return null;
						}
					}
				]
			]
		});
	}

	bindFormControls() {
		this.password = this.form.get('password');
		this.repeatPassword = this.form.get('repeatPassword');
	}

	ngOnDestroy(): void {
		if (this.$password) {
			this.$password.unsubscribe();
		}
		this.ngDestroy$.next();
		this.ngDestroy$.complete();
	}
}
