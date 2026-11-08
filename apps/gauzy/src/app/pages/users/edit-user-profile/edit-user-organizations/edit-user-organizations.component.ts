import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, TemplateRef, ViewChild } from '@angular/core';
import { IOrganization, IUser, IUserOrganization, RolesEnum } from '@gauzy/contracts';
import { filter, tap, debounceTime } from 'rxjs/operators';
import { Subject, firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { Store, ToastrService, UsersOrganizationsService, UsersService } from '@gauzy/ui-core/core';
import { DeleteConfirmationComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-edit-user-organization',
	templateUrl: './edit-user-organizations.component.html',
	styleUrls: ['./edit-user-organizations.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class EditUserOrganizationsComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	/** The add dialog: a searchable checklist of the organizations the user is not in yet. */
	@ViewChild('addDialog', { static: true }) readonly addDialog: TemplateRef<void>;
	private _addRef: NbDialogRef<void> | null = null;
	/** The user the open add dialog was opened for: a later switch of user cannot redirect it. */
	private _addForUserId: string | null = null;

	/** The organizations the add dialog may offer, as last read: it offers those the user is not in. */
	allOrganizations: IOrganization[] = [];
	/** The user's inactive memberships, by organization: adding them to one of those reactivates it. */
	inactiveMemberships = new Map<string, string>();
	/** Whether the add dialog is reading the organizations it offers. */
	addLoading = false;
	addSearch = '';
	addSelection = new Set<string>();
	saving = false;

	/** The user whose organizations are loaded: the add dialog opens and saves only for them. */
	selectedUserId: string | null = null;
	selectedUserName: string;
	orgUserId: string;
	userToRemove: any;

	loading: boolean;
	paramId: string;
	organizations: IOrganization[] = [];
	subject$: Subject<any> = new Subject();
	/** Numbers each load of the list: only the latest one, for the page's current user, is applied. */
	private _loadSeq = 0;

	constructor(
		public readonly translateService: TranslateService,
		private readonly userOrganizationsService: UsersOrganizationsService,
		private readonly toastrService: ToastrService,
		private readonly dialogService: NbDialogService,
		private readonly store: Store,
		private readonly router: Router,
		private readonly usersService: UsersService,
		private readonly route: ActivatedRoute
	) {
		super(translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(300),
				tap(() => (this.loading = true)),
				tap(() => this.loadOrganizations()),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.parent.params
			.pipe(
				filter((params) => !!params),
				tap((params) => {
					if (this.paramId && this.paramId !== params.id) {
						this._addRef?.close();
						// Another user: what is loaded is no longer theirs, and a load still on its way is dropped.
						this._loadSeq++;
						this.selectedUserId = null;
						this.organizations = [];
						this.inactiveMemberships = new Map();
					}
					this.paramId = params.id;
				}),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/** The organizations the user is not in yet (or only inactively): what the add dialog offers. */
	get availableOrganizations(): IOrganization[] {
		const joined = new Set(this.organizations.map((organization) => organization.id));
		return this.allOrganizations
			.filter((organization) => !joined.has(organization.id))
			.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
	}

	/** The add dialog's options matching its search, by name or official name. */
	get addOptions(): IOrganization[] {
		const term = this.addSearch.trim().toLowerCase();
		const available = this.availableOrganizations;
		if (!term) {
			return available;
		}
		return available.filter((organization) =>
			[organization.name, organization.officialName].some(
				(value) => !!value && value.toLowerCase().includes(term)
			)
		);
	}

	/** Whether every option the search shows is ticked. */
	get allOptionsSelected(): boolean {
		const options = this.addOptions;
		return options.length > 0 && options.every((organization) => this.addSelection.has(organization.id));
	}

	/**
	 * Opens the add dialog with nothing ticked, once the user's organizations are known, and reads afresh the
	 * organizations it offers. Not while a save runs (Esc or the backdrop can close the dialog during one): reopening
	 * would clear the ticks a failed save leaves to retry.
	 */
	openAdd(): void {
		if (
			this._addRef ||
			this.saving ||
			this.loading ||
			!this.selectedUserId ||
			this.selectedUserId !== this.paramId
		) {
			return;
		}
		this.addSearch = '';
		this.addSelection = new Set();
		this.addLoading = true;
		const ref = this.dialogService.open(this.addDialog, {
			closeOnBackdropClick: true,
			closeOnEsc: true,
			autoFocus: false
		});
		this._addRef = ref;
		this._addForUserId = this.selectedUserId;
		// Esc or the backdrop can close it while a save runs: forget it only if it is still the open one.
		ref.onClose.subscribe(() => {
			if (this._addRef === ref) {
				this._addRef = null;
				this._addForUserId = null;
			}
		});
		this.loadAddOptions(ref);
	}

	/** Whether the signed-in user is a tenant admin, whom the server lets manage memberships of every organization. */
	private get isTenantAdmin(): boolean {
		const role = this.store.user?.role?.name;
		return role === RolesEnum.SUPER_ADMIN || role === RolesEnum.ADMIN;
	}

	/**
	 * The organizations the signed-in user may add a user to, as the server decides it: a tenant admin, every
	 * organization of the tenant (read through the tenant's memberships, since `GET /organization` refuses a query
	 * that names no organization); anyone else, the organization they are signed in to.
	 */
	private async readManageableOrganizations(): Promise<IOrganization[]> {
		if (!this.isTenantAdmin) {
			const current = this.store.selectedOrganization;
			return current?.id ? [current] : [];
		}
		const { tenantId } = this.store.user;
		const { items } = await this.userOrganizationsService.getAll(['organization'], { tenantId });
		return this.uniqueOrganizations(items);
	}

	/** Reads the organizations the add dialog `ref` offers. An answer for a dialog since closed is dropped. */
	private async loadAddOptions(ref: NbDialogRef<void>): Promise<void> {
		try {
			const organizations = await this.readManageableOrganizations();
			if (this._addRef === ref) {
				this.allOrganizations = organizations;
			}
		} catch (error) {
			if (this._addRef === ref) {
				this.toastrService.danger(error);
			}
		} finally {
			if (this._addRef === ref) {
				this.addLoading = false;
				// Ready to type: the search is where picking starts.
				setTimeout(() => document.getElementById('addOrganizationsSearch')?.focus());
			}
		}
	}

	/** The organizations of `memberships`, each once. */
	private uniqueOrganizations(memberships: Pick<IUserOrganization, 'organization'>[]): IOrganization[] {
		const byId = new Map<string, IOrganization>();
		for (const { organization } of memberships) {
			if (organization?.id) {
				byId.set(organization.id, organization);
			}
		}
		return [...byId.values()];
	}

	closeAdd(): void {
		if (!this.saving) {
			this._addRef?.close();
		}
	}

	toggleOption(id: string): void {
		const selection = new Set(this.addSelection);
		if (selection.has(id)) {
			selection.delete(id);
		} else {
			selection.add(id);
		}
		this.addSelection = selection;
	}

	/** Ticks every option the search shows, or unticks them when they all are. */
	toggleAllOptions(): void {
		const selection = new Set(this.addSelection);
		const select = !this.allOptionsSelected;
		this.addOptions.forEach((organization) =>
			select ? selection.add(organization.id) : selection.delete(organization.id)
		);
		this.addSelection = selection;
	}

	clearSelection(): void {
		this.addSelection = new Set();
	}

	/**
	 * Adds the dialog's user to the ticked organizations, one after another, says so once, reloads the list and
	 * closes that dialog. An organization the user has an inactive membership of has it reactivated rather than a
	 * second one made. Each organization leaves the ticks as soon as it is added, so when a later one fails and the
	 * dialog stays open, a retry sends only what is still to add.
	 *
	 * The user's inactive memberships and name are taken when the save starts: moving to another user while it runs
	 * replaces the page's, and the rest of the save must still reactivate and name this user's, never theirs.
	 */
	async addSelected(): Promise<void> {
		const ids = [...this.addSelection];
		const ref = this._addRef;
		const userId = this._addForUserId;
		if (
			!ids.length ||
			this.saving ||
			this.addLoading ||
			!ref ||
			!userId ||
			userId !== this.selectedUserId ||
			userId !== this.paramId
		) {
			return;
		}
		const { tenantId } = this.store.user;
		const inactiveMemberships = this.inactiveMemberships;
		const username = this.selectedUserName;
		this.saving = true;
		try {
			for (const organizationId of ids) {
				const inactive = inactiveMemberships.get(organizationId);
				if (inactive) {
					await this.userOrganizationsService.setUserAsActive(inactive);
				} else {
					// `isDefault: true` is the server's own default, which the add has always taken by leaving it out.
					await firstValueFrom(
						this.userOrganizationsService.create({
							userId,
							organizationId,
							tenantId,
							isActive: true,
							isDefault: true
						})
					);
				}
				const remaining = new Set(this.addSelection);
				remaining.delete(organizationId);
				this.addSelection = remaining;
			}
			this.toastrService.success(
				this.getTranslation('NOTES.ORGANIZATIONS.ADD_NEW_USER_TO_ORGANIZATION', {
					username,
					orgname: this.getTranslation('ORGANIZATIONS_PAGE.EDIT.ADDED_TO_ORGANIZATION')
				})
			);
			ref.close();
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.saving = false;
			this.subject$.next(true);
		}
	}

	async remove(id: string) {
		const { tenantId } = this.store.user;
		const { items } = await this.userOrganizationsService.getAll(['user', 'user.role'], {
			tenantId,
			userId: this.selectedUserId
		});

		let counter = 0;
		let userName: string;

		this.userToRemove = items.find((orgUser) => orgUser.organizationId === id && orgUser.isActive);

		if (!this.userToRemove?.user) {
			this.toastrService.danger('User organization record not found');
			return;
		}

		userName = [this.userToRemove.user.firstName, this.userToRemove.user.lastName].filter(Boolean).join(' ');
		this.orgUserId = this.userToRemove.id;
		counter = items.filter((orgUser) => orgUser.isActive).length;

		if (counter - 1 < 1) {
			this.dialogService
				.open(DeleteConfirmationComponent, {
					context: {
						recordType: userName + ' ' + this.getTranslation('FORM.DELETE_CONFIRMATION.DELETE_USER')
					}
				})
				.onClose.pipe(untilDestroyed(this))
				.subscribe(async (result) => {
					if (result) {
						try {
							await this.usersService.delete(this.userToRemove.user.id, this.userToRemove);

							this.toastrService.success(
								this.getTranslation('ORGANIZATIONS_PAGE.EDIT.USER_WAS_DELETED', { name: userName })
							);

							this.router.navigate(['/pages/users']);
						} catch (error) {
							this.toastrService.danger(error);
						}
					}
				});
		} else {
			this.dialogService
				.open(DeleteConfirmationComponent, {
					context: {
						recordType: userName + ' ' + this.getTranslation('FORM.DELETE_CONFIRMATION.USER_RECORD')
					}
				})
				.onClose.pipe(untilDestroyed(this))
				.subscribe(async (result) => {
					if (result) {
						try {
							await this.userOrganizationsService.removeUserFromOrg(this.orgUserId);

							this.toastrService.success(
								this.getTranslation('ORGANIZATIONS_PAGE.EDIT.USER_WAS_REMOVED', { name: userName })
							);

							this.loadOrganizations();
						} catch (error) {
							this.toastrService.danger(error);
						}
					}
				});
		}
	}

	/**
	 * Reads the user's memberships and their name, and lists the organizations they are active in. Each load is
	 * numbered: a load overtaken by a newer one, or by a move to another user, is dropped, and only the latest clears
	 * the spinner.
	 */
	private async loadOrganizations() {
		const seq = ++this._loadSeq;
		const userId = this.paramId;
		const isCurrent = () => seq === this._loadSeq && userId === this.paramId;
		try {
			const { tenantId } = this.store.user;
			const [{ items }, user] = await Promise.all([
				this.userOrganizationsService.getAll(['organization'], { userId, tenantId }),
				// The name for the dialog and its message, whether or not the user is in any organization yet.
				this.usersService.getUserById(userId).catch((): IUser | null => null)
			]);
			if (!isCurrent()) {
				return;
			}

			const active = items.filter((membership) => membership.isActive !== false);
			const inactive = items.filter((membership) => membership.isActive === false);

			this.selectedUserId = userId;
			this.selectedUserName =
				user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || '';
			this.organizations = this.uniqueOrganizations(active);
			this.inactiveMemberships = new Map(
				inactive.map((membership) => [membership.organizationId, membership.id] as const)
			);
			const available = new Set(this.availableOrganizations.map((organization) => organization.id));
			this.addSelection = new Set([...this.addSelection].filter((id) => available.has(id)));
		} catch (error) {
			if (isCurrent()) {
				console.error('Error while retrieving user organizations', error);
				this.toastrService.danger(error);
			}
		} finally {
			if (seq === this._loadSeq) {
				this.loading = false;
			}
		}
	}

	/** "Ever Technologies" -> "ET": the logo of an organization without a picture. */
	initialsOf(name: string = ''): string {
		return (
			name
				.split(/\s+/)
				.filter(Boolean)
				.slice(0, 2)
				.map((part) => part[0].toUpperCase())
				.join('') || '?'
		);
	}

	/** Leaving the tab with the add dialog open: close it rather than leave it on screen without its host. */
	ngOnDestroy() {
		this._addRef?.close();
	}
}
