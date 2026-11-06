import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, TemplateRef, ViewChild } from '@angular/core';
import { IOrganization } from '@gauzy/contracts';
import { filter, tap, debounceTime } from 'rxjs/operators';
import { Subject, firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	OrganizationsService,
	Store,
	ToastrService,
	UsersOrganizationsService,
	UsersService
} from '@gauzy/ui-core/core';
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

	/** Every organization of the tenant, as last read: the add dialog offers those the user is not in. */
	allOrganizations: IOrganization[] = [];
	addSearch = '';
	addSelection = new Set<string>();
	saving = false;

	selectedUserId: string;
	selectedUserName: string;
	orgUserId: string;
	userToRemove: any;

	loading: boolean;
	paramId: string;
	organizations: IOrganization[] = [];
	subject$: Subject<any> = new Subject();

	constructor(
		public readonly translateService: TranslateService,
		private readonly userOrganizationsService: UsersOrganizationsService,
		private readonly toastrService: ToastrService,
		private readonly organizationsService: OrganizationsService,
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
					}
					this.paramId = params.id;
				}),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/** The tenant's organizations the user is not in yet: what the add dialog offers. */
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
			[organization.name, organization.officialName].some((value) => !!value && value.toLowerCase().includes(term))
		);
	}

	/** Whether every option the search shows is ticked. */
	get allOptionsSelected(): boolean {
		const options = this.addOptions;
		return options.length > 0 && options.every((organization) => this.addSelection.has(organization.id));
	}

	/** Opens the add dialog with nothing ticked, once the user's organizations are known. */
	openAdd(): void {
		if (this._addRef || this.loading || !this.selectedUserId) {
			return;
		}
		this.addSearch = '';
		this.addSelection = new Set();
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
		// Ready to type: the search is where picking starts.
		setTimeout(() => document.getElementById('addOrganizationsSearch')?.focus());
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
	 * closes that dialog. When one fails the dialog stays open, with the ticks the reload has not shown as joined.
	 */
	async addSelected(): Promise<void> {
		const ids = [...this.addSelection];
		const ref = this._addRef;
		const userId = this._addForUserId;
		if (!ids.length || this.saving || !ref || !userId || userId !== this.selectedUserId) {
			return;
		}
		const { tenantId } = this.store.user;
		this.saving = true;
		try {
			for (const organizationId of ids) {
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
			this.toastrService.success(
				this.getTranslation('NOTES.ORGANIZATIONS.ADD_NEW_USER_TO_ORGANIZATION', {
					username: this.selectedUserName,
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

	private async loadOrganizations() {
		try {
			const { tenantId } = this.store.user;
			const users = await this.userOrganizationsService.getAll(['user', 'user.role'], { tenantId });

			const { items } = await this.userOrganizationsService.getAll(['user'], {
				userId: this.paramId,
				tenantId
			});

			this.selectedUserId = items[0].userId;

			const user = items[0]['user'];
			this.selectedUserName = user.name || '';

			const { items: organizations } = await this.organizationsService.getAll({
				tenantId
			});

			const includedOrgs = users.items.filter((item) => item.user.id === items[0].userId);

			const filtered = organizations.filter((a) => includedOrgs.filter((b) => b.organizationId === a.id).length);

			this.organizations = filtered;
			this.allOrganizations = organizations;
			const available = new Set(this.availableOrganizations.map((organization) => organization.id));
			this.addSelection = new Set([...this.addSelection].filter((id) => available.has(id)));
		} catch (error) {
			console.error('Error while retrieving user organizations', error);
			this.toastrService.danger(error);
		} finally {
			this.loading = false;
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
