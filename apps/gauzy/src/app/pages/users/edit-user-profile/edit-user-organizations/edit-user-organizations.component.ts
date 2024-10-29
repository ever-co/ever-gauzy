import { Component, OnInit, OnDestroy } from '@angular/core';
import { IOrganization, IUserOrganizationCreateInput } from '@gauzy/contracts';
import { filter, tap, debounceTime } from 'rxjs/operators';
import { Subject, firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbDialogService } from '@nebular/theme';
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
	styleUrls: ['./edit-user-organizations.component.scss']
})
export class EditUserOrganizationsComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	showAddCard: boolean;
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
				tap(() => (this.showAddCard = false)),
				tap(() => this.loadOrganizations()),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.parent.params
			.pipe(
				filter((params) => !!params),
				tap((params) => (this.paramId = params.id)),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async addOrg(user: IUserOrganizationCreateInput) {
		if (user.isActive) {
			await firstValueFrom(this.userOrganizationsService.create(user));

			this.toastrService.success(
				this.getTranslation('NOTES.ORGANIZATIONS.ADD_NEW_USER_TO_ORGANIZATION', {
					username: this.selectedUserName,
					orgname: this.getTranslation('ORGANIZATIONS_PAGE.EDIT.ADDED_TO_ORGANIZATION')
				})
			);
			this.subject$.next(true);
		}
	}

	async remove(id: string) {
		const { tenantId } = this.store.user;
		const user = await this.usersService.getUserById(this.selectedUserId);
		const { items } = await this.userOrganizationsService.getAll(['user', 'user.role'], {
			tenantId,
			userId: this.selectedUserId
		});

		let counter = 0;
		let userName: string;

		this.userToRemove = items.find((orgUser) => orgUser.organizationId === id);

		if (this.userToRemove) {
			userName = this.userToRemove.user.firstName + ' ' + this.userToRemove.user.lastName;
			this.orgUserId = this.userToRemove.id;
			counter = items.filter((orgUser) => orgUser.user.id === user.id && orgUser.isActive).length;
		}

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
							this.usersService.delete(this.userToRemove.user.id, this.userToRemove);

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
		this.loading = false;
	}

	cancel() {
		this.showAddCard = !this.showAddCard;
	}

	ngOnDestroy() {}
}
