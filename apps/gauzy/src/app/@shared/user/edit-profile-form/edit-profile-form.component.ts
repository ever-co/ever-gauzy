import {
	Component,
	OnInit,
	OnDestroy,
	Input,
	Output,
	EventEmitter
} from '@angular/core';
import {
	FormBuilder,
	FormGroup,
	Validators,
	AbstractControl
} from '@angular/forms';
import { UsersService } from '../../../@core/services/users.service';
import { Store } from '../../../@core/services/store.service';
import { User, UserFindInput, RolesEnum, Tag } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { RoleService } from '../../../@core/services/role.service';
import { Subject } from 'rxjs';
import { takeUntil, first } from 'rxjs/operators';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';

@Component({
	selector: 'ngx-profile',
	templateUrl: './edit-profile-form.component.html',
	styleUrls: ['./edit-profile-form.component.scss']
})
export class EditProfileFormComponent implements OnInit, OnDestroy {
	private ngDestroy$ = new Subject<void>();

	form: FormGroup;
	hoverState: boolean;
	roleName: string;

	accountInfo: UserFindInput;
	password: AbstractControl;
	repeatPassword: AbstractControl;

	passwordErrorMsg: string;
	repeatPasswordErrorMsg: string;

	matchPassword = true;
	tags: Tag[];
	selectedTags: any;

	@Input()
	selectedUser: User;

	@Input()
	allowRoleChange = false;

	@Output()
	userSubmitted = new EventEmitter<void>();

	allRoles: string[] = Object.values(RolesEnum).filter(
		(r) => r !== RolesEnum.EMPLOYEE
	);

	constructor(
		private fb: FormBuilder,
		private userService: UsersService,
		private store: Store,
		private toastrService: NbToastrService,
		private errorHandler: ErrorHandlingService,
		private roleService: RoleService
	) {}

	private validations = {
		passwordControl: () => {
			this.password.valueChanges
				.pipe(takeUntil(this.ngDestroy$))
				.subscribe(() => {
					if (this.password.value === this.repeatPassword.value) {
						this.matchPassword = true;
					} else {
						this.matchPassword = false;
					}
				});
		},
		repeatPasswordControl: () => {
			this.repeatPassword.valueChanges
				.pipe(takeUntil(this.ngDestroy$))
				.subscribe(() => {
					if (this.password.value === this.repeatPassword.value) {
						this.matchPassword = true;
					} else {
						this.matchPassword = false;
					}

					this.repeatPasswordErrorMsg =
						(this.repeatPassword.touched ||
							this.repeatPassword.dirty) &&
						this.repeatPassword.errors
							? this.repeatPassword.errors.validUrl
								? this.passwordDoNotMuch()
								: Object.keys(this.repeatPassword.errors)[0]
							: '';
				});
		}
	};

	async ngOnInit() {
		try {
			const user = this.selectedUser
				? this.selectedUser
				: await this.userService.getUserById(this.store.userId);

			const role =
				this.selectedUser && this.selectedUser.role
					? this.selectedUser.role
					: await this.roleService.getRoleById(user.roleId);

			this.roleName = role.name;

			this._initializeForm({ ...user, role });
			this.bindFormControls();
			this.loadControls();
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	passwordDoNotMuch() {
		return 'Password Do Not Much!';
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
			tags: this.form.value['tags']
		};

		if (this.form.value['password']) {
			this.accountInfo = {
				...this.accountInfo,
				hash: this.form.value['password']
			};
		}

		if (this.allowRoleChange) {
			const role = await this.roleService
				.getRoleByName({
					name: this.form.value['roleName'],
					tenant: this.store.user.tenant
				})
				.pipe(first())
				.toPromise();

			this.accountInfo = {
				...this.accountInfo,
				role
			};
		}

		try {
			await this.userService.update(
				this.selectedUser ? this.selectedUser.id : this.store.userId,
				this.accountInfo
			);
			this.toastrService.primary(
				'Your profile has been updated successfully.',
				'Success'
			);
			this.userSubmitted.emit();
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	private _initializeForm(user: User) {
		this.tags = user.tags;
		this.form = this.fb.group({
			firstName: [user.firstName],
			lastName: [user.lastName],
			email: [user.email, Validators.required],
			imageUrl: [user.imageUrl, Validators.required],
			password: [''],
			repeatPassword: [
				'',
				[
					(control: AbstractControl) => {
						if (this.password) {
							return control.value === this.password.value
								? null
								: { validUrl: true };
						} else {
							return null;
						}
					}
				]
			],
			roleName: [user.role.name],
			tags: [user.tags]
		});
	}

	bindFormControls() {
		this.password = this.form.get('password');
		this.repeatPassword = this.form.get('repeatPassword');
	}

	loadControls() {
		this.validations.passwordControl();
		this.validations.repeatPasswordControl();
	}
	selectedTagsHandler(ev: any) {
		this.form.get('tags').setValue(ev);
	}

	ngOnDestroy(): void {
		this.ngDestroy$.next();
		this.ngDestroy$.complete();
	}
}
