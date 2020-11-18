import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import {
	IOrganization,
	IUserOrganizationCreateInput,
	RolesEnum
} from '@gauzy/models';
import { first, filter } from 'rxjs/operators';
import { FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { UsersOrganizationsService } from '../../../../@core/services/users-organizations.service';
import { NbToastrService, NbDialogService } from '@nebular/theme';
import { Store } from '../../../../@core/services/store.service';
import { OrganizationsService } from '../../../../@core/services/organizations.service';
import { UsersService } from '../../../../@core/services';
import { DeleteConfirmationComponent } from '../../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { UserIdService } from '../../../../@core/services/edit-user-data.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-edit-user-organization',
	templateUrl: './edit-user-organizations.component.html'
})
export class EditUserOrganizationsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@Input()
	organization: IOrganization;

	form: FormGroup;
	organizations: IOrganization[];
	selectedOrganizationsId: string[];
	showAddCard: boolean;
	selectedOrganizationId: string;
	selectedUserId: string;
	selectedUserName: string;
	orgUserId: string;
	userToRemove: any;

	constructor(
		readonly translateService: TranslateService,
		private userOrganizationsService: UsersOrganizationsService,
		private readonly toastrService: NbToastrService,
		private organizationsService: OrganizationsService,
		private userIdService: UserIdService,
		private dialogService: NbDialogService,
		private store: Store,
		private router: Router,
		private readonly usersService: UsersService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization) => {
				if (organization) {
					this.showAddCard = false;
					this.selectedOrganizationId = organization.id;
				}
			});

		this.loadPage();
	}

	async addOrg(user: IUserOrganizationCreateInput) {
		if (user.isActive) {
			await this.userOrganizationsService
				.create(user)
				.pipe(first())
				.toPromise();

			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.ADD_NEW_USER_TO_ORGANIZATION',
					{
						username: this.selectedUserName,
						orgname: this.getTranslation(
							'ORGANIZATIONS_PAGE.EDIT.ADDED_TO_ORGANIZATION'
						)
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this.showAddCard = false;
			this.loadPage();
		}
	}

	async remove(id: string) {
		const { tenantId } = this.store.user;
		const user = await this.usersService.getUserById(this.selectedUserId);
		const { items } = await this.userOrganizationsService.getAll(
			['user', 'user.role'],
			{
				tenantId
			}
		);

		let counter = 0;
		let userName: string;

		for (const orgUser of items) {
			if (
				orgUser.isActive &&
				(!orgUser.user.role ||
					orgUser.user.role.name !== RolesEnum.EMPLOYEE)
			) {
				this.userToRemove = orgUser;
				userName = orgUser.user.firstName + ' ' + orgUser.user.lastName;

				if (orgUser.organizationId === id) this.orgUserId = orgUser.id;
				if (this.userToRemove.user.id === user.id) counter++;
			}
		}

		if (counter - 1 < 1) {
			this.dialogService
				.open(DeleteConfirmationComponent, {
					context: {
						recordType:
							userName +
							' ' +
							this.getTranslation(
								'FORM.DELETE_CONFIRMATION.DELETE_USER'
							)
					}
				})
				.onClose.pipe(untilDestroyed(this))
				.subscribe(async (result) => {
					if (result) {
						try {
							this.usersService.delete(
								this.userToRemove.user.id,
								this.userToRemove
							);

							this.toastrService.primary(
								this.getTranslation(
									'ORGANIZATIONS_PAGE.EDIT.USER_WAS_DELETED',
									{
										name: userName
									}
								),
								this.getTranslation('TOASTR.TITLE.SUCCESS')
							);

							this.router.navigate(['/pages/users']);
						} catch (error) {
							this.toastrService.danger(
								error.error.message || error.message,
								'Error'
							);
						}
					}
				});
		} else {
			this.dialogService
				.open(DeleteConfirmationComponent, {
					context: {
						recordType:
							userName +
							' ' +
							this.getTranslation(
								'FORM.DELETE_CONFIRMATION.USER_RECORD'
							)
					}
				})
				.onClose.pipe(untilDestroyed(this))
				.subscribe(async (result) => {
					if (result) {
						try {
							await this.userOrganizationsService.removeUserFromOrg(
								this.orgUserId
							);

							this.toastrService.primary(
								this.getTranslation(
									'ORGANIZATIONS_PAGE.EDIT.USER_WAS_REMOVED',
									{
										name: userName
									}
								),
								this.getTranslation('TOASTR.TITLE.SUCCESS')
							);

							this.loadPage();
						} catch (error) {
							this.toastrService.danger(
								error.error.message || error.message,
								'Error'
							);
						}
					}
				});
		}
	}

	private async loadPage() {
		const { tenantId } = this.store.user;
		const users = await this.userOrganizationsService.getAll(
			['user', 'user.role'],
			{
				tenantId
			}
		);

		const { items } = await this.userOrganizationsService.getAll([], {
			id: this.userIdService.userId,
			tenantId
		});

		this.selectedUserId = items[0].userId;

		const user = await this.usersService.getUserById(items[0].userId);
		this.selectedUserName =
			(user.firstName || '') + ' ' + (user.lastName || '');

		const all_orgs = await this.organizationsService.getAll([], {
			tenantId
		});

		const includedOrgs = users.items.filter(
			(item) => item.user.id === items[0].userId
		);

		const filtered = all_orgs.items.filter(
			(a) => includedOrgs.filter((b) => b.organizationId === a.id).length
		);

		this.organizations = filtered;
	}

	cancel() {
		this.showAddCard = !this.showAddCard;
	}

	ngOnDestroy() {}
}
