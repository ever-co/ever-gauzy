import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UsersService } from '../../../@core/services/users.service';
import { Store } from '../../../@core/services/store.service';
import { User } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { RoleService } from '../../../@core/services/role.service';

@Component({
	selector: 'ngx-profile',
	templateUrl: './profile.component.html',
	styleUrls: [
		'../../employees/edit-employee/edit-employee-profile/edit-employee-profile.component.scss'
	]
})
export class ProfileComponent implements OnInit {
	form: FormGroup;
	hoverState: boolean;
	roleName: string;

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
		try {
			await this.userService.update(this.store.userId, this.form.value);
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
			firstName: [user.firstName, Validators.required],
			lastName: [user.lastName, Validators.required],
			email: [user.email, Validators.required],
			imageUrl: [user.imageUrl, Validators.required]
		});
	}
}
