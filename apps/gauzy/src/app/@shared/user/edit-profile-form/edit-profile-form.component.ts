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
	Validators
} from '@angular/forms';
import {
	IUser,
	ITag,
	IRole,
	IUserUpdateInput,
	RolesEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Subject, firstValueFrom } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import {
	AuthService,
	ErrorHandlingService,
	RoleService,
	Store,
	ToastrService,
	UsersService
} from '../../../@core/services';
import { MatchValidator } from '../../../@core/validators';
import { FormHelpers } from '../../forms/helpers';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-profile',
	templateUrl: './edit-profile-form.component.html',
	styleUrls: ['./edit-profile-form.component.scss']
})
export class EditProfileFormComponent 
	implements OnInit, OnDestroy {

	FormHelpers: typeof FormHelpers = FormHelpers;

	hoverState: boolean;
	loading: boolean;

	role: IRole;
	user: IUser;

	user$: Subject<any> = new Subject();

	/*
	* Getter & Setter for selected user
	*/
	_selectedUser: IUser;
	get selectedUser(): IUser {
		return this._selectedUser;
	}
	@Input() set selectedUser(value: IUser) {
		this._selectedUser = value;
	}

	/*
	* Getter & Setter for allow role change
	*/
	_allowRoleChange: boolean = false;
	get allowRoleChange(): boolean {
		return this._allowRoleChange;
	}
	@Input() set allowRoleChange(value: boolean) {
		this._allowRoleChange = value;
	}

	@Output()
	userSubmitted = new EventEmitter<void>();

	public form: FormGroup = EditProfileFormComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			firstName: [],
			lastName: [],
			email: ['', Validators.required],
			imageUrl: ['', Validators.required],
			password: [],
			repeatPassword: [],
			role: [],
			tags: [],
			preferredLanguage: []
		}, {
			validators: [
				MatchValidator.mustMatch(
					'password',
					'repeatPassword'
				)
			]
		});
	}

	public excludes: RolesEnum[] = [];

	constructor(
		private readonly fb: FormBuilder,
		private readonly authService: AuthService,
		private readonly userService: UsersService,
		private readonly store: Store,
		private readonly toastrService: ToastrService,
		private readonly errorHandler: ErrorHandlingService,
		private readonly roleService: RoleService
	) {}

	async ngOnInit() {
		this.excludeRoles();
		this.user$
			.pipe(
				debounceTime(100),
				tap(() => this.getUserProfile()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				tap(() => this.user$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async excludeRoles() {
		const hasSuperAdminRole = await firstValueFrom(
			this.authService.hasRole([RolesEnum.SUPER_ADMIN])
		);
		if (!hasSuperAdminRole) {
			this.excludes.push(RolesEnum.SUPER_ADMIN);
		}
	}

	async getUserProfile() {
		try {
			const { id: userId } = this.selectedUser || this.user;
			const user = await this.userService.getUserById(userId, [
				'tags',
				'role'
			]);

			this._patchForm({ ...user });
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	handleImageUploadError(error: any) {
		this.toastrService.danger(error);
	}

	async updateImage(imageUrl: string){
		this.form.get('imageUrl').setValue(imageUrl);
		this.store.user = {
			...this.store.user,
			imageUrl: imageUrl
		}

		let request: IUserUpdateInput = {
			imageUrl
		};

		if (this.allowRoleChange) {
			const { tenantId } = this.store.user;
			const role = await firstValueFrom(this.roleService.getRoleByName({
					name: (this.form.get('role').value).name,
					tenantId
				})
			);

			request = {
				...request,
				role
			};
		}

		try {
			await this.userService.update(
				this.selectedUser ? this.selectedUser.id : this.store.userId,
				request
			)
			.then((res: IUser) => {
				try {
					if (res) {
						this.store.user = {
							...this.store.user,
							imageUrl: res.imageUrl
						} as IUser
					}
					this.toastrService.success('TOASTR.MESSAGE.IMAGE_UPDATED');
				} catch (error) { 
					console.log('Error while uploading profile avatar', error);
				}
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	async submitForm() {
		const { email, firstName, lastName, tags, preferredLanguage, password } = this.form.getRawValue();
		let request: IUserUpdateInput = {
			email,
			firstName,
			lastName,
			tags,
			preferredLanguage
		};

		if (password) {
			request = {
				...request,
				hash: password
			};
		}

		if (this.allowRoleChange) {
			const { tenantId } = this.store.user;
			const role = await firstValueFrom(this.roleService.getRoleByName({
					name: (this.form.get('role').value).name,
					tenantId
				})
			);

			request = {
				...request,
				role
			};
		}

		try {
			await this.userService.update(
				this.selectedUser ? this.selectedUser.id : this.store.userId,
				request
			)
			.then(() => {
				this.toastrService.success('TOASTR.MESSAGE.PROFILE_UPDATED');
				this.userSubmitted.emit();
				/**
				* selectedUser is null for edit profile and populated in User edit
				* Update app language when current user's profile is modified.
				*/
				if (this.selectedUser && this.selectedUser.id !== this.store.userId) { return; }
				this.store.preferredLanguage = preferredLanguage;
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	private _patchForm(user: IUser) {
		if (!user) { return; }

		this.form.patchValue({
			firstName: user.firstName,
			lastName: user.lastName,
			email: user.email,
			imageUrl: user.imageUrl,
			role: user.role,
			tags: user.tags,
			preferredLanguage: user.preferredLanguage
		});
		this.role = user.role;
	}

	selectedTagsHandler(tags: ITag[]) {
		this.form.get('tags').setValue(tags);
		this.form.updateValueAndValidity();
	}

	/**
	 * On Selection Change
	 * @param role 
	 */
	onSelectionChange(role: IRole) {
		this.form.get('role').setValue(role);
		this.form.get('role').updateValueAndValidity();
	}

	ngOnDestroy(): void { }
}
