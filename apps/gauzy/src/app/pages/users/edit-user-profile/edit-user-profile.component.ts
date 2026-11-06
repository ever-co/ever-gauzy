import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { filter, firstValueFrom, tap } from 'rxjs';
import { NbRouteTab } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IUser, ITag, RolesEnum } from '@gauzy/contracts';
import { AuthService, UsersService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

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
	selector: 'ngx-edit-user-profile',
	templateUrl: './edit-user-profile.component.html',
	styleUrls: ['./edit-user-profile.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class EditUserProfileComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	form: FormGroup;
	params: Params;
	user: IUser;
	tabs: NbRouteTab[];
	tags: ITag[];
	/** The photo failed to load: the placeholder shows instead. */
	avatarFailed = false;
	/** Numbers each load of the user: only the latest one, for the page's current user, is applied. */
	private _loadSeq = 0;
	/** The latest load of the user failed: the header has no name or role until a retry. */
	loadFailed = false;

	/** The header's name: the full name, else the email. */
	get displayName(): string {
		return (
			this.user?.name ||
			[this.user?.firstName, this.user?.lastName].filter(Boolean).join(' ') ||
			this.user?.email ||
			''
		);
	}

	/** The role's label: translated for the roles with a USERS_PAGE.ROLE string, as named for any other. */
	get roleLabel(): { key?: string; text: string } | null {
		const name = this.user?.role?.name;
		if (!name) {
			return null;
		}
		return TRANSLATED_ROLES.includes(name as RolesEnum)
			? { key: `USERS_PAGE.ROLE.${name}`, text: name }
			: { text: name.replace(/_/g, ' ') };
	}

	constructor(
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		public readonly translateService: TranslateService,
		private readonly usersService: UsersService,
		private readonly authService: AuthService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.params
			.pipe(
				filter((params) => !!params),
				tap((params) => (this.params = params)),
				tap(() => this.registerPageTabs()),
				tap(() => this.getUserProfile()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this._applyTranslationOnTabs();
	}

	/**
	 * Generates the route for a given tab based on the current user ID.
	 *
	 * @param tab - The tab name to append to the route.
	 * @returns The full route string.
	 */
	getRoute(tab: string = ''): string {
		if (!this.params?.id) {
			return `/pages/users`;
		}

		return `/pages/users/edit/${this.params?.id}/${tab}`;
	}

	/**
	 * Registers page tabs for the dashboard module.
	 * Ensures that tabs are registered only once.
	 *
	 * @returns {void}
	 */
	registerPageTabs(): void {
		this.tabs = [
			{
				title: this.getTranslation('USERS_PAGE.EDIT_USER.MAIN'),
				icon: 'person-outline',
				responsive: true,
				route: this.getRoute('')
			},
			{
				title: this.getTranslation('USERS_PAGE.EDIT_USER.USER_ORGANIZATIONS'),
				icon: 'book-open-outline',
				responsive: true,
				route: this.getRoute('organizations')
			}
		];
	}

	/** Loads the header's user again when its load failed: the Main tab's retry asks for it with its own. */
	retryIfFailed(): void {
		if (this.loadFailed) {
			this.getUserProfile();
		}
	}

	/**
	 * GET user profile
	 */
	private async getUserProfile() {
		if (!this.params.id) {
			this.router.navigate(['/pages/users']);
			return;
		}

		// Another user's details never show under this one's address: cleared now, and an answer for a user the
		// page has since left is dropped.
		const seq = ++this._loadSeq;
		const { id } = this.params;
		const isCurrent = () => seq === this._loadSeq && id === this.params?.id;
		this.user = null;
		this.avatarFailed = false;
		this.loadFailed = false;

		try {
			const user = await this.usersService.getUserById(id, ['role', 'tags']);
			if (!isCurrent()) {
				return;
			}
			this.user = user;

			if (user?.role?.name === RolesEnum.SUPER_ADMIN) {
				/**
				 * Redirect If Edit Super Admin Without Permission
				 */
				const hasSuperAdminRole = await firstValueFrom(this.authService.hasRole([RolesEnum.SUPER_ADMIN]));

				if (!hasSuperAdminRole && isCurrent()) {
					this.router.navigate(['/pages/users']);
				}
			}
		} catch (error) {
			// The header stays empty until a retry; the Main tab says the user could not be loaded and offers one.
			if (isCurrent()) {
				console.error('Error while loading the user', error);
				this.loadFailed = true;
			}
		}
	}

	/**
	 * Subscribes to language change events and applies translations to page tabs.
	 * Ensures the tabs are updated dynamically when the language changes.
	 * Uses `untilDestroyed` to clean up subscriptions when the component is destroyed.
	 */
	private _applyTranslationOnTabs(): void {
		this.translateService.onLangChange
			.pipe(
				// Re-register page tabs on language change
				tap(() => this.registerPageTabs()),

				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy() {}
}
