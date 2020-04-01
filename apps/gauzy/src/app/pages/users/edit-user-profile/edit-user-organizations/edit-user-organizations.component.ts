import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import {
	Organization,
	UserOrganizationCreateInput,
	RolesEnum
} from '@gauzy/models';
import { Subject } from 'rxjs';
import { takeUntil, first } from 'rxjs/operators';
import { FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { Params, ActivatedRoute, Router } from '@angular/router';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { UsersOrganizationsService } from 'apps/gauzy/src/app/@core/services/users-organizations.service';
import { NbToastrService, NbDialogService } from '@nebular/theme';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { OrganizationsService } from 'apps/gauzy/src/app/@core/services/organizations.service';
import { UsersService } from 'apps/gauzy/src/app/@core/services';
import { DeleteConfirmationComponent } from 'apps/gauzy/src/app/@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { UserIdService } from 'apps/gauzy/src/app/@core/services/edit-user-data.service';

@Component({
	selector: 'ngx-edit-user-organization',
	templateUrl: './edit-user-organizations.component.html'
})
export class EditUserOrganizationsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	@Input()
	organization: Organization;

	form: FormGroup;
	organizations: Organization[];
	selectedOrganizationsId: string[];
	routeParams: Params;
	showAddCard: boolean;
	selectedOrganizationId: string;
	selectedUserId: string;
	selectedUserName: string;

	constructor(
		private route: ActivatedRoute,
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
		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((params) => {
				this.routeParams = params;
			});

		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.showAddCard = false;
					this.selectedOrganizationId = organization.id;
				}
			});

		this.loadPage();
	}

	async addOrg(user: UserOrganizationCreateInput) {
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

	async remove() {
		const user = await this.usersService.getUserById(this.selectedUserId);

		const { items } = await this.userOrganizationsService.getAll([
			'user',
			'user.role'
		]);

		let counter = 0;

		let orgUserId: string;
		let userToRemove: any;
		let userName: string;

		for (const orgUser of items) {
			if (
				orgUser.isActive &&
				(!orgUser.user.role ||
					orgUser.user.role.name !== RolesEnum.EMPLOYEE)
			) {
				userToRemove = orgUser;
				userName = orgUser.user.firstName + ' ' + orgUser.user.lastName;
				orgUserId = orgUser.id;
				if (userToRemove.user.id === user.id) {
					counter++;
				}
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
				.onClose.pipe(takeUntil(this._ngDestroy$))
				.subscribe(async (result) => {
					if (result) {
						try {
							this.usersService.delete(
								userToRemove.user.id,
								userToRemove
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
				.onClose.pipe(takeUntil(this._ngDestroy$))
				.subscribe(async (result) => {
					if (result) {
						try {
							await this.userOrganizationsService.removeUserFromOrg(
								orgUserId
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
		const users = await this.userOrganizationsService.getAll([
			'user',
			'user.role'
		]);

		const { items } = await this.userOrganizationsService.getAll([], {
			id: this.userIdService.userId
		});

		this.selectedUserId = items[0].userId;

		const user = await this.usersService.getUserById(items[0].userId);
		this.selectedUserName = user.firstName + ' ' + user.lastName;

		const all_orgs = await this.organizationsService.getAll();

		const includedOrgs = users.items.filter(
			(item) => item.user.id === items[0].userId
		);

		const filtered = all_orgs.items.filter(
			(a) => includedOrgs.filter((b) => b.orgId === a.id).length
		);

		this.organizations = filtered;
	}

	cancel() {
		this.showAddCard = !this.showAddCard;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
