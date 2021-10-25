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
	RolesEnum,
	ITag,
	IRole,
	IUserUpdateInput
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Subject, firstValueFrom } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import {
	ErrorHandlingService,
	RoleService,
	Store,
	ToastrService,
	UsersService
} from '../../../@core/services';
import { MatchValidator } from '../../../@core/validators';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-profile',
	templateUrl: './edit-profile-form.component.html',
	styleUrls: ['./edit-profile-form.component.scss']
})
export class EditProfileFormComponent 
	implements OnInit, OnDestroy {

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

	allRoles: string[] = Object.values(RolesEnum).filter(
		(r) => r !== RolesEnum.EMPLOYEE
	);

	public form: FormGroup = EditProfileFormComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			firstName: [],
			lastName: [],
			email: ['', Validators.required],
			imageUrl: ['', Validators.required],
			password: [],
			repeatPassword: [],
			roleName: [],
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

	constructor(
		private readonly fb: FormBuilder,
		private readonly userService: UsersService,
		private readonly store: Store,
		private readonly toastrService: ToastrService,
		private readonly errorHandler: ErrorHandlingService,
		private readonly roleService: RoleService
	) {}

	async ngOnInit() {
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
			const role = await firstValueFrom(this.roleService
				.getRoleByName({
					name: this.form.value['roleName'],
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
			roleName: user.role.name,
			tags: user.tags,
			preferredLanguage: user.preferredLanguage
		});
		this.role = user.role;
	}

	selectedTagsHandler(tags: ITag[]) {
		this.form.get('tags').setValue(tags);
		this.form.updateValueAndValidity();
	}

	isInvalidControl(control: string) {
		if (!this.form.contains(control)) {
			return true;
		}
		return this.form.get(control).touched && this.form.get(control).invalid;
	}

	ngOnDestroy(): void { }
}
