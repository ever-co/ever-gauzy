import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import {
	IOrganization,
	ComponentLayoutStyleEnum,
	IUser,
	OrganizationAction
} from '@gauzy/models';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { filter, first, tap } from 'rxjs/operators';
import { ErrorHandlingService } from '../../@core/services/error-handling.service';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { Store } from '../../@core/services/store.service';
import { OrganizationsMutationComponent } from '../../@shared/organizations/organizations-mutation/organizations-mutation.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { OrganizationsCurrencyComponent } from './table-components/organizations-currency/organizations-currency.component';
import { OrganizationsEmployeesComponent } from './table-components/organizations-employees/organizations-employees.component';
import { OrganizationsStatusComponent } from './table-components/organizations-status/organizations-status.component';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { PictureNameTagsComponent } from '../../@shared/table-components/picture-name-tags/picture-name-tags.component';
import { UsersOrganizationsService } from '../../@core/services/users-organizations.service';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { OrganizationEditStore } from '../../@core/services/organization-edit-store.service';
import { ToastrService } from '../../@core/services/toastr.service';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './organizations.component.html',
	styleUrls: ['./organizations.component.scss']
})
export class OrganizationsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	constructor(
		private organizationsService: OrganizationsService,
		private toastrService: ToastrService,
		private dialogService: NbDialogService,
		private router: Router,
		readonly translateService: TranslateService,
		private errorHandler: ErrorHandlingService,
		private store: Store,
		private userOrganizationService: UsersOrganizationsService,
		private readonly _organizationEditStore: OrganizationEditStore
	) {
		super(translateService);
		this.setView();
	}

	organizationsTable: Ng2SmartTableComponent;
	@ViewChild('organizationsTable') set content(
		content: Ng2SmartTableComponent
	) {
		if (content) {
			this.organizationsTable = content;
			this.onChangedSource();
		}
	}
	settingsSmartTable: object;
	selectedOrganization: IOrganization;
	smartTableSource = new LocalDataSource();
	organizations: IOrganization[] = [];
	viewComponentName: ComponentEnum;
	disableButton = true;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	loading = true;
	user: IUser;

	loadSettingsSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: this.getTranslation('SM_TABLE.CLIENT_NAME'),
					type: 'custom',
					renderComponent: PictureNameTagsComponent
				},
				totalEmployees: {
					title: this.getTranslation('SM_TABLE.EMPLOYEES'),
					type: 'custom',
					width: '200px',
					class: 'text-center',
					filter: false,
					renderComponent: OrganizationsEmployeesComponent
				},
				currency: {
					title: this.getTranslation('SM_TABLE.CURRENCY'),
					type: 'custom',
					class: 'text-center',
					width: '200px',
					renderComponent: OrganizationsCurrencyComponent
				},
				status: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'custom',
					class: 'text-center',
					width: '200px',
					filter: false,
					renderComponent: OrganizationsStatusComponent
				}
			},
			pager: {
				display: true,
				perPage: 8
			}
		};
	}
	ngOnInit() {
		this.loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();
		this.store.user$
			.pipe(
				filter((user) => !!user),
				untilDestroyed(this)
			)
			.subscribe((user: IUser) => {
				if (user) {
					this.user = user;
					this._loadSmartTable();
				}
			});
		this.router.events
			.pipe(untilDestroyed(this))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
	}

	setView() {
		this.viewComponentName = ComponentEnum.ORGANIZATION;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	selectOrganization({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedOrganization = isSelected ? data : null;
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSettingsSmartTable();
			});
	}

	async addOrganization() {
		const result = await this.dialogService
			.open(OrganizationsMutationComponent)
			.onClose.pipe(first())
			.toPromise();
		if (result) {
			try {
				await this.organizationsService
					.create(result)
					.then((organization: IOrganization) => {
						this._organizationEditStore.organizationAction = {
							organization,
							action: OrganizationAction.CREATED
						};

						this.toastrService.success(
							'NOTES.ORGANIZATIONS.ADD_NEW_ORGANIZATION',
							{
								name: result.name
							}
						);
						setTimeout(() => {
							this._loadSmartTable();
						}, 200);
					})
					.catch((error) => {
						this.errorHandler.handleError(error);
					});
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
	}

	async editOrganization(selectedItem?: IOrganization) {
		if (selectedItem) {
			this.selectOrganization({
				isSelected: true,
				data: selectedItem
			});
		}
		this.router.navigate([
			'/pages/organizations/edit/' + this.selectedOrganization.id
		]);
	}

	async deleteOrganization(selectedItem?: IOrganization) {
		if (selectedItem) {
			this.selectOrganization({
				isSelected: true,
				data: selectedItem
			});
		}
		const result = await this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'ORGANIZATIONS_PAGE.ORGANIZATION'
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			try {
				await this.organizationsService
					.delete(this.selectedOrganization.id)
					.then(() => {
						this._organizationEditStore.organizationAction = {
							organization: this.selectedOrganization,
							action: OrganizationAction.DELETED
						};
						this.toastrService.success(
							'NOTES.ORGANIZATIONS.DELETE_ORGANIZATION',
							{
								name: this.selectedOrganization.name
							}
						);
					})
					.catch((error) => {
						this.errorHandler.handleError(error);
					});
				this.clearItem();
				this._loadSmartTable();
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
	}

	private async _loadSmartTable() {
		try {
			const { items } = await this.userOrganizationService.getAll(
				['organization', 'organization.tags', 'organization.employees'],
				{ userId: this.store.userId, tenantId: this.user.tenantId }
			);

			this.organizations = items.map(
				(userOrganization) => userOrganization.organization
			);

			for (const org of this.organizations) {
				const activeEmployees = org.employees.filter((i) => i.isActive);
				org.totalEmployees = activeEmployees.length;
				delete org['employees'];
			}

			this.smartTableSource.load(this.organizations);
		} catch (error) {
			this.errorHandler.handleError(error);
		}

		this.loading = false;
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.organizationsTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectOrganization({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}
	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.organizationsTable && this.organizationsTable.grid) {
			this.organizationsTable.grid.dataSet['willSelect'] = 'false';
			this.organizationsTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy() {}
}
