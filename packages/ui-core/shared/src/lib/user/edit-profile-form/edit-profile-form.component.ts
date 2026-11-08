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
	/** A save is on its way: the Save button waits for it, and the photo cannot be changed meanwhile. */
	saving = false;
	/**
	 * A photo whose own save failed, which the next Save sends while the form still shows it. A photo saved by its
	 * own update is never sent again by a Save: a Save that started earlier would otherwise put the older photo back.
	 */
	private _unsavedImageId: string | null = null;
	/**
	 * Photos picked whose upload has not finished yet. Disabling the picker during a Save does not stop an upload
	 * already running, so a Save leaves an unsaved photo out while one is on its way: the newer photo replaces it.
	 */
	private _photoUploads = 0;
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
		// Where the role can change, a Save needs one: an empty role must not be looked up and assigned.
		const role = this.form?.get('role');
		role?.setValidators(value ? [Validators.required] : []);
		role?.updateValueAndValidity({ emitEvent: false });
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

	/** Whether the account is active (a user without the flag counts as active, as the app treats them). */
	get isActiveAccount(): boolean {
		return this.profile?.isActive !== false;
	}

	/** The interface language, for naming languages and formatting the local time. */
	private get uiLanguage(): string {
		return (typeof document !== 'undefined' && document.documentElement.lang) || 'en';
	}

	/** The preferred language by name ("English"), else its code; null when not set. */
	get languageName(): string | null {
		const code = this.profile?.preferredLanguage;
		if (!code) {
			return null;
		}
		try {
			return new Intl.DisplayNames([this.uiLanguage], { type: 'language' }).of(code) || code;
		} catch {
			return code;
		}
	}

	/** The user's time now, in their time zone and time format; null without a valid time zone. */
	get localTime(): string | null {
		const timeZone = this.profile?.timeZone;
		if (!timeZone) {
			return null;
		}
		try {
			return new Intl.DateTimeFormat(this.uiLanguage, {
				timeZone,
				hour: '2-digit',
				minute: '2-digit',
				...(this.profile?.timeFormat ? { hour12: Number(this.profile.timeFormat) === 12 } : {})
			}).format(new Date());
		} catch {
			return null;
		}
	}

	/** The time format's i18n key; null when not set. */
	get timeFormatKey(): string | null {
		switch (Number(this.profile?.timeFormat)) {
			case 12:
				return 'USERS_PAGE.EDIT_USER.TIME_FORMAT_12';
			case 24:
				return 'USERS_PAGE.EDIT_USER.TIME_FORMAT_24';
			default:
				return null;
		}
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

	/** A picked photo started uploading; `updateImageAsset` or `handleImageUploadError` follows. */
	onPhotoUploadStarted(): void {
		this._photoUploads += 1;
	}

	/** One upload fewer on its way (the uploader settles every upload it starts with one of the two events). */
	private _photoUploadSettled(): void {
		this._photoUploads = Math.max(0, this._photoUploads - 1);
	}

	handleImageUploadError(error: any) {
		this._photoUploadSettled();
		this._toastrService.danger(error);
	}

	/**
	 * Saves an uploaded photo on the user. The form shows it at once and keeps its id; when this update fails, the
	 * next Save sends it with the rest. Only the photo is sent: a role picked in the form is not saved before its Save.
	 * The signed-in user's session takes the photo only once it is saved, and only for their own profile (an admin
	 * changing another user's photo used to put it on their own avatar).
	 */
	async updateImageAsset(image: IImageAsset) {
		const isOwnProfile = this.isOwnProfile;
		// The session the photo was saved for: a sign-out, or another user's sign-in, while it is saved must not get it.
		const sessionUserId = this._store.userId;
		this._photoUploadSettled();
		this.avatarFailed = false;
		this.form.patchValue({ imageId: image.id, imageUrl: image.fullUrl || image.url });
		// This photo replaces one whose save failed: a Save must not send that one over it.
		this._unsavedImageId = null;

		try {
			const res: IUser = await this._userService.update(
				this.selectedUser ? this.selectedUser.id : this._store.userId,
				{ imageId: image.id }
			);
			if (isOwnProfile && sessionUserId && this._store.userId === sessionUserId && this._store.user) {
				this._store.user = {
					...this._store.user,
					imageId: image.id,
					imageUrl: res?.imageUrl || image.fullUrl || image.url
				} as IUser;
			}
			this._toastrService.success('TOASTR.MESSAGE.IMAGE_UPDATED');
		} catch (error) {
			// Left for the next Save, unless a newer photo has replaced it meanwhile.
			if (this.form.get('imageId').value === image.id) {
				this._unsavedImageId = image.id;
			}
			this._errorHandler.handleError(error);
		}
	}

	async submitForm() {
		const roleName = this.form.get('role').value?.name;
		// The role field is required where it can change; checked here too, since a click can be dispatched at a
		// disabled Save.
		if (this.saving || this.form.invalid || (this.allowRoleChange && !roleName)) {
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

		// Set before the role lookup: a click while it runs must not send a second save.
		this.saving = true;
		try {
			if (this.allowRoleChange) {
				const { tenantId } = this._store.user;
				const role = await firstValueFrom(
					this._roleService.getRoleByOptions({
						name: roleName,
						tenantId
					})
				);

				request = {
					...request,
					role
				};
			}

			// Read as the request leaves (after the role lookup): the photo shown, only when its own save failed, and
			// not while a newer photo is still uploading (its own save could land first and be overwritten).
			const unsavedImageId =
				this._unsavedImageId &&
				this._unsavedImageId === this.form.get('imageId').value &&
				this._photoUploads === 0
					? this._unsavedImageId
					: null;
			if (unsavedImageId) {
				request = { ...request, imageId: unsavedImageId };
			}

			await this._userService
				.update(this.selectedUser ? this.selectedUser.id : this._store.userId, request)
				.then(() => {
					if (unsavedImageId && this._unsavedImageId === unsavedImageId) {
						this._unsavedImageId = null;
					}
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
