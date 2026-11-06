import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Subject, filter, debounceTime, tap, firstValueFrom } from 'rxjs';
import { DEFAULT_TIME_FORMATS } from '@gauzy/constants';
import { IUser, ITag, IRole, IUserUpdateInput, RolesEnum, IImageAsset } from '@gauzy/contracts';
import { patterns } from '@gauzy/constants';
import {
	AuthService,
	EmailValidator,
	ErrorHandlingService,
	MatchValidator,
	RoleService,
	Store,
	ToastrService,
	UsersService
} from '@gauzy/ui-core/core';
import { FormHelpers } from '../../forms/helpers';

/** Roles with a USERS_PAGE.ROLE string; any other (INTERVIEWER, a custom role) shows by its name. */
const TRANSLATED_ROLES: RolesEnum[] = [
	RolesEnum.SUPER_ADMIN,
	RolesEnum.ADMIN,
	RolesEnum.MANAGER,
	RolesEnum.DATA_ENTRY,
	RolesEnum.VIEWER,
	RolesEnum.EMPLOYEE,
	RolesEnum.CANDIDATE
];

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-profile',
	templateUrl: './edit-profile-form.component.html',
	styleUrls: ['./edit-profile-form.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class EditProfileFormComponent implements OnInit, OnDestroy {
	FormHelpers: typeof FormHelpers = FormHelpers;
	hoverState: boolean;
	loading: boolean;
	/** A save is on its way: the Save button waits for it. */
	saving = false;
	/** The photo failed to load: the placeholder shows instead. */
	avatarFailed = false;
	listOfTimeFormats = DEFAULT_TIME_FORMATS;
	role: IRole;
	/** The signed-in user (from the store). */
	user: IUser;
	/** The user being edited, as last read: the identity panel's name, role, dates and verification. */
	profile: IUser;
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

	@Output() userSubmitted = new EventEmitter<void>();

	public form: UntypedFormGroup = EditProfileFormComponent.buildForm(this._fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group(
			{
				firstName: [],
				lastName: [],
				email: [null, [Validators.required, Validators.email]],
				imageUrl: [{ value: null, disabled: true }],
				imageId: [],
				password: [],
				repeatPassword: [],
				role: [],
				tags: [],
				preferredLanguage: [],
				timeZone: [],
				timeFormat: [],
				phoneNumber: []
			},
			{
				validators: [MatchValidator.mustMatch('password', 'repeatPassword')]
			}
		);
	}

	public excludes: RolesEnum[] = [];

	/** Whether the profile being edited is the signed-in user's own. */
	get isOwnProfile(): boolean {
		return !this.selectedUser?.id || this.selectedUser.id === this._store.userId;
	}

	/** The name shown in the identity panel: the full name, else the email. */
	get displayName(): string {
		const { firstName, lastName, email } = this.form.getRawValue();
		return [firstName, lastName].filter(Boolean).join(' ') || email || '';
	}

	/** The role's label: translated for the roles with a USERS_PAGE.ROLE string, as named for any other. */
	get roleLabel(): { key?: string; text: string } | null {
		const name = this.role?.name;
		if (!name) {
			return null;
		}
		return TRANSLATED_ROLES.includes(name as RolesEnum)
			? { key: `USERS_PAGE.ROLE.${name}`, text: name }
			: { text: name.replace(/_/g, ' ') };
	}

	constructor(
		private readonly _fb: UntypedFormBuilder,
		private readonly _authService: AuthService,
		private readonly _userService: UsersService,
		private readonly _store: Store,
		private readonly _toastrService: ToastrService,
		private readonly _errorHandler: ErrorHandlingService,
		private readonly _roleService: RoleService
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
		this._store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				tap(() => this.user$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Excludes roles based on the user's permissions.
	 * Adds the SUPER_ADMIN role to the excludes list if the user lacks SUPER_ADMIN privileges.
	 */
	async excludeRoles(): Promise<void> {
		try {
			// Check if the user has the SUPER_ADMIN role
			const hasSuperAdminRole = await firstValueFrom(this._authService.hasRole([RolesEnum.SUPER_ADMIN]));

			// Add SUPER_ADMIN to the excludes list if the user lacks the role
			if (!hasSuperAdminRole) {
				this.excludes.push(RolesEnum.SUPER_ADMIN);
			}
		} catch (error) {
			this._errorHandler?.handleError(error); // Optional error handling if applicable
		}
	}

	/**
	 * Retrieves the profile of the selected user or the current user.
	 * Fetches user details including tags and role, and updates the form.
	 */
	async getUserProfile(): Promise<void> {
		try {
			const relations = ['tags', 'role'];
			let user: IUser;

			// If a different user is selected (admin editing another user), use getUserById which requires ORG_USERS_VIEW.
			// Otherwise load the current user's own profile via /user/me which has no permission restriction.
			if (this.selectedUser?.id && this.selectedUser.id !== this.user?.id) {
				user = await this._userService.getUserById(this.selectedUser.id, relations);
			} else {
				user = await this._userService.getMe(relations);
			}

			// Patch the form with the retrieved user data
			this.profile = user;
			this._patchForm({ ...user });
		} catch (error) {
			this._errorHandler?.handleError(error); // Handle errors gracefully
		}
	}

	handleImageUploadError(error: any) {
		this._toastrService.danger(error);
	}

	async updateImageAsset(image: IImageAsset) {
		// The signed-in user's session carries their own photo: change it only when they edit their own profile.
		// An admin changing another user's photo used to put that photo on their own avatar.
		const isOwnProfile = this.isOwnProfile;
		if (isOwnProfile) {
			this._store.user = {
				...this._store.user,
				imageId: image.id
			};
		}
		// Show the new photo now, and keep its id with the form so a save straight after keeps it.
		this.avatarFailed = false;
		this.form.patchValue({ imageId: image.id, imageUrl: image.fullUrl || image.url });

		let request: IUserUpdateInput = {
			imageId: image.id
		};

		if (this.allowRoleChange) {
			const { tenantId } = this._store.user;
			const role = await firstValueFrom(
				this._roleService.getRoleByOptions({
					name: this.form.get('role').value.name,
					tenantId
				})
			);

			request = {
				...request,
				role
			};
		}

		try {
			await this._userService
				.update(this.selectedUser ? this.selectedUser.id : this._store.userId, request)
				.then((res: IUser) => {
					try {
						if (res && isOwnProfile) {
							this._store.user = {
								...this._store.user,
								imageUrl: res.imageUrl
							} as IUser;
						}
						this._toastrService.success('TOASTR.MESSAGE.IMAGE_UPDATED');
					} catch (error) {
						console.log('Error while uploading profile avatar', error);
					}
				});
		} catch (error) {
			this._errorHandler.handleError(error);
		}
	}

	async submitForm() {
		if (this.saving || this.form.invalid) {
			return;
		}
		const { timeFormat, timeZone } = this.form.value;
		const { email, firstName, lastName, tags, preferredLanguage, password, phoneNumber } = this.form.value;

		if (!EmailValidator.isValid(email, patterns.email)) {
			this._toastrService.error('TOASTR.MESSAGE.EMAIL_SHOULD_BE_REAL');
			return;
		}
		let request: IUserUpdateInput = {
			email,
			firstName,
			lastName,
			tags,
			preferredLanguage,
			timeZone,
			timeFormat,
			phoneNumber
		};

		if (password) {
			request = {
				...request,
				hash: password
			};
		}

		if (this.allowRoleChange) {
			const { tenantId } = this._store.user;
			const role = await firstValueFrom(
				this._roleService.getRoleByOptions({
					name: this.form.get('role').value.name,
					tenantId
				})
			);

			request = {
				...request,
				role
			};
		}

		this.saving = true;
		try {
			await this._userService
				.update(this.selectedUser ? this.selectedUser.id : this._store.userId, request)
				.then(() => {
					if ((this.selectedUser ? this.selectedUser.id : this._store.userId) === this._store.user.id) {
						this._store.user.email = request.email;
					}

					this._toastrService.success('TOASTR.MESSAGE.PROFILE_UPDATED');
					this.userSubmitted.emit();
					/**
					 * selectedUser is null for edit profile and populated in User edit
					 * Update app language when current user's profile is modified.
					 */
					if (this.selectedUser && this.selectedUser.id !== this._store.userId) {
						return;
					}
					this._store.preferredLanguage = preferredLanguage;
				});
		} catch (error) {
			this._errorHandler.handleError(error);
		} finally {
			this.saving = false;
		}
	}

	private _patchForm(user: IUser) {
		if (!user) {
			return;
		}

		this.form.patchValue({
			firstName: user.firstName,
			lastName: user.lastName,
			email: user.email,
			imageUrl: user.imageUrl,
			imageId: user.imageId,
			role: user.role,
			tags: user.tags,
			preferredLanguage: user.preferredLanguage,
			timeZone: user.timeZone,
			timeFormat: user.timeFormat,
			phoneNumber: user.phoneNumber
		});
		this.role = user.role;
	}

	/**
	 *
	 * @param tags
	 */
	selectedTagsHandler(tags: ITag[]) {
		this.form.get('tags').setValue(tags);
		this.form.get('tags').updateValueAndValidity();
	}

	/**
	 * On Selection Change
	 * @param role
	 */
	onSelectionChange(role: IRole) {
		this.form.get('role').setValue(role);
		this.form.get('role').updateValueAndValidity();
	}

	ngOnDestroy(): void {}
}
